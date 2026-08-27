/**
 * Auth0 implementation of the IdentityProvider interface.
 *
 * Owns the `provider = 'auth0'` value used in the `auth_accounts` table and
 * the SQL that reads/writes those rows. JWT validation delegates to
 * auth0-jwt-service; user lookups delegate to auth0UserService.
 */

import { randomUUID } from 'node:crypto'

import type { PoolClient } from 'pg'

import { auth0UserService } from '../services/auth0.service'
import { query } from '../db'
import { validateToken } from './auth0-jwt-service'
import type {
  IdentityProvider,
  IdentityProviderUser,
  TokenValidationResult,
} from './identity-provider'

export class Auth0IdentityProvider implements IdentityProvider {
  readonly name = 'auth0'

  async validateToken(
    token: string,
    tokenType: 'access' | 'refresh',
  ): Promise<TokenValidationResult> {
    const result = await validateToken(token, tokenType)
    return result
  }

  async getUserById(userId: string): Promise<IdentityProviderUser | null> {
    const user = await auth0UserService.getUserById(userId)
    if (!user) return null
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      lastLogin: user.lastLogin ?? null,
      userMetadata: user.userMetadata,
    }
  }

  async findInternalIdBySub(
    sub: string,
    client?: PoolClient,
  ): Promise<{ internalId: string; role: string } | null> {
    const sql = `
      SELECT aa.user_id, u.role
      FROM auth_accounts aa
      JOIN users u ON u.id = aa.user_id
      WHERE aa.provider_id = $1
        AND aa.provider    = $2
      LIMIT 1
    `
    const params = [sub, this.name]
    const result = client
      ? await client.query<{ user_id: string; role: string }>(sql, params)
      : await query<{ user_id: string; role: string }>(sql, params)
    if (result.rows.length === 0) return null
    return {
      internalId: result.rows[0].user_id,
      role: result.rows[0].role,
    }
  }

  async linkSubToInternalId(
    sub: string,
    internalId: string,
    client?: PoolClient,
  ): Promise<void> {
    const sql = `
      INSERT INTO auth_accounts (id, user_id, provider, provider_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT DO NOTHING
    `
    const params = [randomUUID(), internalId, this.name, sub]
    if (client) {
      await client.query(sql, params)
    } else {
      await query(sql, params)
    }
  }

  async findSubByInternalId(internalId: string): Promise<string | null> {
    const result = await query<{ provider_id: string }>(
      `SELECT provider_id
       FROM auth_accounts
       WHERE user_id = $1 AND provider = $2
       LIMIT 1`,
      [internalId, this.name],
    )
    return result.rows[0]?.provider_id ?? null
  }
}
