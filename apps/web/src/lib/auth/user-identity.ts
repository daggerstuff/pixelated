/**
 * User Identity Resolver
 *
 * Provides the canonical provider sub → internal UUID mapping layer.
 * This is the single source of truth for resolving an external identity
 * to a platform-internal user record.
 *
 * Design decisions:
 * - Internal UUIDs are stored in the `users` table (Postgres)
 * - The link between provider `sub` and internal UUID lives in `auth_accounts`
 *   (providerId = sub, provider = <IdentityProvider.name>). The provider is
 *   selected at runtime via `getIdentityProvider()`; this file no longer
 *   hardcodes the provider name.
 * - The resolved mapping is cached in Redis (TTL: 1 hour) to avoid repeated DB reads
 * - On first login, we upsert both the `users` row and the `auth_accounts` link
 *   inside a single transaction so we never end up with orphaned accounts
 * - No PII is stored in Redis — only the opaque (sub → uuid) mapping
 */

import { randomUUID } from 'crypto'

import { PoolClient } from 'pg'

import { transaction } from '../db/index'
import { getFromCache, setInCache } from '../redis'
import type { IdentityProvider } from './identity-provider'
import { getIdentityProvider } from './identity-provider'

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
  internalId: string | null
  /** Auth0 sub — retained for audit logs and Auth0 Management API calls */
  auth0Sub: string
  email: string
  emailVerified: boolean
  name?: string
  picture?: string
  role: string
  /** True if this was the user's very first login (account just provisioned) */
  isNewUser: boolean
  /** Optional activity flag used by upstream auth services */
  isActive?: boolean
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CACHE_TTL_SECONDS = 60 * 60 // 1 hour

/**
 * Upper bound on the identity cache read that precedes all SQL.
 *
 * Redis is unreachable from the Worker, so this read must never block identity
 * resolution: after this deadline the resolver treats the cache as a miss and
 * falls through to the database lookup.
 */
export const IDENTITY_CACHE_READ_DEADLINE_MS = 750

class IdentityCacheReadDeadlineExceededError extends Error {
  constructor(deadlineMs: number) {
    super(`Identity cache read exceeded its ${deadlineMs}ms deadline`)
    this.name = 'IdentityCacheReadDeadlineExceededError'
  }
}

const readCacheWithDeadline = async <T>(
  read: Promise<T>,
  deadlineMs: number,
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new IdentityCacheReadDeadlineExceededError(deadlineMs)),
      deadlineMs,
    )
  })
  try {
    return await Promise.race([read, deadline])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

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
    const cached = await readCacheWithDeadline(
      getFromCache(cacheKey(sub)),
      IDENTITY_CACHE_READ_DEADLINE_MS,
    )
    if (cached && typeof cached === 'object' && 'internalId' in cached) {
      return cached as ResolvedIdentity
    }
  } catch {
    // Cache miss or timeout is not fatal — fall through to DB lookup
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

async function createUserWithLink(
  client: PoolClient,
  profile: Auth0UserProfile,
  provider: IdentityProvider,
): Promise<{ internalId: string; role: string }> {
  const internalId = randomUUID()
  const role = profile.role ?? 'therapist'

  // 1. Insert into users (our schema — provider-agnostic)
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

  // 2. Link via provider (owns the auth_accounts insert and its `provider` value)
  await provider.linkSubToInternalId(profile.sub, actualId, client)

  return { internalId: actualId, role: actualRole }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve a provider user profile to an internal identity.
 *
 * This is the single entry-point that should be called after a successful
 * token validation. It:
 *   1. Checks the Redis cache (fast path ~1ms)
 *   2. Falls back to a Postgres lookup via the provider's `findInternalIdBySub`
 *   3. On first login, provisions the `users` row + `auth_accounts` link
 *
 * @param profile - Decoded provider user profile (from ID token or /userinfo)
 * @returns A `ResolvedIdentity` whose `internalId` is the UUID to use everywhere
 */
export async function resolveIdentity(
  profile: Auth0UserProfile,
): Promise<ResolvedIdentity> {
  const { sub } = profile
  const provider = getIdentityProvider()

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
    const existing = await provider.findInternalIdBySub(sub, client)

    if (existing) {
      internalId = existing.internalId
      role = existing.role
    } else {
      const created = await createUserWithLink(client, profile, provider)
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
