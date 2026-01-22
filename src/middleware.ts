import { generateCspNonce } from './lib/middleware/csp'
import { securityHeaders } from './lib/middleware/securityHeaders'
import { sequence, defineMiddleware } from 'astro:middleware'
import { tracingMiddleware } from './lib/tracing/middleware'
import { markSpanError } from './lib/tracing/utils'
import { authenticateRequest } from './lib/auth/auth0-middleware'


// Simple route matcher for protected API routes and journal-research pages
const protectedRoutePatterns: RegExp[] = [
  /\/api\/protected(.*)/,
  /\/api\/journal-research(.*)/, // Protect journal-research API endpoints
  /\/journal-research(.*)/, // Protect journal-research pages
]

function isProtectedRoute(request: Request) {
  try {
    const url = new URL(request.url)
    const { pathname } = url

    // Allow public API routes (auth endpoints, health checks, etc.)
    if (pathname.startsWith('/api/auth/')) {
      return false
    }

    // Allow health check endpoints (used by smoke tests and monitoring)
    if (pathname.includes('/health') || pathname.endsWith('/health')) {
      return false
    }

    return protectedRoutePatterns.some((r) => r.test(pathname))
  } catch (err) {
    // If URL parsing fails, be conservative and treat as not protected
    // Log the error for observability without exposing PII
    markSpanError(err instanceof Error ? err : new Error(String(err)))
    return false
  }
}

/**
 * Auth middleware that uses Auth0 for authentication.
 * If a request targets a protected route and there's no valid Auth0 session, return 401.
 */
const projectAuthMiddleware = defineMiddleware(async (context, next) => {
  const { request } = context

  // Allow non-protected routes through quickly
  if (!isProtectedRoute(request)) {
    return next()
  }

  // Check authentication using Auth0
  try {
    const authResult = await authenticateRequest(request)

    if (!authResult.success) {
      // If authentication failed, return the response from Auth0 middleware
      if (authResult.response) {
        return authResult.response
      }

      // Fallback to 401 if no response provided
      return new Response(
        JSON.stringify({ error: authResult.error || 'Authentication required' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Store user data in locals for use in routes
    if (context.locals && authResult.request?.user) {
      context.locals.user = {
        ...authResult.request.user,
        emailVerified: authResult.request.user.emailVerified ?? false
      }
    }
  } catch (err) {
    // If authentication check fails, treat as unauthenticated
    markSpanError(err instanceof Error ? err : new Error(String(err)))
    return new Response(
      JSON.stringify({ error: 'Authentication failed' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  return next()
})

// Single, clean middleware sequence
// Tracing middleware is first to capture all requests
export const onRequest = sequence(
  tracingMiddleware as any,
  generateCspNonce as any,
  securityHeaders as any,
  projectAuthMiddleware as any,
)
