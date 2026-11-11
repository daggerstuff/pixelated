import type { MiddlewareHandler } from 'astro'
import { sequence, defineMiddleware } from 'astro:middleware'

import {
  authenticateRequest,
  extractTokenFromRequest,
  type AuthOptions,
} from './lib/auth/auth0-middleware'
import {
  SESSION_VERDICT_LOCALS_KEY,
  validateSessionToken,
  type SessionValidation,
} from './lib/auth/session'
import { canonicalHostRedirect } from './lib/http/canonicalHost'
import { agentDiscoveryMiddleware } from './lib/middleware/agent-discovery'
import { apiVersioningMiddleware } from './lib/middleware/api-versioning'
import { corsMiddleware } from './lib/middleware/cors'
import { generateCspNonce } from './lib/middleware/csp'
import { rateLimitMiddleware } from './lib/middleware/rate-limit'
import { securityHeaders } from './lib/middleware/securityHeaders'
import {
  excludedApiRefusal,
  isExcludedSurface,
  readRuntimeEnv,
  resolveExcludedSurfaceFlag,
} from './lib/pilot/excludedSurface'
import { tracingMiddleware } from './lib/tracing/middleware'
import { markSpanError } from './lib/tracing/utils'
import { normalizeRequestHeaders } from './lib/utils/request-headers'

interface RouteConfig extends AuthOptions {
  pattern: RegExp
}

// Internal, test, and dev-only pages that must never be reachable in
// production. The public demo funnel (/demo-hub, /demo/*, /components/*) is
// intentionally NOT listed — live marketing CTAs point at it.
const internalOnlyRoutes = new Set([
  '/test-sentry',
  '/admin-test',
  '/nightmare-fuel-demo',
  '/style-guide',
  '/search-demo',
  '/therapy-chat-plan',
])

const internalOnlyPrefixes = ['/dev/', '/browser-compatibility/']

/**
 * In production, rewrite internal/test-only pages to the 404 page.
 * Uses next('/404') so the rest of the middleware chain still runs.
 */
const internalRouteGate: MiddlewareHandler = defineMiddleware(
  (context, next) => {
    if (!import.meta.env.PROD) {
      return next()
    }
    const pathname = context.url.pathname.replace(/\/+$/, '') || '/'
    const blocked =
      internalOnlyRoutes.has(pathname) ||
      internalOnlyPrefixes.some((prefix) => pathname.startsWith(prefix)) ||
      pathname === '/dev' ||
      pathname === '/browser-compatibility'
    if (blocked) {
      return next('/404')
    }
    return next()
  },
)

const normalizeRequestHeadersMiddleware: MiddlewareHandler = defineMiddleware(
  (context, next) => {
    normalizeRequestHeaders(context.request as unknown as { headers?: unknown })
    return next()
  },
)

// The apex is canonical. www used to be served by the Vercel standby, which now
// answers 402 DEPLOYMENT_DISABLED; the Worker route covers www so it redirects
// here instead of failing at the origin.
const wwwRedirect: MiddlewareHandler = defineMiddleware((context, next) => {
  const target = canonicalHostRedirect(context.url)
  if (!target) {
    return next()
  }
  return new Response(null, {
    status: 301,
    headers: { Location: target.toString() },
  })
})

// Sits before auth so an excluded route never spends the provider validation
// budget; inert unless PILOT_EXCLUDED_SURFACE opts a release in.
function excludedSurfaceEnabledFor(locals: unknown): boolean {
  return resolveExcludedSurfaceFlag({
    processEnv: typeof process === 'undefined' ? undefined : process.env,
    buildEnv: import.meta.env as unknown as Record<string, unknown>,
    runtimeEnv: readRuntimeEnv(locals),
  })
}

const pilotSurfaceGate: MiddlewareHandler = defineMiddleware(
  (context, next) => {
    const { pathname } = context.url
    if (!isExcludedSurface(pathname)) {
      return next()
    }
    if (!excludedSurfaceEnabledFor(context.locals)) {
      return next()
    }
    const refusal = excludedApiRefusal(pathname)
    if (refusal) {
      return new Response(refusal.body, {
        status: refusal.status,
        headers: refusal.headers,
      })
    }
    return next('/404')
  },
)

// Route authentication configuration
// Defines which routes require authentication and what strategy/scopes to use
// Patterns are anchored so only actual API/page routes match; unanchored
// /api/* patterns also matched page routes like /docs/api/audit and wrongly
// forced JWT auth on public docs pages.
const routeAuthConfig: RouteConfig[] = [
  {
    pattern: /^\/api\/v1\/(.*)/,
    strategy: 'either',
    requiredScopes: ['api:read'],
  },
  { pattern: /^\/api\/protected(.*)/, strategy: 'jwtOnly' },
  { pattern: /^\/api\/journal-research(.*)/, strategy: 'jwtOnly' },
  { pattern: /^\/api\/agent-notes(.*)/, strategy: 'jwtOnly' },
  { pattern: /^\/api\/chat(.*)/, strategy: 'jwtOnly' },
  { pattern: /^\/api\/patient-rights(.*)/, strategy: 'jwtOnly' },
  { pattern: /^\/api\/treatment-plans(.*)/, strategy: 'jwtOnly' },
  { pattern: /^\/api\/crisis(.*)/, strategy: 'jwtOnly' },
  { pattern: /^\/api\/mental-health(.*)/, strategy: 'jwtOnly' },
  { pattern: /^\/api\/bias-detection(.*)/, strategy: 'jwtOnly' },
  { pattern: /^\/api\/therapy(.*)/, strategy: 'jwtOnly' },
  { pattern: /^\/api\/sessions(.*)/, strategy: 'jwtOnly' },
  { pattern: /^\/api\/emotions(.*)/, strategy: 'jwtOnly' },
  { pattern: /^\/api\/interventions(.*)/, strategy: 'jwtOnly' },
  { pattern: /^\/api\/users\/(.*)/, strategy: 'jwtOnly' },
  { pattern: /^\/api\/consent(.*)/, strategy: 'jwtOnly' },
  { pattern: /^\/api\/audit(.*)/, strategy: 'jwtOnly' },
  { pattern: /^\/journal-research(.*)/, strategy: 'jwtOnly' },
]

function getRouteConfig(request: Request): RouteConfig | null {
  try {
    const url = new URL(request.url)
    const { pathname } = url

    // Allow public API routes (auth endpoints, health checks, etc.)
    if (pathname.startsWith('/api/auth/')) {
      return null
    }

    // Allow health check endpoints (used by smoke tests and monitoring)
    if (pathname.includes('/health') || pathname.endsWith('/health')) {
      return null
    }

    return (
      routeAuthConfig.find((config) => config.pattern.test(pathname)) ?? null
    )
  } catch (err) {
    // If URL parsing fails, be conservative and treat as not protected
    // Log the error for observability without exposing PII
    markSpanError(err instanceof Error ? err : new Error(String(err)))
    return null
  }
}

/** Fallback `Retry-After` when the provider sent no usable value. */
const PROVIDER_RETRY_AFTER_DEFAULT_SECONDS = 30

/**
 * Page prefixes whose own guard treats "no session" as "send the user to
 * `/login`". A provider outage must not be rendered as a logout on these
 * surfaces (diagnosis D1).
 */
function isSessionRequiredPage(pathname: string): boolean {
  return (
    pathname.startsWith('/admin') ||
    pathname === '/training' ||
    pathname.startsWith('/training/')
  )
}

/**
 * API namespaces whose handlers resolve the cookie session themselves.
 *
 * Only these may answer a provider outage with a 503: the handler would
 * otherwise see an empty session and report a 401, which the client renders as
 * a logout (diagnosis D1). Every other `/api/*` route is public, covered by
 * `routeAuthConfig`, or authenticated by an API key, so a provider outage must
 * not turn it into a 503 for a browser that happens to carry a cookie.
 */
const SESSION_BEARING_API_PREFIXES = [
  '/api/ai/',
  '/api/crisis/',
  '/api/export/',
  '/api/patient-rights/',
  '/api/training/',
  '/api/ws/',
] as const

function isSessionBearingApiRoute(pathname: string): boolean {
  if (pathname === '/api/session' || pathname.startsWith('/api/session/')) {
    return true
  }
  return SESSION_BEARING_API_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  )
}

function providerUnavailableResponse(
  pathname: string,
  retryAfterSeconds: number,
): Response {
  const retryAfter = String(Math.max(1, Math.ceil(retryAfterSeconds)))
  if (pathname.startsWith('/api/')) {
    return new Response(
      JSON.stringify({
        error: 'Authentication provider temporarily unavailable',
        retryAfterSeconds: Number(retryAfter),
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': retryAfter,
          'Cache-Control': 'no-store',
        },
      },
    )
  }
  return new Response(
    'Authentication is temporarily unavailable. Please retry shortly.\n',
    {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Retry-After': retryAfter,
        'Cache-Control': 'no-store',
      },
    },
  )
}

type CookieSessionResolution =
  | { status: 'none' }
  | { status: 'resolved' }
  | { status: 'provider-unavailable'; retryAfterSeconds: number }

/**
 * Resolve a token to its verdict, treating an unexpected failure as a miss.
 *
 * `validateSessionToken` already folds provider and cache errors into a
 * verdict; this guard only protects the middleware's documented best-effort
 * contract — any failure leaves `locals` untouched and the request continues
 * unauthenticated — from an unforeseen throw.
 */
async function readSessionVerdict(token: string): Promise<SessionValidation> {
  try {
    return await validateSessionToken(token)
  } catch {
    return { status: 'invalid' }
  }
}

/**
 * Resolve a cookie-based session for a page route and populate
 * `context.locals.user` / `context.locals.session`.
 *
 * Page routes are guarded by the page component itself (which reads
 * `Astro.locals.session`/`user`), so without this a browser holding only the
 * `auth-token` cookie set by `/api/auth/signin` would always be bounced to
 * `/login`. Best-effort: any failure leaves `locals` untouched and the request
 * continues unauthenticated.
 *
 * The one failure that is *not* "unauthenticated" is a provider outage: a
 * `/userinfo` 429, a 5xx, or a timeout means the token could not be checked,
 * not that it is invalid. That is returned as `provider-unavailable` so the
 * caller can answer a retryable 503 rather than a logout.
 *
 * One provider round-trip decides the request. The validated-session cache
 * that every other authenticated surface already uses (`lib/auth/session.ts`:
 * an in-process Map keyed by the token, with a 5-minute ceiling) is read first;
 * only a miss reaches Auth0, and that miss *classifies* — valid, invalid, or
 * provider-unavailable. This used to be two calls: a cache read through
 * `getSession` and then a second validation to classify the miss. Every cold
 * request that could not be verified therefore paid two `/userinfo` calls —
 * 5 001 ms at two 2 500 ms deadlines on `8397bdff6` / Worker `7ea1640e`, and
 * two of the ten requests Auth0's `/userinfo` bucket allows. That is the
 * mechanism behind the residual `VAL-HANG-001` failure.
 */
async function resolveCookieSession(context: {
  request: Request
  locals: App.Locals
}): Promise<CookieSessionResolution> {
  const token = extractTokenFromRequest(context.request)
  if (!token) {
    // Publish the verdict so a page component can distinguish "no token" from
    // "middleware did not run" without validating anything.
    context.locals[SESSION_VERDICT_LOCALS_KEY] = { status: 'none' }
    return { status: 'none' }
  }

  const resolution = await readSessionVerdict(token)

  // Publish the verdict the middleware computed. Page-level reads use it
  // instead of re-validating the same token, so one request never pays two
  // `/userinfo` round trips (a cold `/training` cost middleware 1 + page 1,
  // and an invalid token on `/training/session/<id>` cost 2).
  context.locals[SESSION_VERDICT_LOCALS_KEY] = resolution

  if (resolution.status === 'provider-unavailable') {
    return {
      status: 'provider-unavailable',
      retryAfterSeconds:
        resolution.retryAfterSeconds ?? PROVIDER_RETRY_AFTER_DEFAULT_SECONDS,
    }
  }
  if (resolution.status !== 'valid' || !resolution.session) {
    return { status: 'none' }
  }

  // A valid token — from the cache or from this request's single validation.
  // The session carries the id, email, role and name that validation resolved,
  // including the role resolved through the Management API, which validation
  // performs once and caches per subject.
  const session = resolution.session
  context.locals.user = {
    id: session.user.id,
    email: session.user.email ?? '',
    // The validated-session cache does not carry the `email_verified` claim.
    // No consumer in the application reads this field from `locals.user`.
    emailVerified: false,
    role: session.user.role,
    fullName: session.user.name,
  }
  context.locals.session = {
    id: `sess-${session.user.id}`,
    userId: session.user.id,
    // The cache entry evicts at or before the token's own expiry
    // (`computeEvictAt`), so this never overstates the session lifetime.
    expiresAt: new Date(session.expires),
  }

  return { status: 'resolved' }
}

/**
 * Auth middleware that uses Auth0 or API Keys for authentication.
 * If a request targets a protected route and there's no valid session, return 401/403.
 */
const projectAuthMiddleware: MiddlewareHandler = defineMiddleware(
  async (context, next) => {
    const { request } = context

    // E2E test-auth bypass — ONLY active when E2E_TEST_AUTH=1 (set exclusively
    // in the bias-detection CI workflow). Lets Playwright exercise the admin
    // dashboard end-to-end without an Auth0 tenant: the test cookie is issued
    // by POST /api/auth/signin when it accepts the seeded test credentials.
    // Never activate in production: the env var is not set there, and the
    // cookie value is never minted by any real auth path. E2E_TEST_AUTH is
    // only set in the bias-detection CI workflow.
    if (process.env['E2E_TEST_AUTH'] === '1') {
      const e2eToken = process.env['E2E_TEST_TOKEN']
      if (!e2eToken) {
        return next()
      }
      const cookieHeader = request.headers.get('cookie') ?? ''
      if (cookieHeader.includes(`auth-token=${e2eToken}`)) {
        const e2eUser = {
          id: `e2e-${e2eToken.slice(0, 8)}`,
          email: 'test@example.com',
          emailVerified: true,
          role: 'admin',
          fullName: 'E2E Test Admin',
        }
        context.locals.user = e2eUser
        context.locals.session = {
          id: `e2e-session-${e2eToken.slice(0, 8)}`,
          userId: e2eUser.id,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        }
        return next()
      }
    }

    const routeConfig = getRouteConfig(request)

    // Allow non-protected routes through quickly, but first attempt to resolve
    // a cookie-based session for page routes (e.g. /admin/*). API routes are
    // handled by routeAuthConfig above; page routes are guarded by the page
    // component itself, which reads Astro.locals.session/user.
    if (!routeConfig) {
      const resolution = await resolveCookieSession(context)
      const pathname = context.url.pathname

      // A provider outage is not a logout. On a surface that requires a
      // session, answer a bounded, retryable 503 + Retry-After instead of
      // leaving `locals` empty so the page redirects to /login (diagnosis D1).
      if (
        resolution.status === 'provider-unavailable' &&
        (isSessionRequiredPage(pathname) || isSessionBearingApiRoute(pathname))
      ) {
        return providerUnavailableResponse(
          pathname,
          resolution.retryAfterSeconds,
        )
      }

      // Guard /admin pages at middleware layer to prevent ResponseSentError
      // from AdminLayout (which cannot safely return Astro.redirect from a layout).
      // Middleware runs before any component rendering, so a redirect here avoids
      // the "Response has already been sent" crash seen in PIXEL-ASTRO-S.
      try {
        if (pathname.startsWith('/admin')) {
          const sessionUser = context.locals.user
          const sessionData = context.locals.session
          if (!sessionUser || !sessionData) {
            const redirectPath = `/login?redirect=${encodeURIComponent(pathname)}`
            if (typeof context.redirect === 'function') {
              return context.redirect(redirectPath, 302)
            }
            return new Response(null, {
              status: 302,
              headers: { Location: redirectPath },
            })
          }
        }
      } catch {
        // URL parsing failure — fall through to page render
      }
      return next()
    }

    // Check authentication using the specified strategy and scopes
    try {
      const authResult = await authenticateRequest(request, {
        strategy: routeConfig.strategy,
        requiredScopes: routeConfig.requiredScopes,
      })

      if (!authResult.success) {
        // If authentication failed, return the response from Auth0 middleware
        if (authResult.response) {
          return authResult.response
        }

        // Fallback to 401 if no response provided
        return new Response(
          JSON.stringify({
            error: authResult.error ?? 'Authentication required',
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      if (authResult.request?.user) {
        // Create the user object first, then assign with proper typing
        const userData = {
          ...authResult.request.user,
          emailVerified: authResult.request.user.emailVerified ?? false,
        }
        context.locals.user = userData
      }
    } catch (err) {
      // If authentication check fails, treat as unauthenticated
      markSpanError(err instanceof Error ? err : new Error(String(err)))
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return next()
  },
)

// Single, clean middleware sequence
// Tracing middleware is first to capture all requests
// Rate limiting is placed after auth so we can use role-based limits
export const onRequest = sequence(
  wwwRedirect,
  normalizeRequestHeadersMiddleware,
  tracingMiddleware,
  generateCspNonce,
  securityHeaders,
  corsMiddleware,
  internalRouteGate,
  pilotSurfaceGate,
  projectAuthMiddleware,
  rateLimitMiddleware,
  apiVersioningMiddleware,
  agentDiscoveryMiddleware,
)
