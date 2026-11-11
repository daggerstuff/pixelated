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

import { getFromCache, setInCache, removeFromCache } from '../redis'
import { validateToken } from './auth0-jwt-service'
import { extractTokenFromRequest } from './auth0-middleware'

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
  /**
   * Auth0 account identifier resolved during the same validation that produced
   * this session. Carried here so `getCurrentUser` can honour its `accountId`
   * contract from the validated-session cache instead of paying a second
   * `/userinfo` round trip. Additive: absent when the token carried none.
   */
  accountId?: string
  /** Active workspace context. Absent for system-level / cross-workspace sessions. */
  workspaceId?: string
  /** ISO-8601 timestamp when the session expires */
  expires: string
}

/**
 * The verdict one token validation produces.
 *
 * `provider-unavailable` is deliberately not a denial: the token could not be
 * checked because Auth0 was throttled, erroring, or too slow. Callers must
 * answer a retryable failure (`503` + `Retry-After`), never a logout.
 */
export interface SessionValidation {
  status: 'valid' | 'invalid' | 'provider-unavailable'
  /** The validated session. Present only when `status` is `'valid'`. */
  session?: Session
  /** `Retry-After` seconds to surface when the provider could not answer. */
  retryAfterSeconds?: number
}

/**
 * The middleware's verdict for a page request, published on `Astro.locals`.
 *
 * `none` means the request carried no token at all — distinct from `invalid`,
 * which means a token was presented and rejected. Page components read this
 * instead of re-validating a token the middleware already classified, so a
 * page never pays a second `/userinfo` round trip for the same request.
 */
export type SessionVerdict = SessionValidation | { status: 'none' }

/**
 * `Astro.locals` key the middleware writes its verdict to.
 *
 * `App.Locals` carries a `[key: string]: unknown` index signature, so no
 * shared type declaration is required for this key.
 */
export const SESSION_VERDICT_LOCALS_KEY = 'sessionValidation'

function isSessionVerdict(value: unknown): value is SessionVerdict {
  if (!value || typeof value !== 'object') return false
  const status = (value as { status?: unknown }).status
  return (
    status === 'none' ||
    status === 'invalid' ||
    status === 'provider-unavailable' ||
    status === 'valid'
  )
}

/**
 * Read the middleware's verdict from `Astro.locals`.
 *
 * Returns `null` when the middleware did not run for this request (unit tests,
 * an E2E bypass, a statically rendered route), so callers can fall back to the
 * cache-aware read rather than treating "no verdict" as "unauthenticated".
 */
export function readSessionVerdictFromLocals(
  locals: unknown,
): SessionVerdict | null {
  if (!locals || typeof locals !== 'object') return null
  const value = (locals as Record<string, unknown>)[SESSION_VERDICT_LOCALS_KEY]
  return isSessionVerdict(value) ? value : null
}

/** A developer resolved from an `X-API-Key` header. */
export interface DeveloperIdentity {
  id: string
  role: string
  scopes: string[]
}

/**
 * Resolve an `X-API-Key` caller to its developer identity.
 *
 * A page that accepted a developer key before the verdict channel existed keeps
 * accepting it: a key is not a token, so the middleware publishes a `none`
 * verdict for it and the page would otherwise redirect a caller it used to
 * serve.
 */
async function resolveDeveloperFromApiKey(
  request: Request,
): Promise<DeveloperIdentity | null> {
  const apiKey = request.headers.get('X-API-Key')
  if (!apiKey) return null

  const { developerApiKeyManager } = await import('@/lib/db/developer-api-keys')
  const validation = await developerApiKeyManager.validateApiKey(apiKey)
  const record = validation.api_key
  if (!validation.valid || !record) return null

  return {
    id: record.user_id,
    role: record.scopes.includes('admin') ? 'admin' : 'developer',
    scopes: record.scopes,
  }
}

/** What a page component needs to know about the current request's session. */
export interface PageSessionResolution {
  /** The validated session, or `null` when the request is not authenticated. */
  session: Session | null
  /**
   * The provider could not verify the token. This is a retryable failure, not
   * a logout and not an absent session.
   */
  providerUnavailable: boolean
  /**
   * The developer an `X-API-Key` resolved to, or `null`. A page that serves
   * developer-key callers uses it when `session` is absent.
   */
  developer: DeveloperIdentity | null
}

/**
 * Resolve the session a page component should use.
 *
 * The middleware has already validated the token for this request and
 * published its verdict on `Astro.locals`; this reads that verdict instead of
 * validating again. That closes the last duplicate provider call on the
 * training pages: an invalid token on `/training/session/<id>` used to cost
 * the middleware's validation plus the page's own `getSession` re-check (two
 * `/userinfo` calls) because the middleware declines to redirect and lets the
 * page decide.
 *
 * Falls back to the cache-aware `getSession` only when no verdict exists, which
 * means the middleware did not run for this request.
 */
export async function resolvePageSession(
  request: Request,
  locals: unknown,
): Promise<PageSessionResolution> {
  const verdict = readSessionVerdictFromLocals(locals)
  if (!verdict) {
    const session = await getSession(request)
    const localsUser =
      locals && typeof locals === 'object'
        ? (locals as Record<string, unknown>)['user']
        : undefined
    return {
      session,
      providerUnavailable: !session && Boolean(localsUser),
      developer: session ? null : await resolveDeveloperFromApiKey(request),
    }
  }

  if (verdict.status === 'valid' && verdict.session) {
    return {
      session: verdict.session,
      providerUnavailable: false,
      developer: null,
    }
  }

  return {
    session: null,
    providerUnavailable: verdict.status === 'provider-unavailable',
    developer: await resolveDeveloperFromApiKey(request),
  }
}

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
    ...(result.accountId ? { accountId: result.accountId } : {}),
    // `validateToken` resolves the workspace from the `/userinfo` body, its
    // `user_metadata` and its `app_metadata`; fall back to the token payload
    // for callers that build a payload without the validation result.
    workspaceId: result.workspaceId ?? extractWorkspaceIdFromToken(result),
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
 *
 * Callers that must distinguish "the provider could not answer" from "the
 * token is invalid" use `validateSessionToken`, which returns that verdict
 * instead of only a Session.
 */
export async function getSession(request: Request): Promise<Session | null> {
  const token = extractTokenFromRequest(request)
  if (!token) return null

  const resolution = await validateSessionToken(token)
  return resolution.status === 'valid' ? (resolution.session ?? null) : null
}

/**
 * Validate a token once and return the verdict the caller needs.
 *
 * This is the cache-aware entry point for callers that must distinguish "the
 * token is invalid" from "the provider could not answer" — the middleware's
 * cookie-session resolution in particular. Reading the cache through
 * `getSession` and then classifying with a second `validateToken` made every
 * cold request that could not be verified pay two `/userinfo` calls: 5 001 ms
 * at two 2 500 ms deadlines on `8397bdff6` / Worker `7ea1640e`, and two of the
 * ten requests Auth0's `/userinfo` bucket allows. One round trip now yields
 * the verdict.
 *
 * Contract, unchanged from `getSession`:
 *  - a cache hit costs no provider call and returns the cached `Session`
 *  - a valid token is stored in the existing cache and returns that same
 *    `Session`
 *  - an invalid token is `invalid` and is never cached
 *  - a provider failure is `provider-unavailable` with the provider's
 *    `Retry-After`, and is never cached — so it is retried, not remembered
 */
export async function validateSessionToken(
  token: string,
): Promise<SessionValidation> {
  // --- L1 / L2 cache check ---
  let cached: TokenCacheEntry | null = null
  try {
    cached = await lookupCachedSession(token)
  } catch {
    // The cache is an optimisation: an unreachable or misbehaving backend
    // costs a fast miss and the authoritative validation runs below. It must
    // never become an authentication verdict, in either direction.
    cached = null
  }
  if (cached) return { status: 'valid', session: cached.session }

  // --- Cache miss: the single authoritative Auth0 round-trip ---
  try {
    const result = await validateToken(token, 'access')
    if (!result.valid || !result.userId) {
      if (result.providerUnavailable) {
        return {
          status: 'provider-unavailable',
          retryAfterSeconds: result.retryAfterSeconds,
        }
      }
      return { status: 'invalid' }
    }

    const evictAt = computeEvictAt(result)
    const session = buildSession(result, evictAt)
    if (!session) return { status: 'invalid' }

    try {
      await storeSession(token, { session, evictAt })
    } catch {
      // A cache write failure must not turn a verified token into a denial;
      // the next request simply validates again.
    }

    return { status: 'valid', session }
  } catch {
    // Any validation error (network, key mismatch, expiry) is treated as
    // unauthenticated — do not leak error details to the caller
    return { status: 'invalid' }
  }
}
