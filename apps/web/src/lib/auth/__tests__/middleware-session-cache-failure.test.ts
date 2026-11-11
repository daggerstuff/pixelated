/** @vitest-environment node */

/**
 * The middleware's session resolution is a single, bounded provider trip.
 *
 * `resolveCookieSession` asks `lib/auth/session.ts` for a verdict — valid,
 * invalid, or provider-unavailable — and that entry point performs at most one
 * `/userinfo` verification per request. The middleware no longer reads the
 * cache and then re-validates to classify a miss, so an unverifiable cold
 * request costs one provider call instead of two.
 *
 * These cases pin the middleware's side of that contract independently of the
 * real cache: a cached session maps to `locals` without a provider call, a
 * provider outage stays a retryable 503, and an unexpected resolver failure is
 * a miss rather than a 500.
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

const mockValidateSessionToken = vi.hoisted(() => vi.fn())

vi.mock('../session', () => ({
  SESSION_VERDICT_LOCALS_KEY: 'sessionValidation',
  validateSessionToken: mockValidateSessionToken,
}))

vi.mock('../../middleware/rate-limit', () => ({
  rateLimitMiddleware: (_context: unknown, next: () => unknown) => next(),
}))

import { onRequest } from '../../../middleware'

const validSession = () => ({
  user: {
    id: 'auth0|pilot-beta',
    email: 'beta@example.test',
    role: 'therapist',
    roles: ['therapist'],
    name: 'Beta Pilot',
  },
  expires: new Date(Date.now() + 120_000).toISOString(),
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

describe('validated-session resolution failures', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValidateSessionToken.mockReset()
  })

  it('treats an unexpected resolver failure as unauthenticated, not a 500', async () => {
    mockValidateSessionToken.mockRejectedValue(
      new Error('cache backend unreachable'),
    )

    const { response, nextCalled, context } = await invoke('/training')

    expect(response.status).toBe(200)
    expect(nextCalled).toBe(true)
    expect(mockValidateSessionToken).toHaveBeenCalledTimes(1)
    expect(context.locals.user).toBeUndefined()
    expect(context.locals.session).toBeUndefined()
  })

  it('still answers 503 when the resolver reports a provider outage', async () => {
    mockValidateSessionToken.mockResolvedValue({
      status: 'provider-unavailable',
      retryAfterSeconds: 112,
    })

    const { response, nextCalled } = await invoke('/training')

    expect(nextCalled).toBe(false)
    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('112')
  })

  it('maps a resolved session to locals without a provider call', async () => {
    mockValidateSessionToken.mockResolvedValue({
      status: 'valid',
      session: validSession(),
    })

    const { nextCalled, context } = await invoke('/training')

    expect(nextCalled).toBe(true)
    // Exactly one resolution for the request; the middleware never validates
    // the token a second time.
    expect(mockValidateSessionToken).toHaveBeenCalledTimes(1)
    expect(mockValidateSessionToken).toHaveBeenCalledWith('failure-mode-token')
    expect(context.locals.user).toEqual({
      id: 'auth0|pilot-beta',
      email: 'beta@example.test',
      emailVerified: false,
      role: 'therapist',
      fullName: 'Beta Pilot',
    })
    expect(context.locals.session?.userId).toBe('auth0|pilot-beta')
    expect(context.locals.session?.id).toBe('sess-auth0|pilot-beta')
    // The verdict is published for page-level reads.
    expect(context.locals['sessionValidation']).toMatchObject({
      status: 'valid',
    })
  })
})
