import { randomBytes } from 'crypto'

import { redis } from '../redis'
import { getLogger } from '../logging/logger'

import type {
  ApiTier,
  QuotaAlert,
  QuotaCheckResult,
  QuotaPeriod,
  QuotaUsage,
  RateLimitCheckResult,
  RateLimitResult,
  TierName,
} from './types'
import { API_TIERS, DEFAULT_TIER, inferTierFromRateLimit } from './types'

const logger = getLogger('RateLimitService')

const RATE_LIMIT_WINDOW_MS = 60 * 1000
const DAILY_QUOTA_SECONDS = 24 * 60 * 60
const MONTHLY_QUOTA_SECONDS = 30 * 24 * 60 * 60

/**
 * Alert thresholds (percentage of quota used).
 */
const ALERT_THRESHOLDS = {
  rateLimit: 0.9,
  dailyQuota: 0.8,
  monthlyQuota: 0.8,
} as const

/**
 * RateLimitService provides per-key rate limiting (sliding window) and
 * quota tracking (daily/monthly) backed by Redis.
 *
 * Integrates with the existing DeveloperApiKeyManager — the rate_limit
 * field on the API key record is used to infer the tier.
 */
export class RateLimitService {
  /**
   * Check rate limit for a key using a Redis sliding window (ZSET).
   * Returns whether the request is allowed + remaining count.
   */
  async checkRateLimit(
    apiKeyId: string,
    tier: ApiTier,
  ): Promise<RateLimitCheckResult> {
    const key = `ratelimit:${apiKeyId}`
    const now = Date.now()
    const windowStart = now - RATE_LIMIT_WINDOW_MS
    const resetTimeMs = now + RATE_LIMIT_WINDOW_MS

    try {
      await redis.zremrangebyscore(key, 0, windowStart)
      const currentCount = await redis.zcard(key)

      if (currentCount >= tier.requestsPerMinute) {
        const retryAfter = Math.ceil((resetTimeMs - now) / 1000)
        return {
          allowed: false,
          remaining: 0,
          limit: tier.requestsPerMinute,
          resetTimeMs,
          retryAfterSeconds: retryAfter,
        }
      }

      const member = `${now}:${randomBytes(4).toString('hex')}`
      await redis.zadd(key, now, member)

      return {
        allowed: true,
        remaining: tier.requestsPerMinute - currentCount - 1,
        limit: tier.requestsPerMinute,
        resetTimeMs,
        retryAfterSeconds: 0,
      }
    } catch {
      logger.warn('Rate limit check failed, failing open', { apiKeyId })
      return {
        allowed: true,
        remaining: tier.requestsPerMinute,
        limit: tier.requestsPerMinute,
        resetTimeMs,
        retryAfterSeconds: 0,
      }
    }
  }

  /**
   * Check and increment a quota counter (daily or monthly).
   * Uses Redis INCR with expiry for auto-reset.
   */
  async checkQuota(
    apiKeyId: string,
    tier: ApiTier,
    period: QuotaPeriod,
  ): Promise<QuotaCheckResult> {
    const limit = period === 'daily' ? tier.dailyQuota : tier.monthlyQuota
    const ttlSeconds =
      period === 'daily' ? DAILY_QUOTA_SECONDS : MONTHLY_QUOTA_SECONDS
    const key = `quota:${period}:${apiKeyId}`
    const now = Date.now()
    const resetTimeMs = now + ttlSeconds * 1000

    try {
      const count = await redis.incr(key)

      // Set TTL on first use of this period
      if (count === 1) {
        try {
          await redis.setex(key, ttlSeconds, '1')
        } catch {
          // TTL set is best-effort
        }
      }

      if (count > limit) {
        return {
          allowed: false,
          remaining: 0,
          limit,
          period,
          resetTimeMs,
          retryAfterSeconds: Math.ceil((resetTimeMs - now) / 1000),
        }
      }

      return {
        allowed: true,
        remaining: limit - count,
        limit,
        period,
        resetTimeMs,
        retryAfterSeconds: 0,
      }
    } catch {
      logger.warn('Quota check failed, failing open', { apiKeyId, period })
      return {
        allowed: true,
        remaining: limit,
        limit,
        period,
        resetTimeMs,
        retryAfterSeconds: 0,
      }
    }
  }

  /**
   * Combined check: rate limit + daily quota + monthly quota.
   * If rate limit fails, quotas are NOT consumed.
   */
  async check(apiKeyId: string, tier: ApiTier): Promise<RateLimitResult> {
    const rateLimit = await this.checkRateLimit(apiKeyId, tier)

    if (!rateLimit.allowed) {
      const dailyQuota = await this.getQuotaStatus(apiKeyId, tier, 'daily')
      const monthlyQuota = await this.getQuotaStatus(apiKeyId, tier, 'monthly')
      return { allowed: false, rateLimit, dailyQuota, monthlyQuota, tier }
    }

    const dailyQuota = await this.checkQuota(apiKeyId, tier, 'daily')
    if (!dailyQuota.allowed) {
      const monthlyQuota = await this.getQuotaStatus(apiKeyId, tier, 'monthly')
      return { allowed: false, rateLimit, dailyQuota, monthlyQuota, tier }
    }

    const monthlyQuota = await this.checkQuota(apiKeyId, tier, 'monthly')

    return {
      allowed: monthlyQuota.allowed,
      rateLimit,
      dailyQuota,
      monthlyQuota,
      tier,
    }
  }

  /**
   * Get current quota status WITHOUT incrementing.
   */
  async getQuotaStatus(
    apiKeyId: string,
    tier: ApiTier,
    period: QuotaPeriod,
  ): Promise<QuotaCheckResult> {
    const limit = period === 'daily' ? tier.dailyQuota : tier.monthlyQuota
    const ttlSeconds =
      period === 'daily' ? DAILY_QUOTA_SECONDS : MONTHLY_QUOTA_SECONDS
    const key = `quota:${period}:${apiKeyId}`
    const now = Date.now()
    const resetTimeMs = now + ttlSeconds * 1000

    try {
      const raw = await redis.get(key)
      const used = raw ? parseInt(raw, 10) : 0

      return {
        allowed: used < limit,
        remaining: Math.max(0, limit - used),
        limit,
        period,
        resetTimeMs,
        retryAfterSeconds:
          used >= limit ? Math.ceil((resetTimeMs - now) / 1000) : 0,
      }
    } catch {
      return {
        allowed: true,
        remaining: limit,
        limit,
        period,
        resetTimeMs,
        retryAfterSeconds: 0,
      }
    }
  }

  /**
   * Get full usage snapshot for a key.
   */
  async getUsage(apiKeyId: string, tier: ApiTier): Promise<QuotaUsage> {
    const now = Date.now()

    // Rate limit window
    const rateLimitKey = `ratelimit:${apiKeyId}`
    let currentWindowCount = 0
    try {
      await redis.zremrangebyscore(rateLimitKey, 0, now - RATE_LIMIT_WINDOW_MS)
      currentWindowCount = await redis.zcard(rateLimitKey)
    } catch {
      // fail open
    }

    const daily = await this.getQuotaStatus(apiKeyId, tier, 'daily')
    const monthly = await this.getQuotaStatus(apiKeyId, tier, 'monthly')

    const alertThresholdExceeded =
      currentWindowCount / tier.requestsPerMinute >=
        ALERT_THRESHOLDS.rateLimit ||
      (tier.dailyQuota - daily.remaining) / tier.dailyQuota >=
        ALERT_THRESHOLDS.dailyQuota ||
      (tier.monthlyQuota - monthly.remaining) / tier.monthlyQuota >=
        ALERT_THRESHOLDS.monthlyQuota

    return {
      apiKeyId,
      tier,
      rateLimit: {
        currentWindowCount,
        limit: tier.requestsPerMinute,
        remaining: Math.max(0, tier.requestsPerMinute - currentWindowCount),
        resetTimeMs: now + RATE_LIMIT_WINDOW_MS,
      },
      dailyQuota: daily,
      monthlyQuota: monthly,
      alertThresholdExceeded,
      lastChecked: new Date(now).toISOString(),
    }
  }

  /**
   * Generate an alert when quota thresholds are exceeded.
   */
  createAlert(
    apiKeyId: string,
    type: QuotaAlert['type'],
    tier: ApiTier,
    currentUsage: number,
    limit: number,
  ): QuotaAlert {
    const thresholds: Record<QuotaAlert['type'], number> = {
      rate_limit: tier.requestsPerMinute,
      daily_quota: tier.dailyQuota,
      monthly_quota: tier.monthlyQuota,
    }

    return {
      alertId: `alert_${apiKeyId}_${type}_${Date.now()}`,
      apiKeyId,
      type,
      tier: tier.name,
      threshold: ALERT_THRESHOLDS.dailyQuota,
      currentUsage,
      limit: thresholds[type],
      timestamp: new Date().toISOString(),
      message: `${type.replace('_', ' ')} threshold exceeded for key ${apiKeyId}: ${currentUsage}/${limit}`,
    }
  }

  /**
   * Get tier for a key based on its rate_limit value from the DB.
   */
  getTierForRateLimit(rateLimit: number): ApiTier {
    const tierName = inferTierFromRateLimit(rateLimit)
    return API_TIERS[tierName]
  }

  /**
   * Get tier by name.
   */
  getTier(name: TierName): ApiTier {
    return API_TIERS[name]
  }

  /**
   * Get default tier.
   */
  getDefaultTier(): ApiTier {
    return API_TIERS[DEFAULT_TIER]
  }
}

// Singleton
let instance: RateLimitService | null = null

export function getRateLimitService(): RateLimitService {
  if (!instance) {
    instance = new RateLimitService()
  }
  return instance
}

export function resetRateLimitService(): void {
  instance = null
}
