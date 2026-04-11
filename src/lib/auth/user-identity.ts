/**
 * User Identity Resolver
 *
 * Provides the canonical Auth0 sub → internal UUID mapping layer.
 * This is the single source of truth for resolving an Auth0 identity
 * to a platform-internal user record.
 *
 * Design decisions:
 * - Internal UUIDs are stored in the `users` table (Postgres)
 * - The link between Auth0 `sub` and internal UUID lives in `auth_accounts`
 *   (providerId = sub, provider = 'auth0')
 * - The resolved mapping is cached in Redis (TTL: 1 hour) to avoid repeated DB reads
 * - On first login, we upsert both the `users` row and the `auth_accounts` link
 *   inside a single transaction so we never end up with orphaned accounts
 * - No PII is stored in Redis — only the opaque (sub → uuid) mapping
 */

import { randomUUID } from 'crypto'

import { PoolClient } from 'pg'

import { query, transaction } from '../db/index'
import { getFromCache, setInCache, removeFromCache } from '../redis'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Auth0UserProfile {
  /** The Auth0 subject claim — e.g. "auth0|abc123" or "google-oauth2|123" */
  sub: string
  email: string
  emailVerified: boolean
  name?: string
  picture?: string
  role?: string
  appMetadata?: Record<string, unknown>
  userMetadata?: Record<string, unknown>
}

export interface ResolvedIdentity {
  /** Internal Postgres UUID — use this for ALL downstream service calls */
  internalId: string
  /** Auth0 sub — retained for audit logs and Auth0 Management API calls */
  auth0Sub: string
  email: string
  emailVerified: boolean
  name?: string
  picture?: string
  role: string
  /** True if this was the user's very first login (account just provisioned) */
  isNewUser: boolean
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CACHE_TTL_SECONDS = 60 * 60 // 1 hour
const PROVIDER = 'auth0'

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

function cacheKey(sub: string): string {
  // Prefix keeps Redis key-space organised; sub is opaque, no PII
  return `identity:sub:${sub}`
}

async function getCachedIdentity(
  sub: string,
): Promise<ResolvedIdentity | null> {
  try {
    const cached = await getFromCache(cacheKey(sub))
    if (cached && typeof cached === 'object' && 'internalId' in cached) {
      return cached as ResolvedIdentity
    }
  } catch {
    // Cache miss is not fatal — fall through to DB lookup
  }
  return null
}

async function cacheIdentity(identity: ResolvedIdentity): Promise<void> {
  try {
    await setInCache(cacheKey(identity.auth0Sub), identity, CACHE_TTL_SECONDS)
  } catch {
    // Cache write failure is not fatal — DB remains source of truth
  }
}

// ---------------------------------------------------------------------------
// DB helpers (run inside a transaction)
// ---------------------------------------------------------------------------

async function findUserByAuth0Sub(
  client: PoolClient,
  sub: string,
): Promise<{ internalId: string; role: string } | null> {
  const result = await client.query<{ user_id: string; role: string }>(
    `SELECT aa.user_id, u.role
     FROM auth_accounts aa
     JOIN users u ON u.id = aa.user_id
     WHERE aa.provider_id = $1
       AND aa.provider    = $2
     LIMIT 1`,
    [sub, PROVIDER],
  )
  if (result.rows.length === 0) return null
  return { internalId: result.rows[0].user_id, role: result.rows[0].role }
}

async function createUserWithLink(
  client: PoolClient,
  profile: Auth0UserProfile,
): Promise<{ internalId: string; role: string }> {
  const internalId = randomUUID()
  const role = profile.role ?? 'therapist'

  // 1. Insert into users
  await client.query(
    `INSERT INTO users (
       id, email, email_verified, name, role,
       password_hash, created_at, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, '', NOW(), NOW())
     ON CONFLICT (email) DO UPDATE
       SET email_verified = EXCLUDED.email_verified,
           name           = COALESCE(EXCLUDED.name, users.name),
           updated_at     = NOW()`,
    [
      internalId,
      profile.email,
      profile.emailVerified,
      profile.name ?? null,
      role,
    ],
  )

  // Fetch the actual id in case ON CONFLICT hit an existing row
  const upsertResult = await client.query<{ id: string; role: string }>(
    `SELECT id, role FROM users WHERE email = $1 LIMIT 1`,
    [profile.email],
  )
  const actualId = upsertResult.rows[0].id
  const actualRole = upsertResult.rows[0].role

  // 2. Insert into auth_accounts (link sub → internal UUID)
  await client.query(
    `INSERT INTO auth_accounts (id, user_id, provider, provider_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     ON CONFLICT DO NOTHING`,
    [randomUUID(), actualId, PROVIDER, profile.sub],
  )

  return { internalId: actualId, role: actualRole }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve an Auth0 user profile to an internal identity.
 *
 * This is the single entry-point that should be called after a successful
 * Auth0 token validation. It:
 *   1. Checks the Redis cache (fast path ~1ms)
 *   2. Falls back to a Postgres lookup via `auth_accounts`
 *   3. On first login, provisions the `users` row + `auth_accounts` link
 *
 * @param profile - Decoded Auth0 user profile (from ID token or /userinfo)
 * @returns A `ResolvedIdentity` whose `internalId` is the UUID to use everywhere
 */
export async function resolveIdentity(
  profile: Auth0UserProfile,
): Promise<ResolvedIdentity> {
  const { sub } = profile

  // --- Fast path: Redis cache ---
  const cached = await getCachedIdentity(sub)
  if (cached) {
    return { ...cached, isNewUser: false }
  }

  // --- Slow path: Postgres transaction ---
  let internalId: string
  let role: string
  let isNewUser = false

  await transaction(async (client: PoolClient) => {
    const existing = await findUserByAuth0Sub(client, sub)

    if (existing) {
      internalId = existing.internalId
      role = existing.role
    } else {
      const created = await createUserWithLink(client, profile)
      internalId = created.internalId
      role = created.role
      isNewUser = true
    }
  })

  const identity: ResolvedIdentity = {
    internalId: internalId!,
    auth0Sub: sub,
    email: profile.email,
    emailVerified: profile.emailVerified,
    name: profile.name,
    picture: profile.picture,
    role: role!,
    isNewUser,
  }

  // Populate cache for subsequent requests
  await cacheIdentity(identity)

  return identity
}

/**
 * Invalidate the cached identity for a given Auth0 sub.
 * Call this after role changes, deactivations, or account updates.
 */
export async function invalidateIdentityCache(sub: string): Promise<void> {
  try {
    await removeFromCache(cacheKey(sub))
  } catch {
    // Best-effort cache invalidation — non-fatal
  }
}

/**
 * Look up the Auth0 sub for a given internal UUID.
 * Used when we need to call the Auth0 Management API by internal ID.
 */
export async function resolveAuth0SubFromInternalId(
  internalId: string,
): Promise<string | null> {
  const result = await query<{ provider_id: string }>(
    `SELECT provider_id
     FROM auth_accounts
     WHERE user_id = $1 AND provider = $2
     LIMIT 1`,
    [internalId, PROVIDER],
  )
  return result.rows[0]?.provider_id ?? null
}
