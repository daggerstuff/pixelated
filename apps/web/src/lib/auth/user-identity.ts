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
 * - First-login provisioning is all-or-nothing: the `users` row is created
 *   against the platform's existing default workspace, and a profile whose
 *   email claim is absent or empty is reported as unresolvable instead of
 *   being upserted onto the UNIQUE `users.email` column
 * - The validated token payload has PII stripped, so a first login resolves
 *   its email from the identity provider (bounded) before deciding whether the
 *   identity can be provisioned at all
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

/**
 * Outcome of the provisioning transaction.
 *
 * `unresolvable` is an explicit result, not an error: the caller denies the
 * request instead of receiving an account that was coalesced on an empty
 * email claim.
 */
type ProvisioningOutcome =
  | {
      status: 'resolved'
      internalId: string
      role: string
      isNewUser: boolean
      email: string
    }
  | { status: 'unresolvable' }

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CACHE_TTL_SECONDS = 60 * 60 // 1 hour

/**
 * Workspace assigned to a user provisioned on first login.
 *
 * Migration 010 seeds this workspace and migration 011 backfills every
 * pre-existing user onto it; it is the platform's existing default for a user
 * with no organisation assignment. Provisioning reuses that row rather than
 * inventing a workspace, and fails explicitly when it is absent instead of
 * writing a `users` row that violates `workspace_id NOT NULL`.
 */
const DEFAULT_WORKSPACE_SLUG = 'personal'

class IdentityProvisioningError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IdentityProvisioningError'
  }
}

/**
 * Upper bound on the identity cache read that precedes all SQL.
 *
 * Redis is unreachable from the Worker, so this read must never block identity
 * resolution: after this deadline the resolver treats the cache as a miss and
 * falls through to the database lookup.
 */
export const IDENTITY_CACHE_READ_DEADLINE_MS = 750

/**
 * Upper bound on the identity cache write that follows the SQL lookup.
 *
 * The write only populates the cache for later requests: once the identity is
 * resolved, a Redis write that stalls must not hold the request open.
 */
export const IDENTITY_CACHE_WRITE_DEADLINE_MS = 1_000

/**
 * Upper bound on the identity-provider profile lookup used to obtain the email
 * for a first-login provision.
 *
 * `validateToken()` deliberately strips email and the other PII fields from the
 * validated payload, so a first-login profile can legitimately arrive without
 * an email. The provider is the only remaining source, and an unbounded
 * provider call on the provisioning path would reintroduce the pre-pool stall
 * that the cache reads here are already bounded against.
 */
export const PROVIDER_PROFILE_DEADLINE_MS = 1_500

class DeadlineExceededError extends Error {
  constructor(label: string, deadlineMs: number) {
    super(`${label} exceeded its ${deadlineMs}ms deadline`)
    this.name = 'DeadlineExceededError'
  }
}

const withDeadline = async <T>(
  work: Promise<T>,
  label: string,
  deadlineMs: number,
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new DeadlineExceededError(label, deadlineMs)),
      deadlineMs,
    )
  })
  try {
    return await Promise.race([work, deadline])
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
    const cached = await withDeadline(
      getFromCache(cacheKey(sub)),
      'Identity cache read',
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
    await withDeadline(
      setInCache(cacheKey(identity.auth0Sub), identity, CACHE_TTL_SECONDS),
      'Identity cache write',
      IDENTITY_CACHE_WRITE_DEADLINE_MS,
    )
  } catch {
    // Cache write failure or timeout is not fatal — DB remains source of truth
  }
}

// ---------------------------------------------------------------------------
// DB helpers (run inside a transaction)
// ---------------------------------------------------------------------------

/**
 * Normalise the provider's email claim.
 *
 * A token can arrive without the claim at all, and a provider can send an
 * empty or whitespace-only value. `users.email` is UNIQUE, so writing `''`
 * would make every such sub share one row.
 */
function normalizeEmail(email: string | undefined | null): string {
  return typeof email === 'string' ? email.trim() : ''
}

/**
 * Resolve the email a first-login provision should use.
 *
 * The profile's own claim wins when it carries one. Otherwise the identity
 * provider is asked: the token-validation path strips email from the validated
 * payload, so the middleware and route-level callers legitimately pass an
 * empty value even for a real account.
 *
 * Returns an empty string when no email can be established. The caller turns
 * that into the unresolvable-identity outcome — it must never become an
 * `INSERT` of `''` into the UNIQUE `users.email` column.
 */
async function resolveProvisioningEmail(
  profile: Auth0UserProfile,
  provider: IdentityProvider,
): Promise<string> {
  const fromProfile = normalizeEmail(profile.email)
  if (fromProfile) return fromProfile

  const providerUser = await withDeadline(
    provider.getUserById(profile.sub),
    'Identity provider profile lookup',
    PROVIDER_PROFILE_DEADLINE_MS,
  )
  return normalizeEmail(providerUser?.email)
}

/**
 * Resolve the workspace a newly provisioned user belongs to.
 *
 * Uses the seeded default workspace (see `DEFAULT_WORKSPACE_SLUG`) through the
 * same `workspaces` row the migrations use. Throws when no such workspace can
 * be determined: creating the user without one is not an option, because
 * `users.workspace_id` is `NOT NULL` and a row that violates it makes every
 * later request for that identity fail.
 */
async function resolveProvisioningWorkspaceId(
  client: PoolClient,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `SELECT id FROM workspaces WHERE slug = $1 LIMIT 1`,
    [DEFAULT_WORKSPACE_SLUG],
  )
  const workspaceId = result.rows[0]?.id
  if (!workspaceId) {
    throw new IdentityProvisioningError(
      `Cannot provision user: no '${DEFAULT_WORKSPACE_SLUG}' workspace exists to assign`,
    )
  }
  return workspaceId
}

async function createUserWithLink(
  client: PoolClient,
  profile: Auth0UserProfile,
  provider: IdentityProvider,
  email: string,
): Promise<{ internalId: string; role: string }> {
  const internalId = randomUUID()
  const role = profile.role ?? 'therapist'

  // Provisioning refuses an absent email before this point; guard here too so
  // the UNIQUE column can never receive an empty string through this path.
  if (!email) {
    throw new IdentityProvisioningError(
      'Cannot provision user: the profile carries no email claim',
    )
  }

  const workspaceId = await resolveProvisioningWorkspaceId(client)

  // 1. Insert into users (our schema — provider-agnostic)
  await client.query(
    `INSERT INTO users (
       id, email, email_verified, name, role,
       password_hash, workspace_id, created_at, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, '', $6, NOW(), NOW())
     ON CONFLICT (email) DO UPDATE
       SET email_verified = EXCLUDED.email_verified,
           name           = COALESCE(EXCLUDED.name, users.name),
           updated_at     = NOW()`,
    [
      internalId,
      email,
      profile.emailVerified,
      profile.name ?? null,
      role,
      workspaceId,
    ],
  )

  // Fetch the actual id in case ON CONFLICT hit an existing row
  const upsertResult = await client.query<{ id: string; role: string }>(
    `SELECT id, role FROM users WHERE email = $1 LIMIT 1`,
    [email],
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
  const email = normalizeEmail(profile.email)

  // --- Fast path: Redis cache ---
  const cached = await getCachedIdentity(sub)
  if (cached) {
    return { ...cached, isNewUser: false }
  }

  // --- Slow path: Postgres transaction ---
  const outcome = await transaction(
    async (client: PoolClient): Promise<ProvisioningOutcome> => {
      const existing = await provider.findInternalIdBySub(sub, client)

      if (existing) {
        return {
          status: 'resolved',
          internalId: existing.internalId,
          role: existing.role,
          isNewUser: false,
          email,
        }
      }

      // First login. The token payload may not carry an email (the validation
      // path strips it), so ask the provider before deciding whether this
      // identity can be provisioned at all.
      const provisioningEmail = await resolveProvisioningEmail(
        profile,
        provider,
      )

      // No `auth_accounts` link and no email from either source: never upsert.
      // The users row is keyed on `email`, which is UNIQUE, so an empty claim
      // would make two distinct subs collapse onto one internal user.
      if (!provisioningEmail) {
        return { status: 'unresolvable' }
      }

      const created = await createUserWithLink(
        client,
        profile,
        provider,
        provisioningEmail,
      )
      return {
        status: 'resolved',
        internalId: created.internalId,
        role: created.role,
        isNewUser: true,
        email: provisioningEmail,
      }
    },
  )

  if (outcome.status === 'unresolvable') {
    // The explicit unresolvable-identity outcome: callers deny the request
    // (401/403/404) instead of receiving a coalesced or broken account.
    return {
      internalId: null,
      auth0Sub: sub,
      email: '',
      emailVerified: profile.emailVerified,
      name: profile.name,
      picture: profile.picture,
      role: profile.role ?? 'guest',
      isNewUser: false,
    }
  }

  const identity: ResolvedIdentity = {
    internalId: outcome.internalId,
    auth0Sub: sub,
    email: outcome.email,
    emailVerified: profile.emailVerified,
    name: profile.name,
    picture: profile.picture,
    role: outcome.role,
    isNewUser: outcome.isNewUser,
  }

  // Populate cache for subsequent requests
  await cacheIdentity(identity)

  return identity
}
