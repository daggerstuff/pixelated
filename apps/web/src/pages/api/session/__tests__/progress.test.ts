import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockConnect,
  mockQuery,
  mockRelease,
  mockGetSession,
  mockResolveInternalUserId,
} = vi.hoisted(() => ({
  mockConnect: vi.fn(),
  mockQuery: vi.fn(),
  mockRelease: vi.fn(),
  mockGetSession: vi.fn(),
  mockResolveInternalUserId: vi.fn(),
}))

vi.mock('@/lib/auth/session', () => ({ getSession: mockGetSession }))
vi.mock('@/lib/auth/internal-identity', () => ({
  resolveInternalUserId: mockResolveInternalUserId,
}))
vi.mock('@/lib/db', () => ({
  acquireClient: mockConnect,
  isDatabaseUnavailableError: (error: unknown) =>
    error instanceof Error &&
    ['08006', '08003', '57P01', 'ECONNREFUSED', 'ECONNRESET'].includes(
      (error as { code?: string }).code ?? '',
    ),
}))

import { GET, POST } from '../progress'

/** The provider subject `getSession()` exposes as `user.id`. */
const AUTH0_SUB = 'auth0|progress-caller'
/** The internal `users.id` UUID that `therapist_id` compares against. */
const USER_ID = '6cf52d73-8188-487f-a1c6-4ebc014328c0'
const SESSION_ID = 'bb682d68-2338-48f0-8ac5-e0243b1346d2'
const INVALID_REQUEST_CODE = 'LEGACY_SESSION_INVALID_REQUEST'

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

const createRawRequest = (url: string, body: string): Request =>
  new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })

const authenticatedSession = {
  user: { id: AUTH0_SUB, email: 'caller@example.test', role: 'therapist' },
  expires: new Date(Date.now() + 60_000).toISOString(),
}

const expectInvalidRequest = async (response: Response, message: string) => {
  expect(response.status).toBe(400)
  expect(await response.json()).toEqual({
    error: message,
    code: INVALID_REQUEST_CODE,
  })
  // Malformed input must be classified before any statement runs: `22P02` is
  // raised by the statement itself.
  expect(mockConnect).not.toHaveBeenCalled()
  expect(mockQuery).not.toHaveBeenCalled()
}

beforeEach(() => {
  vi.clearAllMocks()
  mockQuery.mockReset()
  mockRelease.mockReset()
  mockGetSession.mockResolvedValue(authenticatedSession)
  mockResolveInternalUserId.mockResolvedValue(USER_ID)
  mockConnect.mockResolvedValue(createClient())
})

describe('session progress with malformed input', () => {
  it('answers 400 for a body that is not valid JSON', async () => {
    const response = await invoke(POST, {
      request: createRawRequest(
        'http://localhost/api/session/progress',
        `{"sessionId": "${SESSION_ID}", "evaluationFeedback": "ok"`,
      ),
    })

    await expectInvalidRequest(response, 'Invalid JSON body')
  })

  it('answers 400 for an empty body', async () => {
    const response = await invoke(POST, {
      request: createRawRequest('http://localhost/api/session/progress', ''),
    })

    await expectInvalidRequest(response, 'Invalid JSON body')
  })

  it('rejects a non-UUID sessionId on POST before any statement runs', async () => {
    const response = await invoke(POST, {
      request: createRequest('http://localhost/api/session/progress', {
        sessionId: 'not-a-uuid',
        evaluationFeedback: 'steady progress',
      }),
    })

    await expectInvalidRequest(response, 'Invalid sessionId: expected a UUID')
  })

  it('rejects a non-UUID sessionId on GET before any statement runs', async () => {
    const response = await invoke(GET, {
      request: createRequest(
        'http://localhost/api/session/progress?sessionId=not-a-uuid',
      ),
    })

    await expectInvalidRequest(response, 'Invalid sessionId: expected a UUID')
  })
})

describe('session progress happy path', () => {
  it('still writes feedback for a valid UUID sessionId', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rowCount: 0, rows: [] }
      if (sql.includes('FOR UPDATE')) {
        return { rowCount: 1, rows: [{ id: SESSION_ID }] }
      }
      if (sql.includes('INSERT INTO evaluations')) {
        return { rowCount: 1, rows: [] }
      }
      throw new Error(`unexpected statement: ${sql}`)
    })

    const response = await invoke(POST, {
      request: createRequest('http://localhost/api/session/progress', {
        sessionId: SESSION_ID,
        evaluationFeedback: 'steady progress',
      }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      sessionId: SESSION_ID,
    })
    expect(mockQuery.mock.calls.at(-1)?.[0]).toBe('COMMIT')
  })
})
