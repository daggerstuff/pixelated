import { randomBytes, createHash } from 'crypto'

import { VALID_API_KEY_SCOPES, ApiKeyScope } from '../auth/scopes'
import { logSecurityEvent, SecurityEventType } from '../security'
import { query } from './index'

const RATE_LIMIT_CLEANUP_DAYS = 7
const MAX_FAILED_ATTEMPTS = 10

export interface DeveloperApiKey {
  id: string
  user_id: string
  key_hash: string
  key_prefix: string
  name: string
  scopes: ApiKeyScope[]
  rate_limit: number
  is_active: boolean
  last_used_at: Date | null
  last_failed_at: Date | null
  expires_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface CreateApiKeyInput {
  user_id: string
  name: string
  scopes?: string[]
  rate_limit?: number
  expires_in_days?: number
}

export interface ApiKeyValidationResult {
  valid: boolean
  api_key?: DeveloperApiKey
  error?: string
  rateLimited?: boolean
  remainingRequests?: number
  resetTimeMs?: number
}

const DEFAULT_SCOPES: ApiKeyScope[] = ['read', 'write']
const DEFAULT_RATE_LIMIT = 1000
const RATE_LIMIT_WINDOW_MS = 60 * 1000

export class DeveloperApiKeyManager {
  private failedAttempts = new Map<string, number>()

  async createApiKey(
    input: CreateApiKeyInput,
  ): Promise<{ api_key: DeveloperApiKey; plain_key: string }> {
    const rawKey = this.generateRawKey()
    const keyHash = this.hashKey(rawKey)
    const keyPrefix = rawKey.substring(0, 8)
    const validatedScopes = this.validateScopes(input.scopes)
    const rateLimit = input.rate_limit || DEFAULT_RATE_LIMIT
    const expiresAt = input.expires_in_days
      ? new Date(Date.now() + input.expires_in_days * 24 * 60 * 60 * 1000)
      : null

    const result = await query<{
      id: string
      user_id: string
      key_hash: string
      key_prefix: string
      name: string
      scopes: string[]
      rate_limit: number
      is_active: boolean
      last_used_at: Date | null
      last_failed_at: Date | null
      expires_at: Date | null
      created_at: Date
      updated_at: Date
    }>(
      `INSERT INTO developer_api_keys (
        user_id, key_hash, key_prefix, name, scopes, rate_limit, is_active, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, true, $7)
      RETURNING id, user_id, key_hash, key_prefix, name, scopes, rate_limit, is_active, last_used_at, last_failed_at, expires_at, created_at, updated_at`,
      [
        input.user_id,
        keyHash,
        keyPrefix,
        input.name,
        validatedScopes,
        rateLimit,
        expiresAt,
      ],
    )

    const apiKey = result.rows[0]
    return {
      api_key: {
        ...apiKey,
        key_hash: '',
        scopes: (apiKey.scopes as ApiKeyScope[]) || DEFAULT_SCOPES,
      } as DeveloperApiKey,
      plain_key: rawKey,
    }
  }

  async validateApiKey(rawKey: string): Promise<ApiKeyValidationResult> {
    if (!rawKey) {
      return { valid: false, error: 'API key is required' }
    }

    const keyHash = this.hashKey(rawKey)
    const keyPrefix = rawKey.substring(0, 8)

    const result = await query<DeveloperApiKey>(
      `SELECT id, user_id, key_hash, key_prefix, name, scopes, rate_limit, is_active, last_used_at, last_failed_at, expires_at, created_at, updated_at
       FROM developer_api_keys
       WHERE key_prefix = $1 AND key_hash = $2 AND is_active = true`,
      [keyPrefix, keyHash],
    )

    const apiKey = result.rows[0]

    if (!apiKey) {
      return { valid: false, error: 'Invalid API key' }
    }

    if (apiKey.expires_at && new Date() > apiKey.expires_at) {
      await this.recordFailedAttempt(apiKey.id, 'expired')
      return { valid: false, error: 'API key has expired' }
    }

    const rateLimitResult = await this.checkRateLimit(
      apiKey.id,
      apiKey.rate_limit,
    )
    if (!rateLimitResult.allowed) {
      await this.recordFailedAttempt(apiKey.id, 'rate_limited')
      return {
        valid: false,
        error: 'Rate limit exceeded',
        rateLimited: true,
        remainingRequests: 0,
        resetTimeMs: rateLimitResult.resetTimeMs,
      }
    }

    await this.recordSuccessfulAttempt(apiKey.id)

    return {
      valid: true,
      api_key: apiKey,
      remainingRequests: rateLimitResult.remaining,
      resetTimeMs: rateLimitResult.resetTimeMs,
    }
  }

  private async recordSuccessfulAttempt(apiKeyId: string): Promise<void> {
    try {
      await query(
        `UPDATE developer_api_keys SET last_used_at = NOW() WHERE id = $1`,
        [apiKeyId],
      )
      this.failedAttempts.delete(apiKeyId)
    } catch {
      // Non-critical, don't fail validation for audit logging errors
    }
  }

  private async recordFailedAttempt(
    apiKeyId: string,
    reason: string,
  ): Promise<void> {
    try {
      await query(
        `UPDATE developer_api_keys SET last_failed_at = NOW() WHERE id = $1`,
        [apiKeyId],
      )

      await logSecurityEvent(
        SecurityEventType.AUTHENTICATION_FAILED,
        apiKeyId,
        {
          reason,
          api_key_id: apiKeyId,
        },
      )

      await this.handleFailedAttempt(apiKeyId, reason)
    } catch {
      // Non-critical
    }
  }

  private async checkRateLimit(
    apiKeyId: string,
    maxRequests: number,
  ): Promise<{ allowed: boolean; remaining: number; resetTimeMs: number }> {
    // Window boundaries align to minute marks (0, 60s, 120s, etc)
    // This creates aligned rate limit windows for predictable limiting
    const windowStartMs =
      Math.floor(Date.now() / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS
    const windowStart = new Date(windowStartMs)
    const resetTimeMs = windowStartMs + RATE_LIMIT_WINDOW_MS

    const countResult = await query<{ count: string }>(
      `SELECT COALESCE(SUM(request_count), 0)::int as count
      FROM api_key_rate_limits
      WHERE api_key_id = $1 AND window_start >= $2`,
      [apiKeyId, windowStart],
    )

    const currentCount = parseInt(countResult.rows[0]?.count || '0', 10)

    if (currentCount >= maxRequests) {
      return { allowed: false, remaining: 0, resetTimeMs }
    }

    await query(
      `INSERT INTO api_key_rate_limits (api_key_id, window_start, request_count)
      VALUES ($1, $2, 1)
      ON CONFLICT (api_key_id, window_start)
      DO UPDATE SET request_count = api_key_rate_limits.request_count + 1`,
      [apiKeyId, windowStart],
    )

    return {
      allowed: true,
      remaining: maxRequests - currentCount - 1,
      resetTimeMs,
    }
  }

  async revokeApiKey(apiKeyId: string, userId: string): Promise<boolean> {
    const result = await query(
      `UPDATE developer_api_keys SET is_active = false, updated_at = NOW()
      WHERE id = $1 AND user_id = $2`,
      [apiKeyId, userId],
    )
    return (result.rowCount ?? 0) > 0
  }

  async revokeApiKeySystem(apiKeyId: string): Promise<boolean> {
    const result = await query(
      `UPDATE developer_api_keys SET is_active = false, updated_at = NOW()
      WHERE id = $1`,
      [apiKeyId],
    )
    return (result.rowCount ?? 0) > 0
  }

  async listApiKeys(
    userId: string,
  ): Promise<Omit<DeveloperApiKey, 'key_hash'>[]> {
    const result = await query<Omit<DeveloperApiKey, 'key_hash'>>(
      `SELECT id, user_id, key_prefix, name, scopes, rate_limit, is_active, last_used_at, last_failed_at, expires_at, created_at, updated_at
       FROM developer_api_keys
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    )
    return result.rows
  }

  async getApiKeyById(
    apiKeyId: string,
    userId: string,
  ): Promise<Omit<DeveloperApiKey, 'key_hash'> | null> {
    const result = await query<Omit<DeveloperApiKey, 'key_hash'>>(
      `SELECT id, user_id, key_prefix, name, scopes, rate_limit, is_active, last_used_at, last_failed_at, expires_at, created_at, updated_at
       FROM developer_api_keys
       WHERE id = $1 AND user_id = $2`,
      [apiKeyId, userId],
    )
    return result.rows[0] || null
  }

  async updateApiKeyScopes(
    apiKeyId: string,
    userId: string,
    scopes: string[],
  ): Promise<boolean> {
    const validatedScopes = this.validateScopes(scopes)
    if (validatedScopes.length === 0) {
      return false
    }
    const result = await query(
      `UPDATE developer_api_keys SET scopes = $3, updated_at = NOW()
      WHERE id = $1 AND user_id = $2 AND is_active = true`,
      [apiKeyId, userId, validatedScopes],
    )
    return (result.rowCount ?? 0) > 0
  }

  private validateScopes(scopes?: string[]): ApiKeyScope[] {
    if (!scopes || scopes.length === 0) {
      return DEFAULT_SCOPES
    }
    return scopes.filter((scope): scope is ApiKeyScope =>
      VALID_API_KEY_SCOPES.includes(scope as ApiKeyScope),
    )
  }

  async cleanupOldRateLimits(): Promise<number> {
    const cutoffDate = new Date(
      Date.now() - RATE_LIMIT_CLEANUP_DAYS * 24 * 60 * 60 * 1000,
    )
    const result = await query(
      `DELETE FROM api_key_rate_limits WHERE window_start < $1`,
      [cutoffDate],
    )
    return result.rowCount ?? 0
  }

  private async handleFailedAttempt(
    apiKeyId: string,
    reason: string,
  ): Promise<void> {
    const attempts = this.failedAttempts.get(apiKeyId) || 0
    const newAttempts = attempts + 1
    this.failedAttempts.set(apiKeyId, newAttempts)

    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      await this.revokeApiKeySystem(apiKeyId)
      this.failedAttempts.delete(apiKeyId)
      await logSecurityEvent(
        SecurityEventType.AUTHENTICATION_FAILED,
        apiKeyId,
        {
          reason: 'auto_revoked_exceeded_failed_attempts',
          attempts: newAttempts,
        },
      )
    }
  }

  private generateRawKey(): string {
    // Key format: dev_<43 chars base64url> = 47 total chars
    // First 8 chars (dev_XXXX) stored as prefix for DB lookup
    // Full key hash checked on validation - prefix is for indexing only
    const prefix = 'dev_'
    const randomPart = randomBytes(32).toString('base64url')
    return `${prefix}${randomPart}`
  }

  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex')
  }
}

export const developerApiKeyManager = new DeveloperApiKeyManager()
