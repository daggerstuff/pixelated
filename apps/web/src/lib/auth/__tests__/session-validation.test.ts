/** @vitest-environment node */

/**
 * One validation, one verdict.
 *
 * `validateSessionToken` is the cache-aware entry point the middleware uses.
 * It reads the validated-session cache first and, on a miss, performs exactly
 * one `/userinfo` verification whose result *is* the classification: valid,
 * invalid, or provider-unavailable. The previous shape read the cache through
 * `getSession` and then classified with a second validation, so a cold request
 * that could not be verified paid two `/userinfo` calls — 5 001 ms at two
 * 2 500 ms deadlines, and two of the ten requests Auth0's bucket allows.
 *
 * These tests also pin the parts of the contract that must not move: a valid
 * token still produces the same `Session` `getSession` returns, and neither a
 * provider outage nor an invalid token is cached.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockValidateToken = vi.hoisted(() => vi.fn())

vi.mock('../auth0-jwt-service', () => ({
  validateToken: mockValidateToken,
}))

const mockRedis = vi.hoisted(() => ({
  getFromCache: vi.fn(),
  setInCache: vi.fn(),
  removeFromCache: vi.fn(),
}))

vi.mock('../../redis', () => mockRedis)

import { getSession, validateSessionToken } from '../session'

/**
 * The session cache is a module-level Map that survives between tests, so every
 * case uses its own token.
 */
const tokenFor = (name: string) => `session-validation-token-${name}`

const requestWith = (token: string) =>
  new Request('http://localhost:5173/training', {
    headers: { cookie: `auth-token=${token}` },
  })

const validValidation = () => ({
  valid: true,
  userId: 'auth0|pilot-gamma',
  role: 'therapist',
  tokenId: 'jti-gamma',
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
  payload: {
    email: 'gamma@example.test',
    name: 'Gamma Pilot',
    app_metadata: { workspaceId: 'ws-gamma', roles: ['therapist'] },
  },
})

const originalEnv = { ...process.env }

beforeEach(() => {
  vi.clearAllMocks()
  mockValidateToken.mockReset()
  mockRedis.getFromCache.mockReset().mockResolvedValue(null)
  mockRedis.setInCache.mockReset().mockResolvedValue(true)
  mockRedis.removeFromCache.mockReset().mockResolvedValue(true)
  delete process.env['USE_REDIS_SESSIONS']
})

afterEach(() => {
  process.env = { ...originalEnv }
})

describe('validateSessionToken', () => {
  it('returns a valid verdict and caches the session on a cold token', async () => {
    mockValidateToken.mockResolvedValue(validValidation())
    const token = tokenFor('valid-cold')

    const first = await validateSessionToken(token)

    expect(first.status).toBe('valid')
    expect(mockValidateToken).toHaveBeenCalledTimes(1)
    expect(first.session).toEqual({
      user: {
        id: 'auth0|pilot-gamma',
        email: 'gamma@example.test',
        role: 'therapist',
        roles: ['therapist'],
        name: 'Gamma Pilot',
      },
      workspaceId: 'ws-gamma',
      expires: expect.any(String),
    })

    const second = await validateSessionToken(token)

    expect(second.status).toBe('valid')
    // A warm token costs no provider round trip at all.
    expect(mockValidateToken).toHaveBeenCalledTimes(1)
    expect(second.session).toBe(first.session)
  })

  it('returns the same Session that getSession already returned', async () => {
    mockValidateToken.mockResolvedValue(validValidation())
    const token = tokenFor('valid-get-session')

    const resolution = await validateSessionToken(token)
    const session = await getSession(requestWith(token))

    expect(resolution.status).toBe('valid')
    expect(session).toBe(resolution.session)
  })

  it('returns the provider-unavailable verdict and caches nothing', async () => {
    mockValidateToken.mockResolvedValue({
      valid: false,
      providerUnavailable: true,
      retryAfterSeconds: 112,
      error: 'Too Many Requests',
    })
    const token = tokenFor('provider-outage')

    const first = await validateSessionToken(token)

    expect(first).toEqual({
      status: 'provider-unavailable',
      retryAfterSeconds: 112,
    })
    expect(first.session).toBeUndefined()
    expect(mockValidateToken).toHaveBeenCalledTimes(1)

    // A provider verdict is never cached: the next request re-validates once.
    const second = await validateSessionToken(token)

    expect(second.status).toBe('provider-unavailable')
    expect(mockValidateToken).toHaveBeenCalledTimes(2)
  })

  it('returns the invalid verdict and caches nothing', async () => {
    mockValidateToken.mockResolvedValue({
      valid: false,
      error: 'Invalid audience',
    })
    const token = tokenFor('invalid')

    const first = await validateSessionToken(token)

    expect(first).toEqual({ status: 'invalid' })
    expect(mockValidateToken).toHaveBeenCalledTimes(1)

    await validateSessionToken(token)

    expect(mockValidateToken).toHaveBeenCalledTimes(2)
  })

  it('treats a cache-backend failure as a miss and validates once', async () => {
    process.env['USE_REDIS_SESSIONS'] = '1'
    mockRedis.getFromCache.mockRejectedValue(
      new Error('cache backend unreachable'),
    )
    mockValidateToken.mockResolvedValue(validValidation())

    const resolution = await validateSessionToken(tokenFor('cache-throw'))

    expect(resolution.status).toBe('valid')
    expect(mockValidateToken).toHaveBeenCalledTimes(1)
  })

  it('keeps getSession null for every non-valid verdict', async () => {
    mockValidateToken.mockResolvedValueOnce({
      valid: false,
      providerUnavailable: true,
      retryAfterSeconds: 30,
    })
    expect(
      await getSession(requestWith(tokenFor('get-null-outage'))),
    ).toBeNull()

    mockValidateToken.mockResolvedValueOnce({ valid: false, error: 'expired' })
    expect(
      await getSession(requestWith(tokenFor('get-null-invalid'))),
    ).toBeNull()
  })
})
