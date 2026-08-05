/**
 * API Key Rate Limiter — Redis Sliding Window
 *
 * Uses Redis sorted sets for true sliding-window rate limiting per API key.
 * Each request adds a timestamp-scored member; expired entries are trimmed;
 * the count of remaining entries determines whether the limit is exceeded.
 *
 * Key structure:  ratelimit:apikey:{apiKeyId}:{windowMs}
 *
 * Fail-open: Redis errors allow the request through (same pattern as
 * the existing IP-based rate limiter).
 */

import type { NextFunction } from 'express'

import { getRedisClient } from '../../lib/database/connection'
import { asRedisOps } from '../../lib/redis-ops'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RateLimiterRequest = {
  ip?: string
  socket?: { remoteAddress?: string }
  headers: Record<string, string | string[] | undefined>
  user?: { id?: string }
  apiKeyId?: string
}

type RateLimiterResponse = {
  set: (name: string, value: string) => RateLimiterResponse
  setHeader?: (name: string, value: string) => RateLimiterResponse
  status: (statusCode: number) => {
    json: (body: unknown) => RateLimiterResponse
  }
  json: (body: unknown) => RateLimiterResponse
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTimeMs: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_WINDOW_MS = 60_000 // 60 seconds
const DEFAULT_MAX_REQUESTS = 1_000

const tooManyRequestsPayload = {
  error: 'Too Many Requests',
  message: 'Rate limit exceeded. Please try again later.',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setRateLimitHeader(
  res: RateLimiterResponse,
  name: string,
  value: string,
): void {
  if (typeof res.setHeader === 'function') {
    res.setHeader(name, value)
  }
  if (typeof res.set === 'function') {
    res.set(name, value)
  }
}

// ---------------------------------------------------------------------------
// ApiKeyRateLimiter
// ---------------------------------------------------------------------------

export class ApiKeyRateLimiter {
  private redisAvailable = true

  /**
   * Check whether a request is allowed under the sliding window.
   *
   * Algorithm:
   *  1. ZADD  key  {now}  {now}:{random}   — add current timestamp as score
   *  2. ZREMRANGEBYSCORE  key  -inf  {now - windowMs}  — trim expired
   *  3. ZCARD  key  — count remaining entries
   *  4. If count > maxRequests → denied; else allowed
   *
   * The member is `{timestamp}:{random}` to prevent duplicate-score
   * collisions (two requests at the same millisecond).
   */
  async checkLimit(
    apiKeyId: string,
    maxRequests: number,
    windowMs: number = DEFAULT_WINDOW_MS,
  ): Promise<RateLimitResult> {
    if (!this.redisAvailable) {
      return { allowed: true, remaining: maxRequests, resetTimeMs: 0 }
    }

    const now = Date.now()
    const windowStart = now - windowMs
    const key = `ratelimit:apikey:${apiKeyId}:${windowMs}`

    // Unique member: timestamp + random suffix to avoid collisions
    const member = `${now}:${Math.random().toString(36).substring(2, 8)}`

    try {
      const redis = getRedisClient()
      const r = asRedisOps(redis)

      // 1. Add current request
      await r.zadd(key, now, member)

      // 2. Remove entries older than the window
      await r.zremrangebyscore(key, -Infinity, windowStart)

      // 3. Count remaining entries (zcard after cleanup = current window count)
      //    RedisService doesn't expose zcount, so we use zcard which is
      //    correct because zremrangebyscore just removed all expired entries.
      const rawCount = await (
        redis as unknown as Record<string, unknown> & {
          zcard?: (k: string) => Promise<number>
        }
      ).zcard?.(key)

      const count =
        typeof rawCount === 'number'
          ? rawCount
          : typeof rawCount === 'string'
            ? parseInt(rawCount, 10)
            : 0

      // Set a TTL on the key so it auto-expires after the window + buffer
      if (typeof r.expire === 'function') {
        await r.expire(key, Math.ceil(windowMs / 1000) + 10)
      }

      const remaining = Math.max(0, maxRequests - count)
      const resetTimeMs = now + windowMs

      if (count > maxRequests) {
        return { allowed: false, remaining: 0, resetTimeMs }
      }

      return { allowed: true, remaining, resetTimeMs }
    } catch (error: unknown) {
      console.error('API key rate limiter Redis error:', error)
      this.redisAvailable = false
      // Fail open
      return { allowed: true, remaining: maxRequests, resetTimeMs: 0 }
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const apiKeyRateLimiter = new ApiKeyRateLimiter()

// ---------------------------------------------------------------------------
// Express Middleware Factory
// ---------------------------------------------------------------------------

export interface ApiKeySlidingWindowOptions {
  /** Window duration in milliseconds (default: 60_000) */
  windowMs?: number
  /** Override max requests (default: uses per-key rate_limit from DB) */
  maxRequests?: number
}

/**
 * Create Express middleware that applies Redis sliding-window rate limiting
 * per API key.
 *
 * Usage in route config:
 *   middleware: [apiKeySlidingWindow({ windowMs: 60_000 })]
 *
 * The middleware reads `req.apiKeyId` (set by the API key auth flow) and
 * `req.apiKeyRateLimit` (the per-key max from the DB record).
 */
export function apiKeySlidingWindow(
  options: ApiKeySlidingWindowOptions = {},
): (
  req: RateLimiterRequest,
  res: RateLimiterResponse,
  next: NextFunction,
) => void {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS

  return (
    req: RateLimiterRequest,
    res: RateLimiterResponse,
    next: NextFunction,
  ): void => {
    const apiKeyId = req.apiKeyId
    if (!apiKeyId) {
      // No API key ID on request — skip rate limiting
      next()
      return
    }

    // Per-key max from DB record, or override, or default
    const maxRequests =
      options.maxRequests ??
      ((req as Record<string, unknown>)['apiKeyRateLimit'] as
        | number
        | undefined) ??
      DEFAULT_MAX_REQUESTS

    void apiKeyRateLimiter
      .checkLimit(apiKeyId, maxRequests, windowMs)
      .then((result) => {
        setRateLimitHeader(res, 'X-RateLimit-Limit', String(maxRequests))
        setRateLimitHeader(
          res,
          'X-RateLimit-Remaining',
          String(result.remaining),
        )
        setRateLimitHeader(
          res,
          'X-RateLimit-Reset',
          String(Math.ceil(result.resetTimeMs / 1000)),
        )

        if (!result.allowed) {
          const response = res.status(429)
          if (
            response &&
            typeof (response as { json?: unknown }).json === 'function'
          ) {
            response.json(tooManyRequestsPayload)
          } else {
            res.json(tooManyRequestsPayload)
          }
          return
        }

        next()
      })
      .catch((error: unknown) => {
        console.error('API key sliding window middleware error:', error)
        // Fail open
        next()
      })
  }
}
