/**
 * Regression coverage for the pre-pool request hang.
 *
 * The identity-bridge repair added an await on `resolveInternalUserId` before
 * the Postgres pool was reached (`session-api.ts`). When that await (or the
 * pool read that follows it) never settles, the runtime cancels the request
 * (Cloudflare Error 1101). The training data load is bounded, so an exceeded
 * deadline returns a retryable 503 with `Retry-After` instead of hanging.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockQuery, mockGetSession, mockResolveInternalUserId } = vi.hoisted(
  () => ({
    mockQuery: vi.fn(),
    mockGetSession: vi.fn(),
    mockResolveInternalUserId: vi.fn(),
  }),
)

vi.mock('@/lib/auth/session', () => ({ getSession: mockGetSession }))
vi.mock('@/lib/db', () => ({ getPool: () => ({ query: mockQuery }) }))
vi.mock('@/lib/auth/internal-identity', () => ({
  resolveInternalUserId: mockResolveInternalUserId,
}))

import * as sessionApi from '../session-api'

const DEADLINE_MS = 8_000
const SESSION_ID = '7a62430b-a01a-4eaf-8eb8-517e70ffb20d'
const USER_UUID = '6cf52d73-8188-487f-a1c6-4ebc014328c0'

const request = () =>
  new Request(`http://localhost/api/training/sessions/${SESSION_ID}`)

const sessionRow = () => ({
  rowCount: 1,
  rows: [
    {
      id: SESSION_ID,
      context: {
        synthetic: true,
        clientProfile: {
          name: 'Synthetic Client',
          age: 31,
          gender: 'unspecified',
          personalityType: 'reflective',
          presentingProblem: 'Work stress',
        },
        difficultyLevel: 'intermediate',
      },
    },
  ],
})

beforeEach(() => {
  vi.clearAllMocks()
  mockGetSession.mockResolvedValue({
    user: { id: 'auth0|org-a', role: 'therapist' },
  })
  mockResolveInternalUserId.mockResolvedValue(USER_UUID)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('training data load deadline', () => {
  it('exposes the configured deadline', () => {
    expect(sessionApi.TRAINING_DATA_DEADLINE_MS).toBe(DEADLINE_MS)
  })

  it('returns 503 with Retry-After when identity resolution never settles', async () => {
    vi.useFakeTimers()
    mockResolveInternalUserId.mockReturnValue(new Promise(() => {}))

    const pending = sessionApi.getTrainingSessionResponse(request(), SESSION_ID)
    await vi.advanceTimersByTimeAsync(DEADLINE_MS)
    const response = await pending

    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('1')
    await expect(response.json()).resolves.toEqual({
      error: 'Session temporarily unavailable',
    })
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns 503 with Retry-After when the database read never settles', async () => {
    vi.useFakeTimers()
    mockQuery.mockReturnValue(new Promise(() => {}))

    const pending = sessionApi.getTrainingSessionResponse(request(), SESSION_ID)
    await vi.advanceTimersByTimeAsync(DEADLINE_MS)
    const response = await pending

    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('1')
  })

  it('returns the session when the load settles inside the deadline', async () => {
    mockQuery
      .mockResolvedValueOnce(sessionRow())
      .mockResolvedValueOnce({ rows: [] })

    const response = await sessionApi.getTrainingSessionResponse(
      request(),
      SESSION_ID,
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.sessionId).toBe(SESSION_ID)
  })
})
