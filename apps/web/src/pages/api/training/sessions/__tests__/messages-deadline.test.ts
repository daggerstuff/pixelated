/**
 * Regression coverage for the unbounded trainee message POST.
 *
 * `POST /api/training/sessions/{id}/messages` had no bound at all. On the
 * pinned release it was measured runtime-cancelled after 60 426 ms and
 * 68 747 ms with no row persisted (Cloudflare "your Worker's code had hung"),
 * while a healthy request completed in 2.7–4.5 s. The training data load has a
 * deadline; this route never did.
 *
 * These cases force the underlying lookup to never settle and assert the route
 * answers a retryable `503` + `Retry-After` inside its bound instead of hanging
 * until the runtime cancels it. The owner/denial semantics are asserted
 * separately in `messages.test.ts` and must not change.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockQuery,
  mockGetPoolQuery,
  mockGetSession,
  mockResolveInternalUserId,
} = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockGetPoolQuery: vi.fn(),
  mockGetSession: vi.fn(),
  mockResolveInternalUserId: vi.fn(),
}))

vi.mock('@/lib/auth/session', () => ({ getSession: mockGetSession }))
vi.mock('@/lib/db', () => ({
  getPool: () => ({ query: mockGetPoolQuery }),
  query: mockQuery,
  isDatabaseUnavailableError: (error: unknown) =>
    (error as { code?: string } | null)?.code === 'DB_UNAVAILABLE',
}))
vi.mock('@/lib/auth/internal-identity', () => ({
  resolveInternalUserId: mockResolveInternalUserId,
}))

import * as messagesRoute from '../[sessionId]/messages'

const DEADLINE_MS = 8_000
const USER_ID = '6cf52d73-8188-487f-a1c6-4ebc014328c0'
const SESSION_ID = '7a62430b-a01a-4eaf-8eb8-517e70ffb20d'

const request = () =>
  new Request(`http://localhost/api/training/sessions/${SESSION_ID}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'http://localhost',
    },
    body: JSON.stringify({ content: 'Practice response' }),
  })

const invoke = (context: object = {}) =>
  (messagesRoute.POST as unknown as (value: object) => Promise<Response>)({
    request: request(),
    params: { sessionId: SESSION_ID },
    ...context,
  })

beforeEach(() => {
  vi.clearAllMocks()
  mockGetSession.mockResolvedValue({ user: { id: USER_ID } })
  mockResolveInternalUserId.mockResolvedValue(USER_ID)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('trainee message POST deadline', () => {
  it('exposes the configured bound', () => {
    expect(messagesRoute.MESSAGE_POST_DEADLINE_MS).toBe(DEADLINE_MS)
  })

  it('returns 503 with Retry-After when the session lookup never settles', async () => {
    vi.useFakeTimers()
    mockGetSession.mockReturnValue(new Promise(() => {}))

    const pending = invoke()
    await vi.advanceTimersByTimeAsync(DEADLINE_MS)
    const response = await pending

    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('1')
    await expect(response.json()).resolves.toEqual({
      error: 'Training message temporarily unavailable',
    })
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns 503 with Retry-After when identity resolution never settles', async () => {
    vi.useFakeTimers()
    mockResolveInternalUserId.mockReturnValue(new Promise(() => {}))

    const pending = invoke()
    await vi.advanceTimersByTimeAsync(DEADLINE_MS)
    const response = await pending

    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('1')
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns 503 with Retry-After when the insert never settles', async () => {
    vi.useFakeTimers()
    mockQuery.mockReturnValue(new Promise(() => {}))

    const pending = invoke()
    await vi.advanceTimersByTimeAsync(DEADLINE_MS)
    const response = await pending

    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('1')
  })

  it('returns 503 when the database is unavailable', async () => {
    // The acquisition bound in lib/db turns a hung pool connect into a typed
    // retryable failure well inside the deadline. It must surface as the same
    // retryable shape instead of the old catch-all 500.
    mockQuery.mockRejectedValue(
      Object.assign(new Error('Database connection could not be acquired'), {
        code: 'DB_UNAVAILABLE',
      }),
    )

    const response = await invoke()

    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('1')
  })

  it('returns 503 when identity resolution cannot acquire a database client', async () => {
    // Identity resolution performs the first Postgres round-trip, so its
    // acquisition stall must be retryable rather than a 403 denial.
    mockResolveInternalUserId.mockRejectedValue(
      Object.assign(new Error('Database connection could not be acquired'), {
        code: 'DB_UNAVAILABLE',
      }),
    )

    const response = await invoke()

    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('1')
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('answers inside the bound when the work settles', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'cf3f44d1-adb0-4db2-96e1-5481fa80872b',
          content: 'Practice response',
          created_at: new Date('2026-11-04T05:00:00.000Z'),
        },
      ],
    })

    const response = await invoke()

    expect(response.status).toBe(201)
  })

  it('writes through the bounded query helper, not a raw pool checkout', async () => {
    // The hot-path repair bounds `query()`'s client acquisition
    // (`DB_ACQUIRE_TIMEOUT_MS` x `DB_ACQUIRE_ATTEMPTS`). `getPool().query()`
    // bypasses that bound and would keep the unbounded checkout this route is
    // being fixed for.
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'cf3f44d1-adb0-4db2-96e1-5481fa80872b',
          content: 'Practice response',
          created_at: new Date('2026-11-04T05:00:00.000Z'),
        },
      ],
    })

    const response = await invoke()

    expect(response.status).toBe(201)
    expect(mockQuery).toHaveBeenCalledTimes(1)
    expect(mockGetPoolQuery).not.toHaveBeenCalled()
  })
})
