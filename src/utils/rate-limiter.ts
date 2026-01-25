import { Redis } from '@upstash/redis'

interface RateLimiterOptions {
  windowMs: number // The time window in milliseconds
  max: number // Max number of requests per window
}

interface RateLimitInfo {
  limit: number
  remaining: number
  reset: number
  success: boolean
}

export class RateLimiter {
  private redis: Redis
  private options: RateLimiterOptions

  constructor(options: RateLimiterOptions) {
    this.options = options
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  }

  async check(ip: string): Promise<RateLimitInfo> {
    const key = `ratelimit:${ip}`
    const now = Date.now()
    const windowStart = now - this.options.windowMs

    // Remove old requests outside the current window
    await this.redis.zremrangebyscore(key, 0, windowStart)

    // Count requests in the current window
    const requestCount = await this.redis.zcard(key)

    // Check if limit is exceeded
    if (requestCount >= this.options.max) {
      const oldestRequest = await this.redis.zrange(key, 0, 0, {
        withScores: true,
      })
      const reset = oldestRequest.length
        ? Number(oldestRequest[1]) + this.options.windowMs
        : now + this.options.windowMs

      return {
        success: false,
        limit: this.options.max,
        remaining: 0,
        reset,
      }
    }

    // Add current request
    await this.redis.zadd(key, { score: now, member: now.toString() })
    // Set expiry on the key
    await this.redis.expire(key, Math.ceil(this.options.windowMs / 1000))

    return {
      success: true,
      limit: this.options.max,
      remaining: this.options.max - requestCount - 1,
      reset: now + this.options.windowMs,
    }
  }
}
