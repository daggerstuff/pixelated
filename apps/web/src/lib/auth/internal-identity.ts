/**
 * Internal identity resolution for API route handlers.
 *
 * `getSession()` exposes the identity provider's subject as `user.id`
 * (the Auth0 `sub`, e.g. `auth0|abc123`). Every session ownership predicate
 * compares against `sessions.therapist_id`, which is a `uuid` column, so the
 * subject must be translated to the platform `users.id` UUID first.
 *
 * This is the same bridge `auth0-middleware.ts` already uses for the routes
 * listed in `routeAuthConfig` (`apps/web/src/middleware.ts`): the canonical
 * `resolveIdentity()` resolver backed by `auth_accounts`, Redis-cached, and
 * provisioning on first login.
 *
 * Resolution failures are reported as `null` so callers can deny the request
 * with a 401/403/404 instead of surfacing a database error as a 5xx.
 */

import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { resolveIdentity } from './user-identity'

const logger = createBuildSafeLogger('internal-identity')

export interface SessionPrincipal {
  id?: string | null
  email?: string
  role?: string
}

/**
 * Map an authenticated principal's provider subject to the internal
 * `users.id` UUID.
 *
 * @returns the internal UUID, or `null` when the identity cannot be resolved
 */
export async function resolveInternalUserId(
  principal: SessionPrincipal | null | undefined,
): Promise<string | null> {
  const sub = principal?.id
  if (typeof sub !== 'string' || sub.length === 0) return null

  try {
    const identity = await resolveIdentity({
      sub,
      email: principal?.email ?? '',
      emailVerified: false,
      role: principal?.role,
    })
    return identity.internalId ?? null
  } catch (error) {
    // Never leak a resolution failure as a 5xx: the caller treats a null
    // internal id as an unauthenticated/unmapped principal.
    logger.error('Failed to resolve internal user identity', {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}
