/** @vitest-environment node */

/**
 * The middleware must reuse the validated-session cache, not bypass it.
 *
 * `apps/web/src/lib/auth/session.ts` `getSession()` keeps an in-process Map
 * keyed by token with a 5-minute ceiling and short-circuits before any provider
 * call. Every page and route handler that calls `getSession` already benefits.
 * `apps/web/src/middleware.ts` `resolveCookieSession` called `validateToken`
 * directly instead, so the middleware paid one `/userinfo` round trip on every
 * authenticated request — including the twentieth navigation of the same token
 * in the same isolate. Measured on `db9b63ed1` / Worker `2207d7a1`, that
 * fan-out drained Auth0's 10-request bucket and produced 8 of the matrix's 11
 * 5xx (evidence `availability-remeasure-2026-11-10.md` §4).
 *
 * These tests count `validateToken` calls because `validateToken` is the only
 * caller of `/userinfo`: a validation that does not run performs no `/userinfo`
 * request. A warm request must therefore leave the count unchanged.
 *
 * The D1 contract is unchanged: on a cache *miss* a provider failure must stay
 * distinguishable from an invalid token, so the 503 + `Retry-After` path stays
 * reachable and a genuinely invalid token is still a logout.
 */

import { readFileSync } from 'node:fs'

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

/**
 * A token value that was never seen by any other case in this file. The
 * session cache is a module-level Map that survives between tests, so a shared
 * token would let one case warm another case's cache.
 */
const tokenFor = (name: string) => `cache-test-token-${name}`

const validValidation = () => ({
  valid: true,
  userId: 'auth0|pilot-alpha',
  role: 'therapist',
  tokenId: 'jti-alpha',
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
  payload: {
    email: 'alpha@example.test',
    name: 'Alpha Pilot',
    email_verified: true,
    picture: 'https://cdn.example.test/alpha.png',
  },
})

const invoke = async (path: string, token?: string) => {
  const headers: Record<string, string> = {}
  if (token) headers['cookie'] = `auth-token=${token}`
  const request = new Request(`http://localhost:5173${path}`, { headers })
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

describe('middleware reuses the validated-session cache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValidateToken.mockReset()
    mockGetUserById.mockReset()
  })

  it('performs zero /userinfo calls on a second request with the same token', async () => {
    mockValidateToken.mockResolvedValue(validValidation())
    mockGetUserById.mockResolvedValue({
      role: 'therapist',
      fullName: 'Alpha Pilot',
      avatarUrl: 'https://cdn.example.test/alpha.png',
    })
    const token = tokenFor('reuse')

    const first = await invoke(
      '/training/session/11111111-1111-4111-8111-111111111111',
      token,
    )
    // The cold request is the one that is allowed to reach the provider.
    expect(mockValidateToken).toHaveBeenCalledTimes(1)

    const second = await invoke(
      '/training/session/11111111-1111-4111-8111-111111111111',
      token,
    )
    // A warm request must not reach `/userinfo` at all.
    expect(mockValidateToken).toHaveBeenCalledTimes(1)

    expect(first.context.locals.user?.id).toBe('auth0|pilot-alpha')
    expect(second.context.locals.user?.id).toBe('auth0|pilot-alpha')
    expect(second.context.locals.user?.role).toBe('therapist')
    expect(second.context.locals.user?.email).toBe('alpha@example.test')
    expect(second.context.locals.session).toEqual(first.context.locals.session)
  })

  it('makes no provider call of any kind on a warm request', async () => {
    mockValidateToken.mockResolvedValue(validValidation())
    mockGetUserById.mockResolvedValue({
      role: 'therapist',
      fullName: 'Alpha Pilot',
    })
    const token = tokenFor('no-provider')

    await invoke('/training', token)
    const callsAfterCold = mockGetUserById.mock.calls.length

    await invoke('/training', token)

    expect(mockValidateToken).toHaveBeenCalledTimes(1)
    // The Management enrichment is a provider call too; the cached session
    // already carries the role that validation resolved.
    expect(mockGetUserById.mock.calls.length).toBe(callsAfterCold)
  })

  it('resolves the same identity from the cache as from the cold validation', async () => {
    mockValidateToken.mockResolvedValue(validValidation())
    mockGetUserById.mockResolvedValue({ role: 'therapist' })
    const token = tokenFor('same-identity')

    const cold = await invoke('/training', token)
    const warm = await invoke('/training', token)

    expect(warm.context.locals.user).toEqual(cold.context.locals.user)
    expect(warm.context.locals.session?.userId).toBe(
      cold.context.locals.session?.userId,
    )
    expect(warm.context.locals.session?.expiresAt).toEqual(
      cold.context.locals.session?.expiresAt,
    )
  })

  it('answers 503 + Retry-After when a cache miss cannot be verified', async () => {
    // D1: a provider failure is not an invalid token. The cache is cold for
    // this token, so the request reaches the provider and must surface the
    // retryable 503 rather than a logout.
    mockValidateToken.mockResolvedValue({
      valid: false,
      providerUnavailable: true,
      retryAfterSeconds: 112,
      error: 'Too Many Requests',
    })

    const { response, nextCalled } = await invoke(
      '/training',
      tokenFor('miss-provider-outage'),
    )

    expect(nextCalled).toBe(false)
    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('112')
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('answers the retryable 503 JSON on a session-bearing API miss', async () => {
    mockValidateToken.mockResolvedValue({
      valid: false,
      providerUnavailable: true,
      retryAfterSeconds: 114,
      error: 'Too Many Requests',
    })

    const { response, nextCalled } = await invoke(
      '/api/training/sessions/11111111-1111-4111-8111-111111111111/messages',
      tokenFor('miss-provider-outage-api'),
    )

    expect(nextCalled).toBe(false)
    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('114')
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('temporarily unavailable'),
      retryAfterSeconds: 114,
    })
  })

  it('still treats a genuinely invalid token as a logout on a cache miss', async () => {
    mockValidateToken.mockResolvedValue({
      valid: false,
      error: 'Invalid audience',
    })

    const { response, nextCalled, context } = await invoke(
      '/training',
      tokenFor('miss-invalid-token'),
    )

    expect(nextCalled).toBe(true)
    expect(response.status).toBe(200)
    expect(context.locals.user).toBeUndefined()
    expect(context.locals.session).toBeUndefined()
    // The verdict is published so a page component can decide from it rather
    // than validating the same token again.
    expect(context.locals['sessionValidation']).toEqual({ status: 'invalid' })
  })

  it('never consults the provider or the cache without a token', async () => {
    const { nextCalled, context } = await invoke('/training')

    expect(nextCalled).toBe(true)
    expect(mockValidateToken).not.toHaveBeenCalled()
    expect(context.locals['sessionValidation']).toEqual({ status: 'none' })
  })
})

/**
 * One provider round-trip must yield the verdict, including on the failure
 * paths. Reading the cache and then classifying the same token with a second
 * validation made every unverifiable cold request pay two `/userinfo` calls:
 * 5 001 ms at two 2 500 ms deadlines on `8397bdff6` / Worker `7ea1640e`, and
 * two of the ten requests Auth0's bucket allows. That is the mechanism behind
 * the residual `VAL-HANG-001` failure.
 */
describe('one provider round-trip classifies a cold request', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValidateToken.mockReset()
    mockGetUserById.mockReset()
  })

  it('performs exactly one validation when a cold token cannot be verified', async () => {
    mockValidateToken.mockResolvedValue({
      valid: false,
      providerUnavailable: true,
      retryAfterSeconds: 112,
      error: 'Too Many Requests',
    })

    const { response, nextCalled } = await invoke(
      '/training',
      tokenFor('single-call-outage'),
    )

    expect(mockValidateToken).toHaveBeenCalledTimes(1)
    expect(nextCalled).toBe(false)
    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('112')
  })

  it('performs exactly one validation when a cold token is invalid', async () => {
    mockValidateToken.mockResolvedValue({
      valid: false,
      error: 'Invalid audience',
    })

    const { response, nextCalled, context } = await invoke(
      '/training',
      tokenFor('single-call-invalid'),
    )

    expect(mockValidateToken).toHaveBeenCalledTimes(1)
    expect(nextCalled).toBe(true)
    expect(response.status).toBe(200)
    expect(context.locals.user).toBeUndefined()
    expect(context.locals.session).toBeUndefined()
  })

  it('costs one validation per request while the provider is down', async () => {
    // A provider verdict is never cached, so the next request must re-validate
    // — once, not twice. This also proves the collapse added no cache.
    mockValidateToken.mockResolvedValue({
      valid: false,
      providerUnavailable: true,
      retryAfterSeconds: 30,
      error: 'Too Many Requests',
    })
    const token = tokenFor('single-call-outage-series')

    await invoke('/training', token)
    await invoke('/training', token)

    expect(mockValidateToken).toHaveBeenCalledTimes(2)
  })
})

describe('no second cache was introduced', () => {
  const source = readFileSync(
    new URL('../../../middleware.ts', import.meta.url),
    'utf8',
  )

  it('reuses the shipped session cache through its verdict-returning entry point', () => {
    expect(source).toMatch(/validateSessionToken/)
    expect(source).toMatch(/from '\.\/lib\/auth\/session'/)
  })

  it('never validates the same token a second time to classify it', () => {
    // `validateToken` is the only `/userinfo` caller. The middleware must reach
    // it only through `session.ts`, so a cache miss is classified by the one
    // call that was already made.
    expect(source).not.toMatch(/\bvalidateToken\s*\(/)
  })

  it('declares no cache of its own and no TTL', () => {
    expect(source).not.toMatch(/new Map</)
    expect(source).not.toMatch(/_TTL_MS|MAX_TTL|EVICT_BUFFER/)
  })
})
