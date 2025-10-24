/**
 * Token Revocation Service
 * Handles token blacklisting, revocation tracking, and secure storage
 * HIPAA-compliant with audit logging and distributed cache support
 */

import type { RedisClientType } from 'redis'
import { getRedisClient } from '../redis'
import { logger } from '../logger'
import { AuthenticationError } from './errors'
import { SecurityEventLogger } from './security-event-logger'

export interface RevocationRecord {
  tokenId: string
  userId: string
  reason: RevocationReason
  revokedAt: number
  expiresAt: number
  metadata?: Record<string, unknown>
}

export interface RevocationResult {
  success: boolean
  tokenId: string
  reason: string
  revokedAt: number
}

export enum RevocationReason {
  USER_LOGOUT = 'user_logout',
  USER_REQUESTED = 'user_requested',
  SECURITY_BREACH = 'security_breach',
  TOKEN_COMPROMISED = 'token_compromised',
  ACCOUNT_SUSPENDED = 'account_suspended',
  PASSWORD_CHANGED = 'password_changed',
  REFRESH_TOKEN_USED = 'refresh_token_used',
  REFRESH_CYCLE = 'refresh_cycle',
  LINKED_REVOCATION = 'linked_revocation',
  ADMIN_ACTION = 'admin_action',
  SESSION_TIMEOUT = 'session_timeout',
}

export interface RevocationServiceConfig {
  revocationListTTL: number // seconds (default: 7 days)
  enableDistributedRevocation: boolean
  enableAuditLogging: boolean
  maxRevocationsPerUser: number
  cleanupInterval: number // seconds
}

/**
 * Token Revocation Service for secure token management
 */
export class TokenRevocationService {
  private redis: RedisClientType
  private securityLogger: SecurityEventLogger
  private config: RevocationServiceConfig
  private cleanupTimer?: NodeJS.Timeout

  constructor(config: Partial<RevocationServiceConfig> = {}) {
    this.redis = getRedisClient()
    this.securityLogger = new SecurityEventLogger()
    this.config = {
      revocationListTTL: 7 * 24 * 3600, // 7 days
      enableDistributedRevocation: true,
      enableAuditLogging: true,
      maxRevocationsPerUser: 1000,
      cleanupInterval: 3600, // 1 hour
      ...config,
    }

    this.startCleanupTimer()
  }

  /**
   * Revoke a specific token by ID
   */
  async revokeToken(
    tokenId: string,
    reason: RevocationReason,
    metadata: Record<string, unknown> = {},
  ): Promise<RevocationResult> {
    try {
      // Validate token ID
      if (!tokenId || typeof tokenId !== 'string') {
        throw new AuthenticationError('Invalid token ID')
      }

      // Check if already revoked
      const existingRevocation = await this.getRevocationRecord(tokenId)
      if (existingRevocation) {
        logger.info(`Token ${tokenId} is already revoked`)
        return {
          success: true,
          tokenId,
          reason: existingRevocation.reason,
          revokedAt: existingRevocation.revokedAt,
        }
      }

      // Get token metadata to extract user ID and expiration
      const tokenMetadata = await this.getTokenMetadata(tokenId)
      if (!tokenMetadata) {
        logger.warn(`Token metadata not found for ${tokenId}`)
        // Still revoke the token ID even without metadata
      }

      const userId = tokenMetadata?.userId || 'unknown'
      const now = Math.floor(Date.now() / 1000)
      const expiresAt =
        tokenMetadata?.expiresAt || now + this.config.revocationListTTL

      // Create revocation record
      const revocationRecord: RevocationRecord = {
        tokenId,
        userId,
        reason,
        revokedAt: now,
        expiresAt,
        metadata,
      }

      // Store revocation record
      await this.storeRevocationRecord(revocationRecord)

      // Add to user's revocation list for tracking
      await this.addToUserRevocationList(userId, tokenId)

      // Check revocation limits
      await this.enforceRevocationLimits(userId)

      // Audit log the revocation
      if (this.config.enableAuditLogging) {
        await this.securityLogger.logTokenRevocation(
          userId,
          tokenId,
          reason,
          metadata,
        )
      }

      // Notify distributed systems if enabled
      if (this.config.enableDistributedRevocation) {
        await this.notifyDistributedRevocation(revocationRecord)
      }

      logger.info(`Token ${tokenId} revoked for user ${userId}`, {
        reason,
        revokedAt: now,
      })

      return {
        success: true,
        tokenId,
        reason,
        revokedAt: now,
      }
    } catch (error) {
      logger.error(`Failed to revoke token ${tokenId}`, error)
      throw error instanceof AuthenticationError
        ? error
        : new AuthenticationError('Token revocation failed')
    }
  }

  /**
   * Check if a token has been revoked
   */
  async isTokenRevoked(tokenId: string): Promise<boolean> {
    try {
      if (!tokenId) return false

      const revocationRecord = await this.getRevocationRecord(tokenId)

      if (!revocationRecord) {
        return false
      }

      // Check if revocation has expired
      const now = Math.floor(Date.now() / 1000)
      if (revocationRecord.expiresAt < now) {
        // Clean up expired revocation
        await this.removeRevocationRecord(tokenId)
        return false
      }

      return true
    } catch (error) {
      logger.error(
        `Error checking revocation status for token ${tokenId}`,
        error,
      )
      // Fail closed - assume revoked if we can't verify
      return true
    }
  }

  /**
   * Get revocation record for a token
   */
  async getRevocationRecord(tokenId: string): Promise<RevocationRecord | null> {
    try {
      const key = `token:revocation:${tokenId}`
      const data = await this.redis.get(key)

      if (!data) return null

      return JSON.parse(data) as RevocationRecord
    } catch (error) {
      logger.error(`Error retrieving revocation record for ${tokenId}`, error)
      return null
    }
  }

  /**
   * Revoke all tokens for a specific user
   */
  async revokeAllUserTokens(
    userId: string,
    reason: RevocationReason,
    metadata: Record<string, unknown> = {},
  ): Promise<number> {
    try {
      const userRevocationsKey = `user:revocations:${userId}`
      const tokenIds = await this.redis.smembers(userRevocationsKey)

      let revokedCount = 0

      for (const tokenId of tokenIds) {
        try {
          await this.revokeToken(tokenId, reason, metadata)
          revokedCount++
        } catch (error) {
          logger.warn(
            `Failed to revoke token ${tokenId} for user ${userId}`,
            error,
          )
        }
      }

      logger.info(`Revoked ${revokedCount} tokens for user ${userId}`, {
        reason,
      })
      return revokedCount
    } catch (error) {
      logger.error(`Failed to revoke all tokens for user ${userId}`, error)
      throw new AuthenticationError('Failed to revoke user tokens')
    }
  }

  /**
   * Get all active revocations for a user
   */
  async getUserRevocations(userId: string): Promise<RevocationRecord[]> {
    try {
      const userRevocationsKey = `user:revocations:${userId}`
      const tokenIds = await this.redis.smembers(userRevocationsKey)

      const revocations: RevocationRecord[] = []
      const now = Math.floor(Date.now() / 1000)

      for (const tokenId of tokenIds) {
        const revocation = await this.getRevocationRecord(tokenId)
        if (revocation && revocation.expiresAt > now) {
          revocations.push(revocation)
        }
      }

      return revocations.sort((a, b) => b.revokedAt - a.revokedAt)
    } catch (error) {
      logger.error(`Error retrieving revocations for user ${userId}`, error)
      return []
    }
  }

  /**
   * Store revocation record in Redis
   */
  private async storeRevocationRecord(record: RevocationRecord): Promise<void> {
    const key = `token:revocation:${record.tokenId}`
    const ttl = record.expiresAt - Math.floor(Date.now() / 1000)

    if (ttl <= 0) {
      throw new AuthenticationError('Cannot store expired revocation record')
    }

    await this.redis.setex(key, ttl, JSON.stringify(record))
  }

  /**
   * Remove revocation record from Redis
   */
  private async removeRevocationRecord(tokenId: string): Promise<void> {
    const key = `token:revocation:${tokenId}`
    await this.redis.del(key)
  }

  /**
   * Add token to user's revocation list for tracking
   */
  private async addToUserRevocationList(
    userId: string,
    tokenId: string,
  ): Promise<void> {
    const userRevocationsKey = `user:revocations:${userId}`

    // Add to set with expiration based on revocation list TTL
    await this.redis.sadd(userRevocationsKey, tokenId)

    // Set TTL on the set itself
    await this.redis.expire(userRevocationsKey, this.config.revocationListTTL)
  }

  /**
   * Enforce maximum revocations per user to prevent abuse
   */
  private async enforceRevocationLimits(userId: string): Promise<void> {
    const userRevocationsKey = `user:revocations:${userId}`
    const revocationCount = await this.redis.scard(userRevocationsKey)

    if (revocationCount > this.config.maxRevocationsPerUser) {
      logger.warn(`User ${userId} exceeded revocation limit`, {
        count: revocationCount,
        limit: this.config.maxRevocationsPerUser,
      })

      // Remove oldest revocations
      const tokensToRemove = revocationCount - this.config.maxRevocationsPerUser
      const oldestTokens = await this.redis.srandmember(
        userRevocationsKey,
        tokensToRemove,
      )

      for (const tokenId of oldestTokens) {
        await this.removeRevocationRecord(tokenId)
        await this.redis.srem(userRevocationsKey, tokenId)
      }
    }
  }

  /**
   * Get token metadata from Redis
   */
  private async getTokenMetadata(tokenId: string): Promise<any | null> {
    try {
      const key = `token:metadata:${tokenId}`
      const data = await this.redis.get(key)

      if (!data) return null

      return JSON.parse(data)
    } catch (error) {
      logger.error(`Error retrieving token metadata for ${tokenId}`, error)
      return null
    }
  }

  /**
   * Notify distributed systems of revocation (placeholder for future implementation)
   */
  private async notifyDistributedRevocation(
    record: RevocationRecord,
  ): Promise<void> {
    // TODO: Implement distributed revocation notification
    // This could use message queues, webhooks, or other distributed communication methods
    logger.info('Distributed revocation notification', {
      tokenId: record.tokenId,
      reason: record.reason,
    })
  }

  /**
   * Clean up expired revocation records
   */
  async cleanupExpiredRevocations(): Promise<number> {
    try {
      let cleanedCount = 0
      const now = Math.floor(Date.now() / 1000)

      // Get all revocation keys
      const revocationKeys = await this.redis.keys('token:revocation:*')

      for (const key of revocationKeys) {
        const revocation = await this.getRevocationRecord(
          key.replace('token:revocation:', ''),
        )

        if (revocation && revocation.expiresAt < now) {
          await this.removeRevocationRecord(revocation.tokenId)

          // Remove from user revocation list
          const userRevocationsKey = `user:revocations:${revocation.userId}`
          await this.redis.srem(userRevocationsKey, revocation.tokenId)

          cleanedCount++
        }
      }

      logger.info(`Cleaned up ${cleanedCount} expired revocation records`)
      return cleanedCount
    } catch (error) {
      logger.error('Error during revocation cleanup', error)
      return 0
    }
  }

  /**
   * Get revocation statistics
   */
  async getRevocationStatistics(): Promise<{
    totalRevocations: number
    activeRevocations: number
    expiredRevocations: number
    revocationsByReason: Record<string, number>
    topUsersByRevocations: Array<{ userId: string; count: number }>
  }> {
    try {
      const now = Math.floor(Date.now() / 1000)
      const revocationKeys = await this.redis.keys('token:revocation:*')

      let totalRevocations = 0
      let activeRevocations = 0
      let expiredRevocations = 0
      const revocationsByReason: Record<string, number> = {}
      const userRevocationCounts: Record<string, number> = {}

      for (const key of revocationKeys) {
        const revocation = await this.getRevocationRecord(
          key.replace('token:revocation:', ''),
        )

        if (revocation) {
          totalRevocations++

          if (revocation.expiresAt > now) {
            activeRevocations++
          } else {
            expiredRevocations++
          }

          // Count by reason
          revocationsByReason[revocation.reason] =
            (revocationsByReason[revocation.reason] || 0) + 1

          // Count by user
          userRevocationCounts[revocation.userId] =
            (userRevocationCounts[revocation.userId] || 0) + 1
        }
      }

      // Get top users by revocation count
      const topUsersByRevocations = Object.entries(userRevocationCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([userId, count]) => ({ userId, count }))

      return {
        totalRevocations,
        activeRevocations,
        expiredRevocations,
        revocationsByReason,
        topUsersByRevocations,
      }
    } catch (error) {
      logger.error('Error generating revocation statistics', error)
      return {
        totalRevocations: 0,
        activeRevocations: 0,
        expiredRevocations: 0,
        revocationsByReason: {},
        topUsersByRevocations: [],
      }
    }
  }

  /**
   * Start periodic cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }

    this.cleanupTimer = setInterval(async () => {
      try {
        await this.cleanupExpiredRevocations()
      } catch (error) {
        logger.error('Error in revocation cleanup timer', error)
      }
    }, this.config.cleanupInterval * 1000)

    // Run initial cleanup
    this.cleanupExpiredRevocations().catch((error) => {
      logger.error('Error in initial revocation cleanup', error)
    })
  }

  /**
   * Stop cleanup timer
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }
  }
}
