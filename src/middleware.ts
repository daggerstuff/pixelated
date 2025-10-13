import { generateCspNonce } from './lib/middleware/csp'
import { securityHeaders } from './lib/middleware/securityHeaders'
import { sequence } from 'astro/middleware'
import { getSession } from './lib/auth/session'

// Simple route matcher for protected API routes
const protectedRoutePatterns: RegExp[] = [
  /\/api\/protected(.*)/,
]

function isProtectedRoute(request: Request) {
  try {
    const url = new URL(request.url)
    return protectedRoutePatterns.some((r) => r.test(url.pathname))
  } catch (_err) {
    // If URL parsing fails, be conservative and treat as not protected
    return false
  }
}

/**
 * Auth middleware that uses the project's session system.
 * If a request targets a protected route and there's no session, redirect to sign-in.
 */
const projectAuthMiddleware = async (context: Record<string, unknown>, next: () => Promise<Response>) => {
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
  } catch (_err) {
    // If session check fails treat as unauthenticated for protected routes
    const signInUrl = new URL('/auth/sign-in', request.url)
    signInUrl.searchParams.set('redirect', request.url)
    return new Response(null, {
      status: 302,
      headers: { Location: signInUrl.toString() },
    })
  }

  return next()
}

// Single, clean middleware sequence
export const onRequest = sequence(generateCspNonce, securityHeaders, projectAuthMiddleware)
