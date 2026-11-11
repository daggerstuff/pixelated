/** @vitest-environment node */

/**
 * The middleware half of the `/login` redirect repair (diagnosis D1).
 *
 * When `/userinfo` cannot verify a token — a 429, a timeout, a 5xx — the
 * middleware must answer a bounded, distinguishable `503` with `Retry-After`
 * on surfaces that require a session, instead of leaving `locals` empty so the
 * page component redirects an authenticated user to `/login` (a logout).
 *
 * Scope guards matter as much as the 503: a genuinely invalid token must keep
 * its existing treatment, and a public page or the sign-in endpoint must never
 * turn into a 503 because a signed-in browser carried a cookie during an Auth0
 * outage.
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

import { onRequest } from '../../../middleware'

const providerUnavailable = {
  valid: false,
  providerUnavailable: true,
  retryAfterSeconds: 112,
  error: 'Too Many Requests',
}

const invalidToken = {
  valid: false,
  error: 'Invalid audience',
}

const requestWithCookie = (path: string): Request =>
  new Request(`http://localhost:5173${path}`, {
    headers: { cookie: 'auth-token=test-token' },
  })

const requestWithBearer = (path: string): Request =>
  new Request(`http://localhost:5173${path}`, {
    headers: { authorization: 'Bearer test-token' },
  })

const invokeRequest = async (request: Request) => {
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

const invoke = (path: string) => invokeRequest(requestWithCookie(path))

const invokeWithBearer = (path: string) =>
  invokeRequest(requestWithBearer(path))

describe('provider-unavailable session resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValidateToken.mockReset()
    mockGetUserById.mockReset()
  })

  it('answers 503 + Retry-After on /training instead of letting the page redirect to /login', async () => {
    mockValidateToken.mockResolvedValue(providerUnavailable)

    const { response, nextCalled } = await invoke('/training')

    expect(nextCalled).toBe(false)
    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('112')
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('answers 503 + Retry-After on the training session page', async () => {
    mockValidateToken.mockResolvedValue(providerUnavailable)

    const { response, nextCalled } = await invoke(
      '/training/session/33333333-3333-4333-8333-333333333333',
    )

    expect(nextCalled).toBe(false)
    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('112')
  })

  it('answers a retryable 503 JSON on an authenticated API route', async () => {
    mockValidateToken.mockResolvedValue(providerUnavailable)

    const { response, nextCalled } = await invoke(
      '/api/training/sessions/33333333-3333-4333-8333-333333333333/messages',
    )

    expect(nextCalled).toBe(false)
    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('112')
    expect(response.headers.get('content-type')).toContain('application/json')
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('temporarily unavailable'),
      retryAfterSeconds: 112,
    })
  })

  it('leaves a public API route alone during a provider outage', async () => {
    // Only the namespaces whose handlers resolve a session may turn an outage
    // into a 503. A public endpoint must not fail because the browser happened
    // to carry a cookie.
    mockValidateToken.mockResolvedValue(providerUnavailable)

    const { response, nextCalled } = await invoke('/api/analytics/dashboard')

    expect(nextCalled).toBe(true)
    expect(response.status).toBe(200)
  })

  it('does not turn a genuinely invalid token into a 503', async () => {
    mockValidateToken.mockResolvedValue(invalidToken)

    const { response, nextCalled } = await invoke('/training')

    expect(nextCalled).toBe(true)
    expect(response.status).toBe(200)
  })

  it('leaves public pages alone when a signed-in browser carries a cookie', async () => {
    mockValidateToken.mockResolvedValue(providerUnavailable)

    const { response, nextCalled } = await invoke('/')

    expect(nextCalled).toBe(true)
    expect(response.status).toBe(200)
  })

  it('leaves the sign-in endpoint alone during a provider outage', async () => {
    mockValidateToken.mockResolvedValue(providerUnavailable)

    const { response, nextCalled } = await invoke('/api/auth/signin')

    expect(nextCalled).toBe(true)
    expect(response.status).toBe(200)
  })
})

/**
 * GAP-34: the `routeAuthConfig` class is authenticated by `authenticateRequest`,
 * which used to fold "the provider could not answer" into "the token is bad" and
 * answer 401. One condition must have one status contract per route class.
 */
describe('provider-unavailable on routeAuthConfig routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValidateToken.mockReset()
    mockGetUserById.mockReset()
  })

  it('answers a retryable JSON 503 on an authenticated API route, never a 401', async () => {
    mockValidateToken.mockResolvedValue(providerUnavailable)

    const { response, nextCalled } =
      await invokeWithBearer('/api/chat/messages')

    expect(nextCalled).toBe(false)
    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('112')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('content-type')).toContain('application/json')
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('temporarily unavailable'),
      retryAfterSeconds: 112,
    })
  })

  it('answers a retryable text 503 on a page route in routeAuthConfig', async () => {
    mockValidateToken.mockResolvedValue(providerUnavailable)

    const { response, nextCalled } = await invokeWithBearer(
      '/journal-research/sessions',
    )

    expect(nextCalled).toBe(false)
    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('112')
    expect(response.headers.get('content-type')).toContain('text/plain')
  })

  it('keeps a genuinely invalid token a 401 on a routeAuthConfig route', async () => {
    mockValidateToken.mockResolvedValue(invalidToken)

    const { response, nextCalled } =
      await invokeWithBearer('/api/chat/messages')

    expect(nextCalled).toBe(false)
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Invalid audience',
    })
  })
})

/**
 * GAP-34, page half: `/dashboard` and `/sessions` are session-required pages
 * that the outage classifier did not cover, so an outage left `locals` empty
 * and the surface treated the user as signed out.
 */
describe('provider-unavailable on the other session-required pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValidateToken.mockReset()
    mockGetUserById.mockReset()
  })

  it('answers 503 + Retry-After on /dashboard', async () => {
    mockValidateToken.mockResolvedValue(providerUnavailable)

    const { response, nextCalled } = await invoke('/dashboard')

    expect(nextCalled).toBe(false)
    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('112')
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('answers 503 + Retry-After on a /dashboard sub-page', async () => {
    mockValidateToken.mockResolvedValue(providerUnavailable)

    const { response, nextCalled } = await invoke('/dashboard/session-progress')

    expect(nextCalled).toBe(false)
    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('112')
  })

  it('answers 503 + Retry-After on /sessions', async () => {
    mockValidateToken.mockResolvedValue(providerUnavailable)

    const { response, nextCalled } = await invoke('/sessions')

    expect(nextCalled).toBe(false)
    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('112')
  })

  it('keeps a genuinely invalid token unauthenticated on /dashboard', async () => {
    mockValidateToken.mockResolvedValue(invalidToken)

    const { response, nextCalled } = await invoke('/dashboard')

    expect(nextCalled).toBe(true)
    expect(response.status).toBe(200)
  })
})
