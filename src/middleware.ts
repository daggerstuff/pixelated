import { generateCspNonce } from './lib/middleware/csp'
import { securityHeaders } from './lib/middleware/securityHeaders'
import { sequence, defineMiddleware } from 'astro:middleware'
import { getSession } from './lib/auth/session'
import { tracingMiddleware } from './lib/tracing/middleware'
import { markSpanError } from './lib/tracing/utils'


// Simple route matcher for protected API routes and journal-research pages
const protectedRoutePatterns: RegExp[] = [
  /\/api\/protected(.*)/,
  /\/api\/journal-research(.*)/, // Protect journal-research API endpoints
  /\/journal-research(.*)/, // Protect journal-research pages
]

function isProtectedRoute(request: Request) {
  try {
    const url = new URL(request.url)
    const {pathname} = url

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
 * Auth middleware that uses the project's session system.
 * If a request targets a protected route and there's no session, redirect to sign-in.
 */
const projectAuthMiddleware = defineMiddleware(async (context, next) => {
  const { request } = context

  // Allow non-protected routes through quickly
  if (!isProtectedRoute(request)) {
    return next()
  }

  // Check session using existing auth/session utilities
  try {
    const session = await getSession(request)
    if (!session) {
      // Redirect to a local sign-in page; include original url so it can return after login
      const signInUrl = new URL('/auth/sign-in', request.url)
      signInUrl.searchParams.set('redirect', request.url)
      return new Response(null, {
        status: 302,
        headers: { Location: signInUrl.toString() },
      })
    }

    // Store session data in locals for use in routes
    if (context.locals) {
      ; (context.locals as any).user = session.user
        ; (context.locals as any).session = session.session
    }
  } catch (err) {
    // If session check fails treat as unauthenticated for protected routes
    markSpanError(err instanceof Error ? err : new Error(String(err)))
    const signInUrl = new URL('/auth/sign-in', request.url)
    signInUrl.searchParams.set('redirect', request.url)
    return new Response(null, {
      status: 302,
      headers: { Location: signInUrl.toString() },
    })
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
