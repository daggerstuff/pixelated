import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockQuery, mockGetSession, mockResolveInternalUserId } = vi.hoisted(
  () => ({
    mockQuery: vi.fn(),
    mockGetSession: vi.fn(),
    mockResolveInternalUserId: vi.fn(),
  }),
)

vi.mock('@/lib/auth/session', () => ({ getSession: mockGetSession }))
vi.mock('@/lib/auth/internal-identity', () => ({
  resolveInternalUserId: mockResolveInternalUserId,
}))
vi.mock('@/lib/db', () => ({
  getPool: () => ({ query: mockQuery }),
  query: mockQuery,
  isDatabaseUnavailableError: (error: unknown) =>
    (error as { code?: string } | null)?.code === 'DB_UNAVAILABLE',
}))

import { POST } from '../[sessionId]/messages'

const USER_ID = '6cf52d73-8188-487f-a1c6-4ebc014328c0'
const SESSION_ID = '7a62430b-a01a-4eaf-8eb8-517e70ffb20d'

const invoke = (context: object) =>
  (POST as unknown as (value: object) => Promise<Response>)(context)

const request = (body: unknown) =>
  new Request(`http://localhost/api/training/sessions/${SESSION_ID}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'http://localhost',
    },
    body: JSON.stringify(body),
  })

beforeEach(() => {
  vi.clearAllMocks()
  mockGetSession.mockResolvedValue({ user: { id: USER_ID } })
  mockResolveInternalUserId.mockResolvedValue(USER_ID)
})

describe('POST /api/training/sessions/:sessionId/messages', () => {
  it('requires authentication before saving', async () => {
    mockGetSession.mockResolvedValue(null)

    const response = await invoke({
      request: request({ content: 'Practice response' }),
      params: { sessionId: SESSION_ID },
    })

    expect(response.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('saves only to an owner-owned synthetic training session', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'cf3f44d1-adb0-4db2-96e1-5481fa80872b',
          content: 'Practice response',
          created_at: new Date('2026-11-04T05:00:00.000Z'),
        },
      ],
    })

    const response = await invoke({
      request: request({ content: ' Practice response ' }),
      params: { sessionId: SESSION_ID },
    })

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({
      id: 'cf3f44d1-adb0-4db2-96e1-5481fa80872b',
      content: 'Practice response',
      createdAt: '2026-11-04T05:00:00.000Z',
    })
    expect(mockQuery.mock.calls[0]?.[0]).toContain(
      "context->>'synthetic' = 'true'",
    )
    // The row's primary key is the submission's deterministic key, and the
    // insert refuses a duplicate instead of stacking a second row.
    expect(mockQuery.mock.calls[0]?.[0]).toContain(
      'ON CONFLICT (id) DO NOTHING',
    )
    const params = mockQuery.mock.calls[0]?.[1] as unknown[]
    expect(params).toHaveLength(4)
    expect(params[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
    expect(params.slice(1)).toEqual([SESSION_ID, USER_ID, 'Practice response'])
  })

  it('denies an unresolvable identity without reaching the database', async () => {
    mockResolveInternalUserId.mockResolvedValue(null)

    const response = await invoke({
      request: request({ content: 'Practice response' }),
      params: { sessionId: SESSION_ID },
    })

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      error: 'User identity not resolved',
    })
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('answers 404 when the session is not owned by the caller', async () => {
    // The ownership predicate lives in the INSERT ... SELECT, so a non-owner
    // (or a non-training / non-synthetic session) returns no row. The replay
    // lookup that follows a conflict also finds nothing.
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })

    const response = await invoke({
      request: request({ content: 'Practice response' }),
      params: { sessionId: SESSION_ID },
    })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      error: 'Training session not found',
    })
  })

  it('rejects empty and oversized messages', async () => {
    for (const content of ['', ' '.repeat(3), 'x'.repeat(1001)]) {
      const response = await invoke({
        request: request({ content }),
        params: { sessionId: SESSION_ID },
      })
      expect(response.status).toBe(400)
    }

    expect(mockQuery).not.toHaveBeenCalled()
  })
})
