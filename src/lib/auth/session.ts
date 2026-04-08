/**
 * Session management utilities for authentication system
 * Handles session verification, user info retrieval, and token management
 */

import { userManager } from '../db'
import { extractTokenFromRequest } from './auth0-middleware'
import { validateToken, type TokenValidationResult } from './auth0-jwt-service'


/**
 * Lightweight session shape returned by getSession and consumed by middleware
 * and API route handlers across the application.
 */
export interface Session {
  user: {
    id: string
    email?: string
    role: string
    name?: string
  }
  /** ISO-8601 timestamp when the session expires */
  expires: string
}

/**
 * Short-lived in-process cache for validated Auth0 tokens.
 *
 * Keyed by the raw token string. Each entry stores the resolved Session and
 * the epoch millisecond time when this cache entry should be evicted (30 s
 * before the token's actual expiry, matching the Auth0 clock-skew allowance).
 *
 * This avoids a full Auth0 round-trip on every request for the same token
 * without sacrificing revocation safety — the 30-second floor means a
 * revoked token is accepted for at most ~30 s after revocation in the worst
 * case. Tighten SESSION_CACHE_EVICT_BUFFER_MS if stricter revocation is required.
 */
interface TokenCacheEntry {
  session: Session
  evictAt: number
}
const SESSION_CACHE_EVICT_BUFFER_MS = 5 * 1_000 // Reduced from 30s to 5s for stricter verification
const SESSION_CACHE_MAX_TTL_MS = 5 * 60 * 1_000 // Re-validate every 5 minutes even if token is still valid
const tokenCache = new Map<string, TokenCacheEntry>()

/**
 * Minimal JWT payload shape used internally when building a Session from a
 * raw decoded token. Not the same as a next-auth JWT.
 */
type TokenPayload = Awaited<ReturnType<typeof validateToken>> & { payload?: Record<string, unknown> }

/**
 * Build a Session from an already-validated token result.
 * @param result Validation result from validateToken()
 * @returns Session object or null if the token is not usable
 */
export function getSessionFromToken(result: TokenPayload): Session | null {
  if (!result.valid || !result.userId) return null

  const expiresAt = result.expiresAt
    ? new Date(result.expiresAt * 1000).toISOString()
    : new Date(Date.now() + 60 * 60 * 1000).toISOString()

  return {
    user: {
      id: result.userId,
      email: result.payload?.['email'] as string | undefined,
      role: result.role ?? 'guest',
      name: result.payload?.['name'] as string | undefined,
    },
    expires: expiresAt,
  }
}

/**
 * Verify session is valid and not at risk of expiry.
 *
 * Returns false if the session has already expired OR if it will expire within
 * the next EXPIRY_BUFFER_MS milliseconds. The buffer protects in-flight
 * requests on a medical platform where token expiry mid-request could expose
 * PHI transiently. Callers that need a strict (no-buffer) expiry check should
 * compare `session.expires` directly against `Date.now()`.
 *
 * @param session Session object
 * @returns true when the session is valid and not expiring imminently
 */
export function isSessionValid(session: Session): boolean {
  if (!session?.expires) return false

  const EXPIRY_BUFFER_MS = 5 * 60 * 1000 // 5-minute safety buffer for in-flight requests
  const expiresDate = new Date(session.expires)
  return Date.now() < expiresDate.getTime() - EXPIRY_BUFFER_MS
}

/**
 * Get user profile from database using user ID
 * @param userId User ID from session
 * @returns User profile or null
 */
export async function getUserProfile(userId: string) {
  try {
    const user = await userManager.getUserById(userId)

    if (!user) {
      console.error('User not found:', userId)
      return null
    }

    return {
      id: user.id,
      email: user.email,
      fullName: `${user.first_name} ${user.last_name}`,
      avatarUrl: user.avatar_url,
      role: user.role,
    }
  } catch (error: unknown) {
    console.error('Error in getUserProfile:', error)
    return null
  }
}



/**
 * Get user role for permission checks
 * @param session Session object
 * @returns User role string or null
 */
export function getUserRole(session: Session): string | null {
  return session?.user?.role ?? null
}

/**
 * Check if user has a specific permission/role
 * @param session Session object
 * @param requiredRole Role that's required
 * @returns boolean indicating if user has required role
 */
export function hasRole(session: Session, requiredRole: string): boolean {
  const userRole = getUserRole(session)
  return userRole === requiredRole
}

/**
 * Resolve a Session from the incoming HTTP Request.
 *
 * Extraction order:
 *   1. Authorization: Bearer <token> header
 *   2. ?token= query parameter (WebSocket handshake)
 *   3. auth_token / auth-token cookie
 *
 * On the first call for a given token the full Auth0 JWT validation round-trip
 * is performed. Successful results are cached in-process until 30 s before the
 * token's expiry time (see SESSION_CACHE_EVICT_BUFFER_MS). Subsequent calls
 * with the same token bypass the network and return from the cache.
 *
 * @param request - The incoming Web API Request
 * @returns A Session or null when unauthenticated
 */
export async function getSession(request: Request): Promise<Session | null> {
  const token = extractTokenFromRequest(request)
  if (!token) return null

  // --- Cache hit path ---
  const cached = tokenCache.get(token)
  if (cached) {
    if (Date.now() < cached.evictAt) {
      return cached.session
    }
    // Entry has passed its eviction threshold — remove and re-validate
    tokenCache.delete(token)
  }

  // --- Cache miss: authoritative Auth0 round-trip ---
  try {
    const result = await validateToken(token, 'access')
    if (!result.valid || !result.userId) return null

    // Cache until SESSION_CACHE_EVICT_BUFFER_MS before token expiry, but enforce
    // a maximum session cache TTL to detect administrative revocation.
    const tokenExpiresAt = result.expiresAt ? result.expiresAt * 1000 : Date.now() + 60 * 60 * 1_000
    const evictAt = Math.min(
      tokenExpiresAt - SESSION_CACHE_EVICT_BUFFER_MS,
      Date.now() + SESSION_CACHE_MAX_TTL_MS,
    )

    const session = {
      user: {
        id: result.userId,
        role: result.role ?? 'guest',
        email: result.payload?.email as string | undefined,
        name: result.payload?.name as string | undefined,
      },
      // Use the calculated eviction time for the session object's expiration
      // to avoid returning a session that claims to be valid but is evicted.
      expires: new Date(evictAt).toISOString(),
    } satisfies Session

    tokenCache.set(token, { session, evictAt })

    return session
  } catch {
    // Any validation error (network, key mismatch, expiry) is treated as
    // unauthenticated — do not leak error details to the caller
    return null
  }
}
