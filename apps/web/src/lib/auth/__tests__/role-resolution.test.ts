/** @vitest-environment node */

/**
 * Role resolution: `session.user.role` must carry the identity's real role.
 *
 * The access token minted by the password grant carries no
 * `https://pixelated.empathy/app_metadata` claim, so `extractRoleFromPayload`
 * alone returns `guest` for every production identity. `validateToken` must
 * enrich the role from the same Auth0 Management API lookup the page middleware
 * already performs (`middleware.ts` `resolveCookieSession`), and keep `guest`
 * as the fallback when the role cannot be resolved.
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

// `auth0-jwt-service` constructs its clients from `auth0-legacy`.
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

// The Management API lookup the repair reuses. Resolved from the same module
// path `auth0-jwt-service` imports dynamically.
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
import { getSessionFromToken } from '../session'

const createMockJwt = (payload: Record<string, unknown>): string => {
  const encode = (value: unknown): string =>
    Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.${encode('sig')}`
}

const withStandardClaims = (
  overrides: Record<string, unknown>,
): Record<string, unknown> => ({
  iss: 'https://test-domain.auth0.com/',
  aud: 'test-audience',
  ...overrides,
})

/**
 * An access token as the password grant actually issues it: standard claims
 * only, no namespaced `app_metadata`/`user_metadata` claim, no `permissions`.
 */
const tokenWithoutRoleClaim = (sub: string): string =>
  createMockJwt(
    withStandardClaims({
      sub,
      exp: Math.floor(Date.now() / 1000) + 3600,
      jti: 'token-id-role-resolution',
      scope: 'openid profile email',
    }),
  )

describe('role resolution via the Auth0 Management API', () => {
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

  it('resolves therapist from app_metadata when the token carries no role claim', async () => {
    const sub = 'auth0|synthetic-org-a'
    const token = tokenWithoutRoleClaim(sub)
    mockUserInfoClient.getUserInfo.mockResolvedValue({
      data: withStandardClaims({
        sub,
        exp: Math.floor(Date.now() / 1000) + 3600,
        jti: 'token-id-role-resolution',
      }),
    })
    // Shape returned by `auth0UserService.getUserById()` for the synthetic
    // identity: the raw Management API app_metadata plus the service's
    // normalized role (`user` is its no-metadata default).
    mockGetUserById.mockResolvedValue({
      id: sub,
      role: 'user',
      appMetadata: { roles: ['therapist'] },
    })

    const result = await validateToken(token, 'access')

    expect(result.valid).toBe(true)
    expect(result.role).toBe('therapist')
    expect(mockGetUserById).toHaveBeenCalledWith(sub)

    // The session assembles `user.role`/`user.roles` from the validated result.
    const session = getSessionFromToken(result)
    expect(session?.user.role).toBe('therapist')
    expect(session?.user.roles).toEqual(['therapist'])
  })

  it('maps a capitalized Management API role case-insensitively', async () => {
    const sub = 'auth0|synthetic-org-b'
    const token = tokenWithoutRoleClaim(sub)
    mockUserInfoClient.getUserInfo.mockResolvedValue({
      data: withStandardClaims({ sub }),
    })
    mockGetUserById.mockResolvedValue({
      id: sub,
      role: 'user',
      appMetadata: { roles: ['Therapist'] },
    })

    const result = await validateToken(token, 'access')

    expect(result.role).toBe('therapist')
  })

  it('falls back to guest when the Management API carries no role metadata', async () => {
    const sub = 'auth0|no-role-identity'
    const token = tokenWithoutRoleClaim(sub)
    mockUserInfoClient.getUserInfo.mockResolvedValue({
      data: withStandardClaims({ sub }),
    })
    // `role: 'user'` is `extractRoleFromUser`'s default when no role metadata
    // exists; it must not be mistaken for a resolved role.
    mockGetUserById.mockResolvedValue({
      id: sub,
      role: 'user',
      appMetadata: {},
    })

    const result = await validateToken(token, 'access')

    expect(result.valid).toBe(true)
    expect(result.role).toBe('guest')
  })

  it('falls back to guest when the Management API lookup returns null', async () => {
    const sub = 'auth0|unknown-identity'
    const token = tokenWithoutRoleClaim(sub)
    mockUserInfoClient.getUserInfo.mockResolvedValue({
      data: withStandardClaims({ sub }),
    })
    mockGetUserById.mockResolvedValue(null)

    const result = await validateToken(token, 'access')

    expect(result.valid).toBe(true)
    expect(result.role).toBe('guest')
    // `null` is also what a failed lookup returns, so it must not be cached.
    expect(mockRedis.setInCache).not.toHaveBeenCalled()
  })

  it('falls back to guest when the Management API lookup throws', async () => {
    const sub = 'auth0|management-unavailable'
    const token = tokenWithoutRoleClaim(sub)
    mockUserInfoClient.getUserInfo.mockResolvedValue({
      data: withStandardClaims({ sub }),
    })
    mockGetUserById.mockRejectedValue(
      new Error('Auth0 management client not initialized'),
    )

    const result = await validateToken(token, 'access')

    expect(result.valid).toBe(true)
    expect(result.role).toBe('guest')
  })

  it('does not consult the Management API when the token already carries a role claim', async () => {
    const sub = 'auth0|claim-bearing-identity'
    const payload = withStandardClaims({
      sub,
      'exp': Math.floor(Date.now() / 1000) + 3600,
      'jti': 'token-id-role-resolution',
      'https://pixelated.empathy/app_metadata': { roles: ['admin'] },
    })
    mockUserInfoClient.getUserInfo.mockResolvedValue({ data: payload })

    const result = await validateToken(createMockJwt(payload), 'access')

    expect(result.role).toBe('admin')
    expect(mockGetUserById).not.toHaveBeenCalled()
  })

  it('reuses a cached role without consulting the Management API', async () => {
    const sub = 'auth0|cached-role'
    mockUserInfoClient.getUserInfo.mockResolvedValue({
      data: withStandardClaims({ sub }),
    })
    mockRedis.getFromCache.mockResolvedValue('therapist')

    const result = await validateToken(tokenWithoutRoleClaim(sub), 'access')

    expect(result.valid).toBe(true)
    expect(result.role).toBe('therapist')
    expect(mockGetUserById).not.toHaveBeenCalled()
  })

  it('caches a role resolved from the Management API', async () => {
    const sub = 'auth0|role-cached-after-lookup'
    mockUserInfoClient.getUserInfo.mockResolvedValue({
      data: withStandardClaims({ sub }),
    })
    mockGetUserById.mockResolvedValue({
      id: sub,
      role: 'user',
      appMetadata: { roles: ['therapist'] },
    })

    const result = await validateToken(tokenWithoutRoleClaim(sub), 'access')

    expect(result.role).toBe('therapist')
    expect(mockRedis.setInCache).toHaveBeenCalledWith(
      `auth0:role:${sub}`,
      'therapist',
      expect.any(Number),
    )
  })

  it('does not cache a guest downgrade when the Management API fails', async () => {
    const sub = 'auth0|throttled-management'
    mockUserInfoClient.getUserInfo.mockResolvedValue({
      data: withStandardClaims({ sub }),
    })
    mockGetUserById.mockRejectedValue(new Error('rate limited'))

    const result = await validateToken(tokenWithoutRoleClaim(sub), 'access')

    expect(result.valid).toBe(true)
    expect(result.role).toBe('guest')
    expect(mockRedis.setInCache).not.toHaveBeenCalled()
  })
})
