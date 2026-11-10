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

const invoke = async (path: string) => {
  const request = requestWithCookie(path)
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
