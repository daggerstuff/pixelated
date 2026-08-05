/** @vitest-environment node */

/**
 * PIX-4245: getCurrentUser must not treat AstroCookies as Request.
 * AstroCookies has a `headers()` method; the old `"headers" in context` check
 * misclassified cookies and threw on GET /register.
 */

import type { AstroCookies } from 'astro'
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../../../config/auth.config', () => ({
  authConfig: {
    cookies: { accessToken: 'access_token' },
  },
}))

vi.mock('../../../services/auth0.service', () => ({
  getUserById: vi.fn(),
}))

vi.mock('../../logging/build-safe-logger', () => ({
  createBuildSafeLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('../auth0-jwt-service', () => ({
  validateToken: vi.fn(async () => ({ valid: false })),
}))

vi.mock('../auth0-middleware', () => ({
  extractTokenFromRequest: vi.fn(() => null),
}))

vi.mock('@/lib/db/developer-api-keys', () => ({
  developerApiKeyManager: {
    validateApiKey: vi.fn(async () => ({ valid: false })),
  },
}))

vi.mock('../session', () => ({
  getSession: vi.fn(),
}))

import { getCurrentUser } from '../index'

function createMockAstroCookies(
  cookieValues: Record<string, string | undefined> = {},
): AstroCookies {
  return {
    get: (key: string) => {
      const value = cookieValues[key]
      return value === undefined ? undefined : { value }
    },
    has: (key: string) => cookieValues[key] !== undefined,
    set: vi.fn(),
    delete: vi.fn(),
    merge: vi.fn(),
    headers: vi.fn(function* () {
      yield ''
    }),
    consume: vi.fn(function* () {
      yield ''
    }),
  } as unknown as AstroCookies
}

describe('getCurrentUser — AstroCookies vs Request (PIX-4245)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not throw when passed AstroCookies (register page pattern)', async () => {
    const cookies = createMockAstroCookies()
    await expect(getCurrentUser(cookies)).resolves.toBeNull()
  })

  it('reads auth token from AstroCookies when not a Web Request', async () => {
    const { validateToken } = await import('../auth0-jwt-service')
    vi.mocked(validateToken).mockResolvedValueOnce({
      valid: true,
      userId: 'user-123',
      role: 'therapist',
    })

    const cookies = createMockAstroCookies({ auth_token: 'jwt-token' })
    const user = await getCurrentUser(cookies)

    expect(user).toEqual({
      id: 'user-123',
      role: 'therapist',
      accountId: undefined,
      workspaceId: undefined,
    })
  })

  it('uses Request headers when passed a Web API Request', async () => {
    const { extractTokenFromRequest } = await import('../auth0-middleware')
    vi.mocked(extractTokenFromRequest).mockReturnValueOnce('from-header')

    const { validateToken } = await import('../auth0-jwt-service')
    vi.mocked(validateToken).mockResolvedValueOnce({
      valid: true,
      userId: 'user-from-request',
      role: 'patient',
    })

    const request = new Request('https://example.com/register', {
      headers: { Authorization: 'Bearer ignored' },
    })

    const user = await getCurrentUser(request)

    expect(extractTokenFromRequest).toHaveBeenCalledWith(request)
    expect(user?.id).toBe('user-from-request')
  })
})
