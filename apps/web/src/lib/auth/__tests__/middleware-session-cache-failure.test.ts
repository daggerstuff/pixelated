/** @vitest-environment node */

/**
 * A cache backend failure must degrade to the authoritative validation.
 *
 * The validated-session cache is an optimisation on the request path. If its
 * backend throws, the middleware must treat the read as a miss and validate the
 * token, never fail the request. `getSession` itself only throws from its cache
 * backend, so this guard is the difference between a cache outage and a 500.
 *
 * The hit-path mapping is also pinned here, independently of the real cache:
 * a `Session` must produce the same `locals` identity fields the validation
 * path produces, without a provider call.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('astro:middleware', () => ({
  sequence:
    (...handlers: any[]) =>
    async (context: any, next: any) => {
      let index = 0
      const dispatch: any = async () => {
        if (index >= handlers.length) return next()
        const handler = handlers[index++]
        return handler(context, dispatch)
      }
      return dispatch()
    },
  defineMiddleware: (fn: any) => fn,
}))

const mockValidateToken = vi.hoisted(() => vi.fn())
const mockGetUserById = vi.hoisted(() => vi.fn())
const mockGetSession = vi.hoisted(() => vi.fn())

vi.mock('../auth0-jwt-service', () => ({
  validateToken: mockValidateToken,
}))

vi.mock('../../services/auth0.service', () => ({
  auth0UserService: {
    getUserById: mockGetUserById,
  },
}))

vi.mock('../../middleware/rate-limit', () => ({
  rateLimitMiddleware: (_context: unknown, next: () => unknown) => next(),
}))

vi.mock('../session', () => ({
  getSession: mockGetSession,
}))

import { onRequest } from '../../../middleware'

const validValidation = () => ({
  valid: true,
  userId: 'auth0|pilot-beta',
  role: 'therapist',
  tokenId: 'jti-beta',
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
  payload: {
    email: 'beta@example.test',
    name: 'Beta Pilot',
    email_verified: true,
  },
})

const invoke = async (path: string, token = 'failure-mode-token') => {
  const request = new Request(`http://localhost:5173${path}`, {
    headers: { cookie: `auth-token=${token}` },
  })
  const context: any = {
    request,
    url: new URL(request.url),
    locals: {},
    redirect: (location: string, status = 302) =>
      new Response(null, { status, headers: { Location: location } }),
  }
  let nextCalled = false
  const next = async () => {
    nextCalled = true
    return new Response('ok', { status: 200 })
  }
  const response = await onRequest(context, next)
  return { response, nextCalled, context }
}

describe('validated-session cache failures', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValidateToken.mockReset()
    mockGetUserById.mockReset()
    mockGetSession.mockReset()
  })

  it('falls back to validation when the cache backend throws', async () => {
    mockGetSession.mockRejectedValue(new Error('cache backend unreachable'))
    mockValidateToken.mockResolvedValue(validValidation())
    mockGetUserById.mockResolvedValue({ role: 'therapist' })

    const { response, nextCalled, context } = await invoke('/training')

    expect(response.status).toBe(200)
    expect(nextCalled).toBe(true)
    expect(mockValidateToken).toHaveBeenCalledTimes(1)
    expect(context.locals.user?.id).toBe('auth0|pilot-beta')
    expect(context.locals.user?.role).toBe('therapist')
  })

  it('still answers 503 when the cache throws and the provider cannot verify', async () => {
    mockGetSession.mockRejectedValue(new Error('cache backend unreachable'))
    mockValidateToken.mockResolvedValue({
      valid: false,
      providerUnavailable: true,
      retryAfterSeconds: 112,
      error: 'Too Many Requests',
    })

    const { response, nextCalled } = await invoke('/training')

    expect(nextCalled).toBe(false)
    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('112')
  })

  it('maps a cached session to locals without a provider call', async () => {
    mockGetSession.mockResolvedValue({
      user: {
        id: 'auth0|pilot-beta',
        email: 'beta@example.test',
        role: 'therapist',
        roles: ['therapist'],
        name: 'Beta Pilot',
      },
      expires: new Date(Date.now() + 120_000).toISOString(),
    })

    const { nextCalled, context } = await invoke('/training')

    expect(nextCalled).toBe(true)
    expect(mockValidateToken).not.toHaveBeenCalled()
    expect(mockGetUserById).not.toHaveBeenCalled()
    expect(context.locals.user).toEqual({
      id: 'auth0|pilot-beta',
      email: 'beta@example.test',
      emailVerified: false,
      role: 'therapist',
      fullName: 'Beta Pilot',
    })
    expect(context.locals.session?.userId).toBe('auth0|pilot-beta')
    expect(context.locals.session?.id).toBe('sess-auth0|pilot-beta')
  })
})
