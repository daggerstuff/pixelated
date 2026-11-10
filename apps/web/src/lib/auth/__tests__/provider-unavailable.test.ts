/** @vitest-environment node */

/**
 * Provider-unavailable token validation (diagnosis D1 / D4).
 *
 * The tenant's `/userinfo` endpoint rate-limits at 10 requests and returns
 * HTTP 429 with `retry-after: ~112`. `validateToken` used to fold that into
 * `{ valid: false }`, which every caller reads as "the token is invalid" — the
 * `/login` redirect in `training/index.astro` and
 * `training/session/[sessionId].astro` (diagnosis D1). A 429 means the provider
 * cannot verify right now, so the result must be distinguishable and bounded:
 * never a silent pass, never an invalid-token verdict.
 *
 * D4 also measured 5–7 Auth0 calls per page load, one of them the Management
 * API role lookup that carries no timeout. These tests pin the bound and the
 * single-flight path.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockRedis = vi.hoisted(() => ({
  getFromCache: vi.fn(),
  setInCache: vi.fn(),
  removeFromCache: vi.fn(),
  redisClient: {
    keys: vi.fn(() => []),
    del: vi.fn(() => 0),
  },
}))

const mockAuthClient = vi.hoisted(() => ({
  getProfile: vi.fn(),
  refreshToken: vi.fn(),
  oauth: {
    refreshTokenGrant: vi.fn(),
  },
}))

const mockUserInfoClient = vi.hoisted(() => ({
  getUserInfo: vi.fn(),
  getProfile: vi.fn(),
}))

const mockGetUserById = vi.hoisted(() => vi.fn())

vi.mock('auth0-legacy', () => {
  return {
    AuthenticationClient: vi.fn(function () {
      return mockAuthClient
    }),
    UserInfoClient: vi.fn(function () {
      return mockUserInfoClient
    }),
  }
})

vi.mock('../../services/auth0.service', () => ({
  auth0UserService: {
    getUserById: mockGetUserById,
  },
}))

vi.mock('../../redis', () => {
  return mockRedis
})

vi.mock('../../security/index', () => {
  return {
    logSecurityEvent: vi.fn(),
    SecurityEventType: {
      TOKEN_VALIDATED: 'TOKEN_VALIDATED',
      TOKEN_VALIDATION_FAILED: 'TOKEN_VALIDATION_FAILED',
      TOKEN_REFRESHED: 'TOKEN_REFRESHED',
      TOKEN_REVOKED: 'TOKEN_REVOKED',
    },
  }
})

vi.mock('../../mcp/phase6-integration', () => {
  return {
    updatePhase6AuthenticationProgress: vi.fn(),
  }
})

import { validateToken } from '../auth0-jwt-service'

const createMockJwt = (payload: Record<string, unknown>): string => {
  const encode = (value: unknown): string =>
    Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.${encode('sig')}`
}

const tokenWithoutRoleClaim = (sub: string): string =>
  createMockJwt({
    iss: 'https://test-domain.auth0.com/',
    aud: 'test-audience',
    sub,
    exp: Math.floor(Date.now() / 1000) + 3600,
    jti: 'token-id-provider-unavailable',
    scope: 'openid profile email',
  })

/**
 * The exact shape `auth0-legacy`'s `UserInfoClient` throws: `UserInfoError`
 * carries `statusCode` and the response `headers`, including `retry-after`.
 */
const userInfoRateLimitError = (): Error =>
  Object.assign(new Error('Too Many Requests'), {
    name: 'UserInfoError',
    error: 'Too Many Requests',
    error_description: 'Too Many Requests',
    statusCode: 429,
    headers: new Headers({
      'retry-after': '112',
      'x-ratelimit-limit': '10',
      'x-ratelimit-remaining': '0',
    }),
  })

const userInfoUnauthorizedError = (): Error =>
  Object.assign(new Error('Unauthorized'), {
    name: 'UserInfoError',
    error: 'invalid_token',
    error_description: 'Unauthorized',
    statusCode: 401,
    headers: new Headers(),
  })

const neverSettles = <T>(): Promise<T> =>
  new Promise<T>(() => {
    // Intentionally never settles: the measured 8.4 s `/userinfo` tail.
  })

describe('provider-unavailable token validation', () => {
  beforeEach(() => {
    process.env.AUTH0_DOMAIN = 'test-domain.auth0.com'
    process.env.AUTH0_CLIENT_ID = 'test-client-id'
    process.env.AUTH0_CLIENT_SECRET = 'test-client-secret'
    process.env.AUTH0_AUDIENCE = 'test-audience'

    vi.clearAllMocks()
    mockRedis.getFromCache.mockReset()
    mockRedis.setInCache.mockReset()
    mockUserInfoClient.getUserInfo.mockReset()
    mockUserInfoClient.getProfile.mockReset()
    mockGetUserById.mockReset()
  })

  it('reports a /userinfo 429 as provider-unavailable, not as an invalid token', async () => {
    mockUserInfoClient.getUserInfo.mockRejectedValue(userInfoRateLimitError())

    const result = await validateToken(
      tokenWithoutRoleClaim('auth0|throttled'),
      'access',
    )

    // Never a silent pass: the provider could not verify the token.
    expect(result.valid).toBe(false)
    // Distinguishable from an authentication failure so the caller can answer
    // 503 + Retry-After instead of sending the user to /login.
    expect(result.providerUnavailable).toBe(true)
    expect(result.retryAfterSeconds).toBe(112)
  })

  it('keeps a genuine authentication failure distinguishable from a provider failure', async () => {
    mockUserInfoClient.getUserInfo.mockRejectedValue(
      userInfoUnauthorizedError(),
    )

    const result = await validateToken(
      tokenWithoutRoleClaim('auth0|revoked'),
      'access',
    )

    expect(result.valid).toBe(false)
    expect(result.providerUnavailable).toBeFalsy()
  })

  it(
    'bounds a /userinfo call that never returns',
    { timeout: 15_000 },
    async () => {
      mockUserInfoClient.getUserInfo.mockImplementation(() => neverSettles())

      const startedAt = Date.now()
      const result = await validateToken(
        tokenWithoutRoleClaim('auth0|stalled-userinfo'),
        'access',
      )
      const elapsed = Date.now() - startedAt

      expect(result.valid).toBe(false)
      expect(result.providerUnavailable).toBe(true)
      // The measured tail was 8 973 ms; the bound must be well under the 8 s
      // training deadline and the 50–66 s runtime-cancellation window.
      expect(elapsed).toBeLessThan(6_000)
    },
  )

  it(
    'bounds the Management API role lookup and still validates the token',
    { timeout: 15_000 },
    async () => {
      mockUserInfoClient.getUserInfo.mockResolvedValue({
        data: {
          iss: 'https://test-domain.auth0.com/',
          aud: 'test-audience',
          sub: 'auth0|stalled-management',
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
      })
      mockGetUserById.mockImplementation(() => neverSettles())

      const startedAt = Date.now()
      const result = await validateToken(
        tokenWithoutRoleClaim('auth0|stalled-management'),
        'access',
      )
      const elapsed = Date.now() - startedAt

      // Role enrichment is best-effort: a stalled Management API must not turn
      // a valid token into an invalid one, and must not hold the request open.
      expect(result.valid).toBe(true)
      expect(result.role).toBe('guest')
      expect(elapsed).toBeLessThan(6_000)
    },
  )

  it('single-flights the Management API lookup for concurrent validations of one subject', async () => {
    const sub = 'auth0|concurrent'
    mockUserInfoClient.getUserInfo.mockResolvedValue({
      data: {
        iss: 'https://test-domain.auth0.com/',
        aud: 'test-audience',
        sub,
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
    })
    mockGetUserById.mockImplementation(
      async () =>
        await new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                id: sub,
                role: 'user',
                appMetadata: { roles: ['therapist'] },
              }),
            25,
          )
        }),
    )

    const token = tokenWithoutRoleClaim(sub)
    const [first, second] = await Promise.all([
      validateToken(token, 'access'),
      validateToken(token, 'access'),
    ])

    expect(first.valid).toBe(true)
    expect(second.valid).toBe(true)
    expect(first.role).toBe('therapist')
    expect(second.role).toBe('therapist')
    // One Management round-trip for one subject, not one per validation.
    expect(mockGetUserById).toHaveBeenCalledTimes(1)
  })
})
