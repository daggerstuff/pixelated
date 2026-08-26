/**
 * Session management utilities for authentication system
 * Handles session verification, user info retrieval, and token management
 *
 * Session cache supports two backends controlled by USE_REDIS_SESSIONS env var:
 *   - true:  Redis-backed (via src/lib/redis.ts) — required for horizontal scaling
 *   - false: In-process Map (legacy, default)
 *
 * When USE_REDIS_SESSIONS=true, reads check Redis first and fall back to the
 * in-process cache for a dual-write migration window. Writes always go to both
 * backends so the migration is zero-downtime.
 */

import { userManager } from '../db'
import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { getFromCache, setInCache, removeFromCache } from '../redis'
import { validateToken } from './auth0-jwt-service'
import { extractTokenFromRequest } from './auth0-middleware'
const logger = createBuildSafeLogger('session')

/**
 * Lightweight session shape returned by getSession and consumed by middleware
 * and API route handlers across the application.
 *
 * PIX-215 PR3: `workspaceId` and `user.roles` are additive — existing call
 * sites that only read `user.role` continue to work unchanged. New code that
 * needs workspace-scoped RBAC should use the `hasWorkspaceRole` /
 * `hasWorkspaceAccess` helpers below.
 */
export interface Session {
  user: {
    id: string
    email?: string
    /** Primary role — kept for backward compatibility with single-role checks */
    role: string
    /** All roles assigned to this user (multi-role). Falls back to `[role]` when absent. */
    roles?: string[]
    name?: string
    permissions?: string[]
    appMetadata?: Record<string, unknown>
  }
  /** Active workspace context. Absent for system-level / cross-workspace sessions. */
  workspaceId?: string
  /** ISO-8601 timestamp when the session expires */
  expires: string
}

// Type alias for SessionData - compatibility with various imports
export type SessionData = Session

/**
 * Session cache constants.
 *
 * SESSION_CACHE_EVICT_BUFFER_MS: Re-validate this early before token expiry.
 *   Protects against in-flight PHI exposure on a medical platform if the token
 *   expires mid-request. The 5-second floor means a revoked token is accepted
 *   for at most ~5 s after revocation.
 *
 * SESSION_CACHE_MAX_TTL_MS: Hard ceiling — re-validate every 5 minutes even if
 *   the token is still technically valid. Detects administrative revocation.
 */
const SESSION_CACHE_EVICT_BUFFER_MS = 5 * 1_000
const SESSION_CACHE_MAX_TTL_MS = 5 * 60 * 1_000

/** A cached session entry with an absolute eviction timestamp. */
interface TokenCacheEntry {
  session: Session
  evictAt: number
}

/** In-process fallback cache (used in all modes, primary storage when USE_REDIS_SESSIONS=false). */
const tokenCache = new Map<string, TokenCacheEntry>()

/** Redis cache key prefix for session entries. */
const REDIS_SESSION_KEY_PREFIX = 'session:token:'

/** Whether the Redis-backed session cache is enabled. */
const useRedisSessions = () =>
  process.env['USE_REDIS_SESSIONS'] === 'true' ||
  process.env['USE_REDIS_SESSIONS'] === '1'

/**
 * Compute the shared eviction timestamp for a token validation result.
 */
function computeEvictAt(result: TokenPayload): number {
  const tokenExpiresAt = result.expiresAt
    ? result.expiresAt * 1000
    : Date.now() + 60 * 60 * 1_000
  return Math.min(
    tokenExpiresAt - SESSION_CACHE_EVICT_BUFFER_MS,
    Date.now() + SESSION_CACHE_MAX_TTL_MS,
  )
}

/**
 * Build a full Session object from a validated token payload and eviction time.
 */
function buildSession(result: TokenPayload, evictAt: number): Session | null {
  const baseSession = getSessionFromToken(result)
  if (!baseSession) return null
  return {
    ...baseSession,
    expires: new Date(evictAt).toISOString(),
  }
}

/** Redis TTL in seconds. Matches the in-memory eviction window. */
function redisTtlSeconds(evictAt: number): number {
  return Math.max(60, Math.ceil((evictAt - Date.now()) / 1000))
}

// ── Cache storage helpers ───────────────────────────────────────────

function cacheGet(token: string): TokenCacheEntry | undefined {
  return tokenCache.get(token)
}

function cacheSet(token: string, entry: TokenCacheEntry): void {
  tokenCache.set(token, entry)
}

function cacheDelete(token: string): void {
  tokenCache.delete(token)
}

async function redisGet(token: string): Promise<TokenCacheEntry | null> {
  const raw = await getFromCache<{ session: Session; evictAt: number }>(
    `${REDIS_SESSION_KEY_PREFIX}${token}`,
  )
  if (!raw || typeof raw.evictAt !== 'number') return null
  return raw
}

async function redisSet(token: string, entry: TokenCacheEntry): Promise<void> {
  await setInCache(
    `${REDIS_SESSION_KEY_PREFIX}${token}`,
    entry,
    redisTtlSeconds(entry.evictAt),
  )
}

async function redisDelete(token: string): Promise<void> {
  await removeFromCache(`${REDIS_SESSION_KEY_PREFIX}${token}`)
}

// ── Backend-agnostic helpers used by getSession ─────────────────────

/**
 * Check both backends for a cached session entry. Returns the entry if
 * found in either backend and not yet expired. Redis is checked first
 * when USE_REDIS_SESSIONS is enabled.
 */
async function lookupCachedSession(
  token: string,
): Promise<TokenCacheEntry | null> {
  // Check in-process cache first (fast path in all modes)
  const mem = cacheGet(token)
  if (mem && Date.now() < mem.evictAt) return mem
  if (mem) cacheDelete(token)

  // Check Redis when enabled
  if (useRedisSessions()) {
    const remote = await redisGet(token)
    if (remote && Date.now() < remote.evictAt) {
      // Warm the in-process cache from Redis for subsequent fast hits
      cacheSet(token, remote)
      return remote
    }
    if (remote) {
      // Stale Redis entry — clean it up
      await redisDelete(token)
    }
  }

  return null
}

/**
 * Store a session entry in both backends.
 */
async function storeSession(
  token: string,
  entry: TokenCacheEntry,
): Promise<void> {
  cacheSet(token, entry)
  if (useRedisSessions()) {
    await redisSet(token, entry)
  }
}

/**
 * Minimal JWT payload shape used internally when building a Session from a
 * raw decoded token. Not the same as a next-auth JWT.
 */
type TokenPayload = Awaited<ReturnType<typeof validateToken>> & {
  payload?: Record<string, unknown>
}

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
      roles: extractRolesFromToken(result),
      name: result.payload?.['name'] as string | undefined,
    },
    workspaceId: extractWorkspaceIdFromToken(result),
    expires: expiresAt,
  }
}

function extractRolesFromToken(result: TokenPayload): string[] {
  const appMetadata = result.payload?.['app_metadata']
  if (appMetadata && typeof appMetadata === 'object') {
    const meta = appMetadata as Record<string, unknown>
    if (Array.isArray(meta['roles'])) {
      return meta['roles'].filter((r): r is string => typeof r === 'string')
    }
  }
  return [result.role ?? 'guest']
}

function extractWorkspaceIdFromToken(result: TokenPayload): string | undefined {
  const appMetadata = result.payload?.['app_metadata']
  if (appMetadata && typeof appMetadata === 'object') {
    const meta = appMetadata as Record<string, unknown>
    if (typeof meta['workspaceId'] === 'string') {
      return meta['workspaceId']
    }
  }
  return undefined
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
    const user = (await userManager.getUserById(userId)) as Record<
      string,
      unknown
    > | null

    if (!user) {
      logger.error('User not found:', userId)
      return null
    }

    return {
      id: user['id'] as string,
      email: user['email'] as string,
      fullName: `${user['first_name'] as string} ${user['last_name'] as string}`,
      avatarUrl: user['avatar_url'] as string,
      role: user['role'] as string,
    }
  } catch (error: unknown) {
    logger.error('Error in getUserProfile:', error)
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
 * Return the full set of roles for a session, falling back to `[role]`
 * when `user.roles` is absent (pre-PR3 tokens / system-level sessions).
 */
export function getUserRoles(session: Session): string[] {
  if (session.user.roles && session.user.roles.length > 0) {
    return session.user.roles
  }
  return [session.user.role]
}

/**
 * Check if the user holds `requiredRole` within the given workspace.
 *
 * Returns false when:
 *   - the session has no `workspaceId` (system-level / cross-workspace)
 *   - the session's `workspaceId` does not match the requested one
 *   - the user's roles (from `user.roles`, falling back to `[user.role]`)
 *     do not include `requiredRole`
 *
 * @param session Session object
 * @param workspaceId Workspace the check is scoped to
 * @param requiredRole Role required within that workspace
 */
export function hasWorkspaceRole(
  session: Session,
  workspaceId: string,
  requiredRole: string,
): boolean {
  if (session.workspaceId !== workspaceId) return false
  return getUserRoles(session).includes(requiredRole)
}

/**
 * Check if the user holds ANY of `requiredRoles` within the given workspace.
 * Returns false for the same reasons as `hasWorkspaceRole`.
 */
export function hasAnyWorkspaceRole(
  session: Session,
  workspaceId: string,
  requiredRoles: readonly string[],
): boolean {
  if (session.workspaceId !== workspaceId) return false
  const userRoles = getUserRoles(session)
  return requiredRoles.some((r) => userRoles.includes(r))
}

/**
 * Check if the user has any role assigned within the given workspace.
 * Returns false when the session's `workspaceId` does not match.
 */
export function hasWorkspaceAccess(
  session: Session,
  workspaceId: string,
): boolean {
  return session.workspaceId === workspaceId && getUserRoles(session).length > 0
}

/**
 * Resolve a Session from the incoming HTTP Request.
 *
 * Extraction order:
 *   1. Authorization: Bearer <token> header
 *   2. ?token= query parameter (WebSocket handshake)
 *   3. auth_token / auth-token cookie
 *
 * Cache strategy (controlled by USE_REDIS_SESSIONS env var):
 *
 *   USE_REDIS_SESSIONS=false (default):
 *     In-process Map cache with per-token TTL. Every request
 *     for the same token returns from memory until the eviction
 *     window expires, then re-validates against Auth0.
 *
 *   USE_REDIS_SESSIONS=true:
 *     Redis-backed cache with the same eviction window. The
 *     in-process Map is still used as a fast L1 cache, so hot
 *     tokens never touch the network. Redis serves as the L2
 *     cache for other instances in a horizontally scaled fleet.
 *
 * @param request - The incoming Web API Request
 * @returns A Session or null when unauthenticated
 */
export async function getSession(request: Request): Promise<Session | null> {
  const token = extractTokenFromRequest(request)
  if (!token) return null

  // --- L1 / L2 cache check ---
  const cached = await lookupCachedSession(token)
  if (cached) return cached.session

  // --- Cache miss: authoritative Auth0 round-trip ---
  try {
    const result = await validateToken(token, 'access')
    if (!result.valid || !result.userId) return null

    const evictAt = computeEvictAt(result)
    const session = buildSession(result, evictAt)
    if (!session) return null

    await storeSession(token, { session, evictAt })

    return session
  } catch {
    // Any validation error (network, key mismatch, expiry) is treated as
    // unauthenticated — do not leak error details to the caller
    return null
  }
}
