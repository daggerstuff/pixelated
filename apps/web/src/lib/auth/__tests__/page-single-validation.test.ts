/** @vitest-environment node */

/**
 * One provider validation per request, across the middleware **and** the page.
 *
 * Measured on `1580a719f` / Worker `186b655f` (evidence
 * `availability-remeasure-1580a719f-2026-11-10.md` §2.1 and
 * `research/followup-mission-2026-11-10.md`):
 *
 *  - a cold authenticated `GET /training` costs **two** `/userinfo`
 *    validations — the middleware's (1) plus `getCurrentUser`'s own
 *    `validateToken` (1). `getCurrentUser` never consulted the validated-session
 *    cache the middleware had just populated.
 *  - an invalid token on `GET /training/session/<id>` costs **two** — the
 *    middleware resolves it once and declines to redirect, then the page's own
 *    `getSession` re-validates the same token to decide again.
 *
 * The fix publishes the verdict the middleware already computed on
 * `Astro.locals` and routes page-level reads through it. These tests count
 * `validateToken` calls because `validateToken` is the only caller of
 * `/userinfo`: a validation that does not run performs no provider request.
 *
 * They drive the **real** `onRequest` middleware and the **real** session
 * cache, mocking only the provider call, so the counts are the counts a
 * request would produce rather than a mock's.
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
const mockValidateApiKey = vi.hoisted(() => vi.fn())

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

vi.mock('@/lib/db/developer-api-keys', () => ({
  developerApiKeyManager: {
    validateApiKey: mockValidateApiKey,
  },
}))

import { onRequest } from '../../../middleware'
import { getCurrentUser } from '../index'
import { readSessionVerdictFromLocals, resolvePageSession } from '../session'

/**
 * The session cache is a module-level Map that survives between tests, so every
 * case uses its own token.
 */
const tokenFor = (name: string) => `page-single-validation-token-${name}`

const validValidation = () => ({
  valid: true,
  userId: 'auth0|pilot-delta',
  role: 'therapist',
  tokenId: 'jti-delta',
  accountId: 'acct-delta',
  workspaceId: 'ws-delta',
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
  payload: {
    email: 'delta@example.test',
    name: 'Delta Pilot',
    app_metadata: { workspaceId: 'ws-delta', roles: ['therapist'] },
  },
})

const requestWith = (path: string, token?: string) => {
  const headers: Record<string, string> = {}
  if (token) headers['cookie'] = `auth-token=${token}`
  return new Request(`http://localhost:5173${path}`, { headers })
}

/** Run the real middleware chain for one page request. */
const invoke = async (path: string, token?: string) => {
  const request = requestWith(path, token)
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
  return { response, nextCalled, context, request }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockValidateToken.mockReset()
  mockGetUserById.mockReset()
  mockValidateApiKey.mockReset()
})

describe('a cold /training load validates once across middleware and page', () => {
  it('performs exactly one validation for the whole request', async () => {
    mockValidateToken.mockResolvedValue(validValidation())
    mockGetUserById.mockResolvedValue({ role: 'therapist' })
    const token = tokenFor('cold-training')

    const { context, request } = await invoke('/training', token)
    // The middleware's single validation is the request's provider round trip.
    expect(mockValidateToken).toHaveBeenCalledTimes(1)

    const page = await resolvePageSession(request, context.locals)

    // The page-level read must not reach the provider again.
    expect(mockValidateToken).toHaveBeenCalledTimes(1)
    expect(page.providerUnavailable).toBe(false)
    expect(page.session?.user).toMatchObject({
      id: 'auth0|pilot-delta',
      role: 'therapist',
    })
    expect(page.session?.accountId).toBe('acct-delta')
    expect(page.session?.workspaceId).toBe('ws-delta')
  })

  it('preserves the accountId contract from the same single validation', async () => {
    mockValidateToken.mockResolvedValue(validValidation())
    mockGetUserById.mockResolvedValue({ role: 'therapist' })

    const { context, request } = await invoke(
      '/training',
      tokenFor('account-id-contract'),
    )
    const page = await resolvePageSession(request, context.locals)

    // `accountId` is not on the Session's user object; it is carried on the
    // cached session from the validation result that produced it.
    expect(page.session?.accountId).toBe('acct-delta')
  })

  it('performs zero further validations on a warm request', async () => {
    mockValidateToken.mockResolvedValue(validValidation())
    mockGetUserById.mockResolvedValue({ role: 'therapist' })
    const token = tokenFor('warm-training')

    const cold = await invoke('/training', token)
    await resolvePageSession(cold.request, cold.context.locals)
    expect(mockValidateToken).toHaveBeenCalledTimes(1)

    const warm = await invoke('/training', token)
    await resolvePageSession(warm.request, warm.context.locals)

    // Warm: the middleware reads the cache and the page reads the verdict.
    expect(mockValidateToken).toHaveBeenCalledTimes(1)
  })
})

describe('page-level reads never re-validate what the middleware classified', () => {
  it('costs one validation for a cold session page load', async () => {
    mockValidateToken.mockResolvedValue(validValidation())
    mockGetUserById.mockResolvedValue({ role: 'therapist' })

    const { context, request } = await invoke(
      '/training/session/11111111-1111-4111-8111-111111111111',
      tokenFor('cold-session-page'),
    )
    expect(mockValidateToken).toHaveBeenCalledTimes(1)

    const page = await resolvePageSession(request, context.locals)

    expect(mockValidateToken).toHaveBeenCalledTimes(1)
    expect(page.session?.user.id).toBe('auth0|pilot-delta')
    expect(page.providerUnavailable).toBe(false)
  })

  it('costs one validation for an invalid token on the session page', async () => {
    // Before: the middleware resolved 1 and the page's own getSession
    // re-validated 1 after the middleware declined to redirect. Total 2.
    mockValidateToken.mockResolvedValue({
      valid: false,
      error: 'Invalid audience',
    })

    const { context, request, nextCalled } = await invoke(
      '/training/session/11111111-1111-4111-8111-111111111111',
      tokenFor('invalid-session-page'),
    )
    expect(nextCalled).toBe(true)
    expect(mockValidateToken).toHaveBeenCalledTimes(1)
    expect(readSessionVerdictFromLocals(context.locals)).toEqual({
      status: 'invalid',
    })

    const page = await resolvePageSession(request, context.locals)

    // The page decides from the middleware's verdict: no second round trip.
    expect(mockValidateToken).toHaveBeenCalledTimes(1)
    expect(page.session).toBeNull()
    expect(page.providerUnavailable).toBe(false)
  })

  it('costs one validation for an invalid token on /training', async () => {
    mockValidateToken.mockResolvedValue({
      valid: false,
      error: 'Invalid audience',
    })

    const { context, request } = await invoke(
      '/training',
      tokenFor('invalid-training-page'),
    )
    const page = await resolvePageSession(request, context.locals)

    expect(mockValidateToken).toHaveBeenCalledTimes(1)
    expect(page.session).toBeNull()
  })

  it('resolves an X-API-Key developer when the request carries no token', async () => {
    mockValidateApiKey.mockResolvedValue({
      valid: true,
      api_key: { user_id: 'dev-1', scopes: ['api:read'] },
    })

    // A key is not a token, so the middleware publishes a `none` verdict.
    const { context } = await invoke('/training')
    const request = new Request('http://localhost:5173/training', {
      headers: { 'X-API-Key': 'test-api-key' },
    })

    const page = await resolvePageSession(request, context.locals)

    expect(mockValidateToken).not.toHaveBeenCalled()
    expect(page.session).toBeNull()
    expect(page.developer).toEqual({
      id: 'dev-1',
      role: 'developer',
      scopes: ['api:read'],
    })
  })

  it('treats a failing key validation as no developer', async () => {
    mockValidateApiKey.mockRejectedValue(new Error('pool exhausted'))

    const { context } = await invoke('/training')
    const request = new Request('http://localhost:5173/training', {
      headers: { 'X-API-Key': 'test-api-key' },
    })

    const page = await resolvePageSession(request, context.locals)

    expect(page.session).toBeNull()
    expect(page.developer).toBeNull()
  })

  it('reports a provider outage from the verdict without another call', async () => {
    mockValidateToken.mockResolvedValue({
      valid: false,
      providerUnavailable: true,
      retryAfterSeconds: 112,
      error: 'Too Many Requests',
    })

    const { context, request, response, nextCalled } = await invoke(
      '/training/session/11111111-1111-4111-8111-111111111111',
      tokenFor('outage-session-page'),
    )

    // The middleware answers the retryable 503 on a session-required page.
    expect(nextCalled).toBe(false)
    expect(response.status).toBe(503)
    expect(readSessionVerdictFromLocals(context.locals)).toEqual({
      status: 'provider-unavailable',
      retryAfterSeconds: 112,
    })

    const page = await resolvePageSession(request, context.locals)

    expect(mockValidateToken).toHaveBeenCalledTimes(1)
    expect(page.session).toBeNull()
    expect(page.providerUnavailable).toBe(true)
  })

  it('makes no provider call without a token and reports no session', async () => {
    const { context, request } = await invoke('/training')

    expect(mockValidateToken).not.toHaveBeenCalled()
    expect(readSessionVerdictFromLocals(context.locals)).toEqual({
      status: 'none',
    })

    const page = await resolvePageSession(request, context.locals)

    expect(mockValidateToken).not.toHaveBeenCalled()
    expect(page.session).toBeNull()
    expect(page.providerUnavailable).toBe(false)
  })
})

describe('getCurrentUser consults the validated-session cache', () => {
  it('validates once for two cold reads of the same token', async () => {
    mockValidateToken.mockResolvedValue(validValidation())
    mockGetUserById.mockResolvedValue({ role: 'therapist' })
    const token = tokenFor('get-current-user-cache')

    const first = await getCurrentUser(requestWith('/training', token))
    const second = await getCurrentUser(requestWith('/training', token))

    expect(mockValidateToken).toHaveBeenCalledTimes(1)
    expect(first).toEqual(second)
    expect(first?.accountId).toBe('acct-delta')
  })

  it('still returns API-key scopes from the API-key path', async () => {
    mockValidateApiKey.mockResolvedValue({
      valid: true,
      api_key: { user_id: 'dev-1', scopes: ['api:read', 'admin'] },
    })

    const request = new Request('http://localhost:5173/training', {
      headers: { 'X-API-Key': 'test-api-key' },
    })
    const user = await getCurrentUser(request)

    expect(user).toEqual({
      id: 'dev-1',
      role: 'admin',
      scopes: ['api:read', 'admin'],
    })
    // The API-key path must not spend a provider validation.
    expect(mockValidateToken).not.toHaveBeenCalled()
  })
})

describe('the pages use the verdict instead of re-reading the token', () => {
  const trainingPage = readFileSync(
    new URL('../../../pages/training/index.astro', import.meta.url),
    'utf8',
  )
  const sessionPage = readFileSync(
    new URL(
      '../../../pages/training/session/[sessionId].astro',
      import.meta.url,
    ),
    'utf8',
  )

  it('reads both training pages through the shared page-session helper', () => {
    expect(trainingPage).toMatch(
      /resolvePageSession\(\s*Astro\.request,\s*Astro\.locals,?\s*\)/,
    )
    expect(sessionPage).toMatch(
      /resolvePageSession\(\s*Astro\.request,\s*Astro\.locals,?\s*\)/,
    )
  })

  it('never calls validateToken from a page component', () => {
    expect(trainingPage).not.toMatch(/\bvalidateToken\s*\(/)
    expect(sessionPage).not.toMatch(/\bvalidateToken\s*\(/)
  })
})
