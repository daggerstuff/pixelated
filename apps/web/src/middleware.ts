import type { MiddlewareHandler } from 'astro'
import { sequence, defineMiddleware } from 'astro:middleware'

import {
  authenticateRequest,
  type AuthOptions,
} from './lib/auth/auth0-middleware'
import { apiVersioningMiddleware } from './lib/middleware/api-versioning'
import { corsMiddleware } from './lib/middleware/cors'
import { generateCspNonce } from './lib/middleware/csp'
import { rateLimitMiddleware } from './lib/middleware/rate-limit'
import { securityHeaders } from './lib/middleware/securityHeaders'
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

// Route authentication configuration
// Defines which routes require authentication and what strategy/scopes to use
const routeAuthConfig: RouteConfig[] = [
  {
    pattern: /\/api\/v1\/(.*)/,
    strategy: 'either',
    requiredScopes: ['api:read'],
  },
  { pattern: /\/api\/protected(.*)/, strategy: 'jwtOnly' },
  { pattern: /\/api\/journal-research(.*)/, strategy: 'jwtOnly' },
  { pattern: /\/api\/agent-notes(.*)/, strategy: 'jwtOnly' },
  { pattern: /\/api\/chat(.*)/, strategy: 'jwtOnly' },
  { pattern: /\/api\/patient-rights(.*)/, strategy: 'jwtOnly' },
  { pattern: /\/api\/treatment-plans(.*)/, strategy: 'jwtOnly' },
  { pattern: /\/api\/crisis(.*)/, strategy: 'jwtOnly' },
  { pattern: /\/api\/mental-health(.*)/, strategy: 'jwtOnly' },
  { pattern: /\/api\/bias-detection(.*)/, strategy: 'jwtOnly' },
  { pattern: /\/api\/therapy(.*)/, strategy: 'jwtOnly' },
  { pattern: /\/api\/sessions(.*)/, strategy: 'jwtOnly' },
  { pattern: /\/api\/emotions(.*)/, strategy: 'jwtOnly' },
  { pattern: /\/api\/interventions(.*)/, strategy: 'jwtOnly' },
  { pattern: /\/api\/users\/(.*)/, strategy: 'jwtOnly' },
  { pattern: /\/api\/consent(.*)/, strategy: 'jwtOnly' },
  { pattern: /\/api\/audit(.*)/, strategy: 'jwtOnly' },
  { pattern: /\/journal-research(.*)/, strategy: 'jwtOnly' },
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

    // Allow non-protected routes through quickly
    if (!routeConfig) {
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
  normalizeRequestHeadersMiddleware,
  tracingMiddleware,
  generateCspNonce,
  securityHeaders,
  corsMiddleware,
  internalRouteGate,
  projectAuthMiddleware,
  rateLimitMiddleware,
  apiVersioningMiddleware,
)
