/**
 * IdentityProvider abstraction.
 *
 * Decouples consumer code (user-identity.ts, auth-legacy.ts, session.ts) from
 * the underlying identity provider (currently Auth0). A future second provider
 * (e.g. Okta, Cognito) can ship as a new implementation of this interface
 * without touching the call sites.
 *
 * The provider owns:
 *   - The provider name used as the `provider` column value in `auth_accounts`
 *   - Token validation (JWT verify, claim extraction)
 *   - User lookup by provider ID
 *   - The provider-specific read/write SQL against `auth_accounts`
 *
 * Consumers continue to own:
 *   - The `users` table schema and lifecycle
 *   - Session shape and caching
 *   - Role assignment policy
 *
 * To swap the active provider in tests, use `setIdentityProvider()`. In
 * production the provider is selected once at module load.
 */

import type { PoolClient } from 'pg'

import { Auth0IdentityProvider } from './auth0-identity-provider'

export interface TokenValidationResult {
  valid: boolean
  userId?: string
  role?: string
  email?: string
  name?: string
  /** Epoch seconds at which the token expires. */
  expiresAt?: number
  /** Raw decoded claims for consumers that need non-standard fields. */
  payload?: Record<string, unknown>
  /** Human-readable failure reason when `valid` is false. */
  error?: string
}

export interface IdentityProviderUser {
  id: string
  email: string
  role?: string
  fullName?: string | null
  avatarUrl?: string | null
  lastLogin?: Date | string | null
  userMetadata?: Record<string, unknown>
}

export interface IdentityProvider {
  /**
   * Short lowercase name used as the `provider` column value in `auth_accounts`
   * and surfaced in audit logs. Must be stable across deployments.
   */
  readonly name: string

  /**
   * Validate a JWT and return the resolved claims. The token type hint matches
   * the underlying provider's vocabulary; Auth0's `auth0-jwt-service` uses
   * `'access' | 'refresh'` and rejects `'refresh'` tokens.
   */
  validateToken(
    token: string,
    tokenType: 'access' | 'refresh',
  ): Promise<TokenValidationResult>

  /**
   * Fetch a user record from the provider by their provider-specific ID
   * (the same value returned in `TokenValidationResult.userId`).
   */
  getUserById(userId: string): Promise<IdentityProviderUser | null>

  /**
   * Look up the internal platform UUID for a given provider `sub`. The optional
   * `client` lets callers run the read inside an existing transaction.
   */
  findInternalIdBySub(
    sub: string,
    client?: PoolClient,
  ): Promise<{ internalId: string; role: string } | null>

  /**
   * Link a provider `sub` to an internal UUID by inserting a row into
   * `auth_accounts`. The optional `client` lets callers run the write inside
   * an existing transaction.
   */
  linkSubToInternalId(
    sub: string,
    internalId: string,
    client?: PoolClient,
  ): Promise<void>

  /**
   * Reverse-lookup: return the provider `sub` for an internal UUID, or null
   * if no link exists.
   */
  findSubByInternalId(internalId: string): Promise<string | null>
}

let cachedProvider: IdentityProvider | null = null

/**
 * Return the active IdentityProvider. Cached after first call.
 *
 * To override in tests, use `setIdentityProvider()` (and call
 * `resetIdentityProvider()` in `afterEach` to avoid leaking state).
 */
export function getIdentityProvider(): IdentityProvider {
  if (cachedProvider) return cachedProvider
  cachedProvider = new Auth0IdentityProvider()
  return cachedProvider
}

/**
 * Replace the active provider. Pass `null` to clear the cache and revert to
 * the production default on the next `getIdentityProvider()` call.
 */
export function setIdentityProvider(provider: IdentityProvider | null): void {
  cachedProvider = provider
}

/** Clear the cached provider. Test-only; production code should not call this. */
export function resetIdentityProvider(): void {
  cachedProvider = null
}
