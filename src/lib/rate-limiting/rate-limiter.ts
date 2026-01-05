/**
 * Distributed Rate Limiting System with Redis
 * Provides configurable rate limiting with attack pattern detection
 */

import { redis } from '../redis'
import { createBuildSafeLogger } from '../logging/build-safe-logger'
import type {
  RateLimitConfig,
  RateLimitResult,
  AttackPattern,
  RateLimitRule,
} from './types'

const logger = createBuildSafeLogger('rate-limiter')

/**
 * Rate Limiter Class with distributed Redis backend
 */
export class DistributedRateLimiter {
  private readonly prefix = 'rate_limit:'
  private readonly attackPrefix = 'attack_pattern:'
  private readonly analyticsPrefix = 'rate_analytics:'

  constructor(private config: RateLimitConfig) {}

  /**
   * Check if request should be rate limited
   */
  async checkLimit(
    identifier: string,
    rule: RateLimitRule,
    context?: Record<string, unknown>,
  ): Promise<RateLimitResult> {
    const key = `${this.prefix}${rule.name}:${identifier}`
    const windowKey = `${key}:${Math.floor(Date.now() / rule.windowMs)}`

    try {
      // Get current count
      const current = await redis.get(windowKey)
      const count = current ? parseInt(current) : 0

      // Check if limit exceeded
      if (count >= rule.maxRequests) {
        await this.recordBlockedRequest(identifier, rule, context)
        return {
          allowed: false,
          limit: rule.maxRequests,
          remaining: 0,
          resetTime: this.getResetTime(rule.windowMs),
          retryAfter: rule.windowMs / 1000,
        }
      }

      // Increment counter
      const pipeline = redis.pipeline()
      pipeline.incr(windowKey)
      pipeline.expire(windowKey, Math.ceil(rule.windowMs / 1000))
      await pipeline.exec()

      // Check for attack patterns
      if (rule.enableAttackDetection) {
        await this.detectAttackPattern(identifier, rule, context)
      }

      // Record analytics
      await this.recordAnalytics(identifier, rule, count + 1)

      return {
        allowed: true,
        limit: rule.maxRequests,
        remaining: rule.maxRequests - count - 1,
        resetTime: this.getResetTime(rule.windowMs),
        retryAfter: null,
      }
    } catch (error) {
      logger.error('Rate limit check failed:', {
        error,
        identifier,
        rule: rule.name,
      })
      // Fail open - allow request if rate limiter fails
      return {
        allowed: true,
        limit: rule.maxRequests,
        remaining: rule.maxRequests,
        resetTime: this.getResetTime(rule.windowMs),
        retryAfter: null,
      }
    }
  }

  /**
   * Detect attack patterns based on request behavior
   */
  private async detectAttackPattern(
    identifier: string,
    rule: RateLimitRule,
    context?: Record<string, unknown>,
  ): Promise<void> {
    const attackKey = `${this.attackPrefix}${identifier}`
    const now = Date.now()

    try {
      // Record request timestamp
      await redis.zadd(attackKey, now, `${now}:${Math.random()}`)

      // Clean old entries (keep last hour)
      const oneHourAgo = now - 3600000
      await redis.zremrangebyscore(attackKey, 0, oneHourAgo)

      // Get recent request pattern
      const recentRequests = await redis.zrangebyscore(
        attackKey,
        oneHourAgo,
        now,
      )

      if (recentRequests.length >= 10) {
        const timestamps = recentRequests.map((r) => parseInt(r.split(':')[0]))
        const pattern = this.analyzePattern(timestamps)

        if (pattern.isSuspicious) {
          await this.handleAttackPattern(identifier, pattern, context)
        }
      }

      // Set expiration on attack tracking
      await redis.expire(attackKey, 3600)
    } catch (error) {
      logger.error('Attack pattern detection failed:', { error, identifier })
    }
  }

  /**
   * Analyze request timestamps for suspicious patterns
   */
  private analyzePattern(timestamps: number[]): AttackPattern {
    if (timestamps.length < 10) {
      return { isSuspicious: false, type: 'normal', confidence: 0 }
    }

    // Sort timestamps
    timestamps.sort((a, b) => a - b)

    // Calculate intervals
    const intervals = []
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1])
    }

    // Check for regular intervals (bot behavior)
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
    const variance =
      intervals.reduce(
        (sum, interval) => sum + Math.pow(interval - avgInterval, 2),
        0,
      ) / intervals.length

    // Low variance indicates regular intervals (likely bot)
    if (variance < 1000) {
      // 1 second threshold
      return {
        isSuspicious: true,
        type: 'regular_intervals',
        confidence: Math.min(0.95, 1 - variance / 1000),
        metadata: { avgInterval, variance },
      }
    }

    // Check for rapid-fire requests
    const rapidRequests = intervals.filter((i) => i < 100).length // < 100ms
    if (rapidRequests > intervals.length * 0.7) {
      return {
        isSuspicious: true,
        type: 'rapid_fire',
        confidence: rapidRequests / intervals.length,
        metadata: { rapidRequestCount: rapidRequests },
      }
    }

    return { isSuspicious: false, type: 'normal', confidence: 0 }
  }

  /**
   * Handle detected attack patterns
   */
  private async handleAttackPattern(
    identifier: string,
    pattern: AttackPattern,
    context?: Record<string, unknown>,
  ): Promise<void> {
    logger.warn('Attack pattern detected:', { identifier, pattern })

    // Block the identifier temporarily
    const blockKey = `${this.prefix}blocked:${identifier}`
    await redis.setex(
      blockKey,
      300,
      JSON.stringify({
        // 5 minute block
        pattern,
        detectedAt: Date.now(),
        context,
      }),
    )

    // Log security event
    await this.logSecurityEvent('attack_pattern_detected', {
      identifier,
      patternType: pattern.type,
      confidence: pattern.confidence,
      context,
    })
  }

  /**
   * Record blocked request for analytics
   */
  private async recordBlockedRequest(
    identifier: string,
    rule: RateLimitRule,
    context?: Record<string, unknown>,
  ): Promise<void> {
    const analyticsKey = `${this.analyticsPrefix}blocked:${rule.name}:${new Date().toISOString().slice(0, 10)}`

    await redis.hincrby(analyticsKey, 'total_blocked', 1)
    await redis.expire(analyticsKey, 86400 * 30) // Keep for 30 days

    // Log security event
    await this.logSecurityEvent('rate_limit_exceeded', {
      identifier,
      rule: rule.name,
      limit: rule.maxRequests,
      context,
    })
  }

  /**
   * Record analytics data
   */
  private async recordAnalytics(
    identifier: string,
    rule: RateLimitRule,
    _currentCount: number,
  ): Promise<void> {
    const date = new Date().toISOString().slice(0, 10)
    const analyticsKey = `${this.analyticsPrefix}usage:${rule.name}:${date}`

    const pipeline = redis.pipeline()
    pipeline.hincrby(analyticsKey, 'total_requests', 1)
    pipeline.hincrby(analyticsKey, 'unique_identifiers', 1)
    pipeline.hset(analyticsKey, 'last_request', Date.now())
    pipeline.expire(analyticsKey, 86400 * 30) // Keep for 30 days

    await pipeline.exec()
  }

  /**
   * Get reset time for rate limit window
   */
  private getResetTime(windowMs: number): Date {
    const now = Date.now()
    const windowStart = Math.floor(now / windowMs) * windowMs
    return new Date(windowStart + windowMs)
  }

  /**
   * Log security event
   */
  private async logSecurityEvent(
    eventType: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    try {
      const eventKey = `security_events:${new Date().toISOString().slice(0, 10)}`
      const event = {
        type: eventType,
        timestamp: Date.now(),
        details,
      }

      await redis.lpush(eventKey, JSON.stringify(event))
      await redis.expire(eventKey, 86400 * 7) // Keep for 7 days
    } catch (error) {
      logger.error('Failed to log security event:', { error, eventType })
    }
  }

  /**
   * Check if identifier is currently blocked
   */
  async isBlocked(identifier: string): Promise<boolean> {
    const blockKey = `${this.prefix}blocked:${identifier}`
    const blocked = await redis.get(blockKey)
    return blocked !== null
  }

  /**
   * Get rate limit analytics
   */
  async getAnalytics(
    ruleName: string,
    days = 7,
  ): Promise<Record<string, unknown>> {
    const analytics: Record<string, unknown> = {}
    const now = new Date()

    for (let i = 0; i < days; i++) {
      const date = new Date(now.getTime() - i * 86400000)
      const dateStr = date.toISOString().slice(0, 10)
      const usageKey = `${this.analyticsPrefix}usage:${ruleName}:${dateStr}`
      const blockedKey = `${this.analyticsPrefix}blocked:${ruleName}:${dateStr}`

      const [usage, blocked] = await Promise.all([
        redis.hgetall(usageKey),
        redis.hgetall(blockedKey),
      ])

      analytics[dateStr] = {
        usage: usage || {},
        blocked: blocked || {},
      }
    }

    return analytics
  }

  /**
   * Get current rate limit status for identifier
   */
  async getStatus(
    identifier: string,
    rule: RateLimitRule,
  ): Promise<RateLimitResult> {
    const key = `${this.prefix}${rule.name}:${identifier}`
    const windowKey = `${key}:${Math.floor(Date.now() / rule.windowMs)}`

    try {
      const current = await redis.get(windowKey)
      const count = current ? parseInt(current) : 0

      return {
        allowed: count < rule.maxRequests,
        limit: rule.maxRequests,
        remaining: Math.max(0, rule.maxRequests - count),
        resetTime: this.getResetTime(rule.windowMs),
        retryAfter: count >= rule.maxRequests ? rule.windowMs / 1000 : null,
      }
    } catch (error) {
      logger.error('Failed to get rate limit status:', {
        error,
        identifier,
        rule: rule.name,
      })
      return {
        allowed: true,
        limit: rule.maxRequests,
        remaining: rule.maxRequests,
        resetTime: this.getResetTime(rule.windowMs),
        retryAfter: null,
      }
    }
  }
}

/**
 * Create a singleton instance of the rate limiter
 */
export const createRateLimiter = (
  config: RateLimitConfig,
): DistributedRateLimiter => {
  return new DistributedRateLimiter(config)
}
