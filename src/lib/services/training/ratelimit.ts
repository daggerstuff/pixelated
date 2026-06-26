/**
 * Redis token-bucket rate limiter for WebSocket events.
 *
 * PIX-3935 — Limits session_message events per user per minute.
 * Uses Redis INCR + EXPIRE for atomic sliding-window counting.
 *
 * Key format: ratelimit:ws:{userId}
 * TTL: 60 seconds (one window)
 * Limit: configurable via constructor (default 30/min).
 */

import Redis from 'ioredis'

import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const logger = createBuildSafeLogger('training-ratelimit')

/** Minimal Redis interface for the operations we need. */
interface RedisOps {
  incr(key: string): Promise<number>
  expire(key: string, seconds: number): Promise<number>
  ttl(key: string): Promise<number>
  del(key: string): Promise<number>
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  ttlMs: number
}

export class RateLimiter {
  private readonly redis: RedisOps
  private readonly limit: number
  private readonly windowSeconds: number

  /**
   * @param redis  Connected ioredis client
   * @param limit  Max events per window (default 30)
   * @param windowSeconds  Window duration (default 60)
   */
  constructor(redis: Redis, limit = 30, windowSeconds = 60) {
    this.redis = redis as unknown as RedisOps
    this.limit = limit
    this.windowSeconds = windowSeconds
  }

  /**
   * Check and consume one token for the given user.
   *
   * Returns `allowed: true` if under limit, `false` if exceeded.
   * The caller should close the connection when `allowed` is false.
   */
  async check(userId: string): Promise<RateLimitResult> {
    const key = `ratelimit:ws:${userId}`

    try {
      // Use INCR + EXPIRE in an atomic way — EXPIRE is safe to call every time
      const count = await this.redis.incr(key)

      let ttl = await this.redis.ttl(key)
      if (count === 1 && ttl < 0) {
        // First increment, key had no TTL — set it now
        await this.redis.expire(key, this.windowSeconds)
        ttl = this.windowSeconds
      }

      const allowed = count <= this.limit
      const remaining = Math.max(0, this.limit - count)

      if (!allowed) {
        logger.warn('Rate limit exceeded', {
          userId,
          key,
          count,
          limit: this.limit,
        })
      }

      return { allowed, remaining, ttlMs: Math.max(0, ttl * 1000) }
    } catch (err) {
      logger.error('Rate limiter Redis error', {
        userId,
        error: err instanceof Error ? err.message : String(err),
      })
      // On Redis failure, allow the request (fail-open) but log loudly
      return { allowed: true, remaining: 1, ttlMs: 0 }
    }
  }

  /**
   * Reset the rate-limit counter for a user (useful on reconnect).
   */
  async reset(userId: string): Promise<void> {
    const key = `ratelimit:ws:${userId}`
    try {
      await this.redis.del(key)
    } catch (err) {
      logger.error('Rate limiter reset error', {
        userId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  /**
   * Reset rate-limit for new connection (fresh start on reconnect).
   * Called when a client reconnects after a disconnect.
   */
  async handleReconnect(userId: string): Promise<void> {
    await this.reset(userId)
  }

  async close(): Promise<void> {
    // Don't disconnect the shared Redis client here — it's owned by the caller
  }
}
