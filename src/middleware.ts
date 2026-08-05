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
  '/brutalist-demo',
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
  { pattern: /\/api\/journal-research(.*)/, strategy: 'jwtOnly' }, // Protect journal-research API endpoints
  { pattern: /\/api\/agent-notes(.*)/, strategy: 'jwtOnly' }, // Protect agent note collaboration APIs
  { pattern: /\/journal-research(.*)/, strategy: 'jwtOnly' }, // Protect journal-research pages
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
