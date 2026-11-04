import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockConnect, mockQuery, mockRelease, mockGetSession } = vi.hoisted(
  () => ({
    mockConnect: vi.fn(),
    mockQuery: vi.fn(),
    mockRelease: vi.fn(),
    mockGetSession: vi.fn(),
  }),
)

vi.mock('@/lib/auth/session', () => ({ getSession: mockGetSession }))
vi.mock('@/lib/db', () => ({
  getPool: () => ({ connect: mockConnect }),
}))

import { GET, POST } from '../snapshots'

const USER_ID = '6cf52d73-8188-487f-a1c6-4ebc014328c0'
const SESSION_ID = 'bb682d68-2338-48f0-8ac5-e0243b1346d2'

const createClient = () => ({ query: mockQuery, release: mockRelease })

const invoke = (
  handler: (context: never) => Promise<Response>,
  context: object,
) => (handler as unknown as (value: object) => Promise<Response>)(context)

const createRequest = (url: string, body?: unknown): Request =>
  new Request(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers:
      body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

const authenticatedSession = {
  user: { id: USER_ID, role: 'therapist' },
  expires: new Date(Date.now() + 60_000).toISOString(),
}

beforeEach(() => {
  vi.clearAllMocks()
  mockQuery.mockReset()
  mockRelease.mockReset()
  mockGetSession.mockResolvedValue(authenticatedSession)
  mockConnect.mockResolvedValue(createClient())
})

describe('session snapshots authorization', () => {
  it('rejects unauthenticated reads and writes before database access', async () => {
    mockGetSession.mockResolvedValue(null)

    const getResponse = await invoke(GET, {
      request: createRequest(
        `http://localhost/api/session/snapshots?sessionId=${SESSION_ID}`,
      ),
    })
    const postResponse = await invoke(POST, {
      request: createRequest('http://localhost/api/session/snapshots', {
        sessionId: SESSION_ID,
        snapshots: [],
      }),
    })

    expect(getResponse.status).toBe(401)
    expect(postResponse.status).toBe(401)
    expect(mockConnect).not.toHaveBeenCalled()
  })

  it('scopes snapshot writes to the authenticated owner', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: SESSION_ID }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })

    const response = await invoke(POST, {
      request: createRequest('http://localhost/api/session/snapshots', {
        sessionId: SESSION_ID,
        snapshots: [{ timestamp: '2026-11-04T00:00:00.000Z', value: 25 }],
      }),
    })

    expect(response.status).toBe(200)
    expect(mockQuery.mock.calls[1]?.[0]).toContain(
      'id = $1 AND therapist_id = $2 FOR UPDATE',
    )
    expect(mockQuery.mock.calls[1]?.[1]).toEqual([SESSION_ID, USER_ID])
    expect(mockQuery.mock.calls.at(-1)?.[0]).toBe('COMMIT')
  })

  it('conceals snapshots owned by another user', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] })

    const response = await invoke(GET, {
      request: createRequest(
        `http://localhost/api/session/snapshots?sessionId=${SESSION_ID}`,
      ),
    })

    expect(response.status).toBe(404)
    expect(mockQuery.mock.calls[0]?.[0]).toContain(
      'id = $1 AND therapist_id = $2',
    )
    expect(mockQuery.mock.calls[0]?.[1]).toEqual([SESSION_ID, USER_ID])
  })

  it('rejects invalid timestamps and oversized batches', async () => {
    const invalidTimestamp = await invoke(POST, {
      request: createRequest('http://localhost/api/session/snapshots', {
        sessionId: SESSION_ID,
        snapshots: [{ timestamp: 'not-a-date', value: 25 }],
      }),
    })
    const oversized = await invoke(POST, {
      request: createRequest('http://localhost/api/session/snapshots', {
        sessionId: SESSION_ID,
        snapshots: Array.from({ length: 501 }, (_, value) => ({
          timestamp: '2026-11-04T00:00:00.000Z',
          value,
        })),
      }),
    })

    expect(invalidTimestamp.status).toBe(400)
    expect(oversized.status).toBe(400)
    expect(mockConnect).not.toHaveBeenCalled()
  })
})
