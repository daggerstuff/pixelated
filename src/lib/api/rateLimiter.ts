/**
 * Rate Limiting System for Pixelated Empathy API
 * Implements multiple rate limiting strategies with Redis storage
 */

import type { Redis } from '@upstash/redis'

export interface RateLimitRule {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
  keyGenerator?: (request: Request) => string // Custom key generation
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
}

export interface RateLimitConfig {
  rules: RateLimitRule[]
  storage: Redis
  enableMetrics?: boolean
  burstLimit?: number // Allow burst requests above normal limit
  burstWindowMs?: number
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetTime: number
  retryAfter?: number
}

export interface RateLimitMetrics {
  totalRequests: number
  blockedRequests: number
  averageRequestsPerMinute: number
  topOffenders: string[]
}

/**
 * Advanced Rate Limiter with multiple strategies
 */
class RateLimiter {
  private config: RateLimitConfig
  private metrics = {
    totalRequests: 0,
    blockedRequests: 0,
    requestCounts: new Map<string, number>(),
    lastReset: Date.now(),
  }

  constructor(config: RateLimitConfig) {
    this.config = {
      enableMetrics: true,
      burstLimit: 10,
      burstWindowMs: 1000,
      ...config,
    }
  }

  /**
   * Check rate limit for a request
   */
  async checkLimit(request: Request): Promise<RateLimitResult> {
    this.metrics.totalRequests++

    const results = await Promise.all(
      this.config.rules.map((rule) => this.checkRule(request, rule)),
    )

    // Request is allowed if ANY rule passes (OR logic) or if ALL rules pass (AND logic)
    // For security, we'll use AND logic - all rules must pass
    const allRulesPass = results.every((result) => result.success)

    if (!allRulesPass) {
      this.metrics.blockedRequests++

      // Track offender
      const clientKey = this.getClientKey(request)
      const currentCount = this.metrics.requestCounts.get(clientKey) || 0
      this.metrics.requestCounts.set(clientKey, currentCount + 1)

      // Return the most restrictive rule's result
      const failedResult = results.find((result) => !result.success)!
      return failedResult
    }

    return {
      success: true,
      limit: Math.min(...results.map((r) => r.limit)),
      remaining: Math.min(...results.map((r) => r.remaining)),
      resetTime: Math.min(...results.map((r) => r.resetTime)),
    }
  }

  private async checkRule(
    request: Request,
    rule: RateLimitRule,
  ): Promise<RateLimitResult> {
    const key = rule.keyGenerator
      ? rule.keyGenerator(request)
      : this.getDefaultKey(request)

    const windowKey = `${key}:${Date.now() - (Date.now() % rule.windowMs)}`
    const burstKey = `${key}:burst:${Date.now() - (Date.now() % this.config.burstWindowMs!)}`

    try {
      // Check burst limit first
      if (this.config.burstLimit) {
        const burstCount = await this.config.storage.incr(burstKey)
        if (burstCount === 1) {
          await this.config.storage.expire(
            burstKey,
            Math.ceil(this.config.burstWindowMs! / 1000),
          )
        }

        if (burstCount > this.config.burstLimit!) {
          const ttl = await this.config.storage.ttl(burstKey)
          return {
            success: false,
            limit: this.config.burstLimit!,
            remaining: 0,
            resetTime: Date.now() + ttl * 1000,
            retryAfter: ttl,
          }
        }
      }

      // Check main rate limit
      const currentCount = await this.config.storage.incr(windowKey)

      if (currentCount === 1) {
        // First request in this window, set expiry
        await this.config.storage.expire(
          windowKey,
          Math.ceil(rule.windowMs / 1000),
        )
      }

      const ttl = await this.config.storage.ttl(windowKey)
      const resetTime = Date.now() + ttl * 1000

      if (currentCount > rule.maxRequests) {
        return {
          success: false,
          limit: rule.maxRequests,
          remaining: 0,
          resetTime,
          retryAfter: ttl,
        }
      }

      return {
        success: true,
        limit: rule.maxRequests,
        remaining: rule.maxRequests - currentCount,
        resetTime,
      }
    } catch (error) {
      console.warn('Rate limiter error:', error)

      // On Redis error, allow request but log the issue
      return {
        success: true,
        limit: rule.maxRequests,
        remaining: rule.maxRequests - 1,
        resetTime: Date.now() + rule.windowMs,
      }
    }
  }

  private getDefaultKey(request: Request): string {
    return this.getClientKey(request)
  }

  private getClientKey(request: Request): string {
    // Try to get real IP from various headers
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const clientIp = request.headers.get('x-client-ip')

    const ip = forwardedFor?.split(',')[0] || realIp || clientIp || 'unknown'

    // Include user agent for more granular limiting
    const userAgent = request.headers.get('user-agent') || 'unknown'

    return `rl:${ip}:${Buffer.from(userAgent).toString('base64').slice(0, 16)}`
  }

  /**
   * Reset rate limit for a specific key
   */
  async resetLimit(key: string): Promise<boolean> {
    try {
      const pattern = `${key}:*`
      const keys = await this.config.storage.keys(pattern)

      if (keys.length > 0) {
        await this.config.storage.del(...keys)
        return true
      }

      return false
    } catch (error) {
      console.warn('Failed to reset rate limit:', error)
      return false
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): RateLimitMetrics {
    const now = Date.now()
    const timeDiffMinutes = (now - this.metrics.lastReset) / (1000 * 60)

    // Get top offenders
    const sortedOffenders = Array.from(this.metrics.requestCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([key]) => key)

    return {
      totalRequests: this.metrics.totalRequests,
      blockedRequests: this.metrics.blockedRequests,
      averageRequestsPerMinute:
        timeDiffMinutes > 0 ? this.metrics.totalRequests / timeDiffMinutes : 0,
      topOffenders: sortedOffenders,
    }
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      blockedRequests: 0,
      requestCounts: new Map(),
      lastReset: Date.now(),
    }
  }

  /**
   * Clean up old keys (should be run periodically)
   */
  async cleanup(): Promise<number> {
    try {
      // This would typically be done by Redis expiry, but we can help clean up
      const pattern = 'rl:*:*'
      const keys = await this.config.storage.keys(pattern)

      // Remove keys older than 24 hours

      let cleanedCount = 0

      for (const key of keys) {
        const ttl = await this.config.storage.ttl(key)
        if (ttl === -1) {
          // Key exists but no expiry
          await this.config.storage.del(key)
          cleanedCount++
        }
      }

      return cleanedCount
    } catch (error) {
      console.warn('Rate limiter cleanup error:', error)
      return 0
    }
  }
}

/**
 * Predefined rate limiting rules for different endpoints
 */
export const RATE_LIMIT_RULES = {
  // Strict limits for authentication endpoints
  AUTH: [
    {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5, // 5 auth attempts per 15 minutes
      keyGenerator: (req: Request) =>
        `auth:${req.headers.get('x-forwarded-for') || 'unknown'}`,
    },
    {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 3,
      keyGenerator: (req: Request) =>
        `auth_burst:${req.headers.get('x-forwarded-for') || 'unknown'}`,
    },
  ],

  // Moderate limits for API endpoints
  API: [
    {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100,
    },
  ],

  // Relaxed limits for public endpoints
  PUBLIC: [
    {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 1000,
    },
  ],

  // Strict limits for file uploads
  UPLOAD: [
    {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 10, // 10 uploads per hour
    },
    {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 3, // 3 uploads per minute
    },
  ],

  // Very strict limits for admin endpoints
  ADMIN: [
    {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 30,
    },
    {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 500,
    },
  ],
}

/**
 * Create rate limiter instance with Redis storage
 */
export function createRateLimiter(
  redis: Redis,
  rules: RateLimitRule[] = RATE_LIMIT_RULES.API,
): RateLimiter {
  return new RateLimiter({
    storage: redis,
    rules,
    enableMetrics: true,
    burstLimit: 20,
    burstWindowMs: 1000,
  })
}

// Export singleton factory
export { RateLimiter }
export default RateLimiter
