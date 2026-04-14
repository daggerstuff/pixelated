/**
 * Authentication middleware for protecting routes.
 * Uses Auth0 JWT validation via the shared auth0-jwt-service.
 */

import { getSession, isSessionValid } from '@/lib/auth/session'
import type { Session } from '@/lib/auth/session'

/**
 * Extended handler type that receives the validated Session alongside the
 * Request so inner handlers do not need a redundant token round-trip.
 */
export type AuthenticatedHandler = (
  request: Request,
  session: Session,
) => Promise<Response>

/**
 * Wrap an Astro / fetch-API handler with authentication enforcement.
 *
 * The resolved Session is passed as a second argument to the inner handler
 * so callers never need to call getSession() again.
 *
 * Usage in Astro API routes:
 *   export const GET = withAuth(async (request, session) => { ... })
 *
 * @param handler  The inner handler to call when auth passes
 * @param options  Optional configuration
 * @returns        A standard (Request) => Promise<Response> handler
 */
export function withAuth(
  handler: AuthenticatedHandler,
  options?: {
    /** Pathname prefixes that bypass auth (e.g. '/api/health') */
    allowPaths?: string[]
  },
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    // Allow unauthenticated access to explicitly whitelisted paths
    if (options?.allowPaths?.length) {
      const url = new URL(request.url)
      if (options.allowPaths.some((p) => url.pathname.startsWith(p))) {
        // Unauthenticated passthrough — create a minimal guest session
        const guestSession: Session = {
          user: { id: 'guest', role: 'guest' },
          // Future expiration ensures validity throughout the request lifecycle
          expires: new Date(
            Date.now() + 365 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        }
        return handler(request, guestSession)
      }
    }

    const session = await getSession(request)

    if (!session || !isSessionValid(session)) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Pass validated session to the handler — no second token round-trip needed
    return handler(request, session)
  }
}
