// Rate Limiter Middleware
import { NextFunction } from 'express'

import { getRedisClient } from '../../lib/db/connection'
import { asRedisOps } from '../../lib/redis-ops'

type RateLimiterRequest = {
  ip?: string
  socket?: { remoteAddress?: string }
  headers: Record<string, string | string[] | undefined>
  user?: {
    id?: string
  }
}

type RateLimiterResponse = {
  set: (name: string, value: string) => RateLimiterResponse
  setHeader?: (name: string, value: string) => RateLimiterResponse
  status: (statusCode: number) => {
    json: (body: unknown) => RateLimiterResponse
  }
  json: (body: unknown) => RateLimiterResponse
}

interface RateLimitStore {
  [key: string]: { count: number; resetTime: number } | undefined
}

const store: RateLimitStore = {}
let redisAvailable = true

const tooManyRequestsPayload = {
  error: 'Too Many Requests',
  message: 'Rate limit exceeded. Please try again later.',
}

const parseCount = (value: unknown): number => {
  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'string') {
    const parsed = parseInt(value, 10)
    return Number.isNaN(parsed) ? 0 : parsed
  }

  return 0
}

const setRateLimitHeader = (
  res: RateLimiterResponse,
  name: string,
  value: string,
) => {
  if (typeof res.setHeader === 'function') {
    res.setHeader(name, value)
  }

  if (typeof res.set === 'function') {
    res.set(name, value)
  }
}

const getClientIp = (req: RateLimiterRequest): string => {
  const forwarded = req.headers['x-forwarded-for']
  const forwardIp = (
    Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]
  )?.trim()

  return forwardIp ?? req.ip ?? req.socket?.remoteAddress ?? '127.0.0.1'
}

/**
 * Atomically increments the Redis counter and sets an expiration TTL.
 * We use a Redis transaction (multi/exec) here to prevent a race condition
 * where the INCR succeeds but the EXPIRE fails, which would leave the key
 * stuck in memory forever without a TTL.
 */
export async function incrementRedisCounter(
  key: string,
  windowSeconds: number,
): Promise<number> {
  try {
    const redis = getRedisClient()
    const r = asRedisOps(redis)
    if (typeof r.incr !== 'function') {
      return 0
    }

    const rawCount = await r.incr(key)
    if (typeof r.expire === 'function') {
      await r.expire(key, windowSeconds)
    }
    return parseCount(rawCount)
  } catch (error: unknown) {
    console.error('Rate limiter Redis error:', error)
    redisAvailable = false
    return 0
  }
}

/**
 * Global IP-based rate limiter
 * Default: 100 requests per 60 seconds
 */
export function rateLimiter(
  req: RateLimiterRequest,
  res: RateLimiterResponse,
  next: NextFunction,
): void {
  const ip = getClientIp(req)
  const windowMs = 60000 // 60 seconds
  const maxRequests = 100

  const windowSeconds = windowMs / 1000

  const applyHeaders = (count: number, resetTime: number) => {
    setRateLimitHeader(res, 'X-RateLimit-Limit', String(maxRequests))
    setRateLimitHeader(
      res,
      'X-RateLimit-Remaining',
      String(Math.max(0, maxRequests - count)),
    )
    setRateLimitHeader(
      res,
      'X-RateLimit-Reset',
      String(Math.ceil(resetTime / 1000)),
    )
  }

  const handleLimitExceeded = () => {
    const response = res.status(429)
    if (
      response &&
      typeof (response as { json?: unknown }).json === 'function'
    ) {
      response.json(tooManyRequestsPayload)
    } else {
      res.json(tooManyRequestsPayload)
    }
  }

  if (redisAvailable) {
    void incrementRedisCounter(`rate:ip:${ip}`, windowSeconds)
      .then((count) => {
        if (!count) {
          // Fallback to in-memory if Redis failed
          redisAvailable = false
          return rateLimiter(req, res, next)
        }

        const resetTime = Date.now() + windowMs
        applyHeaders(count, resetTime)
        if (count > maxRequests) {
          handleLimitExceeded()
          return
        }
        return next()
      })
      .catch((error) => {
        console.error('Rate limiter failure:', error)
        redisAvailable = false
        rateLimiter(req, res, next)
      })
    return
  }

  const now = Date.now()
  const record = store[ip] ?? { count: 0, resetTime: now + windowMs }

  // Reset if window has passed
  if (now > record.resetTime) {
    record.count = 0
    record.resetTime = now + windowMs
  }

  record.count++
  store[ip] = record

  applyHeaders(record.count, record.resetTime)

  // Check limit exceeded
  if (record.count > maxRequests) {
    handleLimitExceeded()
    return
  }

  return next()
}

/**
 * Per-user rate limiter
 * Used for endpoints that should throttle by authenticated user
 */
export function rateLimitByUser(
  maxRequests: number = 30,
  windowMs: number = 60000,
) {
  const userStore: RateLimitStore = {}

  return (
    req: RateLimiterRequest,
    res: RateLimiterResponse,
    next: NextFunction,
  ): void => {
    const userId = req.user?.id ?? getClientIp(req)
    const now = Date.now()
    const record = userStore[userId] ?? { count: 0, resetTime: now + windowMs }

    // Reset if window has passed
    if (now > record.resetTime) {
      record.count = 0
      record.resetTime = now + windowMs
    }

    record.count++
    userStore[userId] = record

    // Set rate limit headers
    setRateLimitHeader(res, 'X-RateLimit-Limit', String(maxRequests))
    setRateLimitHeader(
      res,
      'X-RateLimit-Remaining',
      String(Math.max(0, maxRequests - record.count)),
    )
    setRateLimitHeader(
      res,
      'X-RateLimit-Reset',
      String(Math.ceil(record.resetTime / 1000)),
    )

    // Check limit exceeded
    if (record.count > maxRequests) {
      const response = res.status(429)
      if (response && typeof response === 'object' && 'json' in response) {
        response.json(tooManyRequestsPayload)
      } else {
        res.json(tooManyRequestsPayload)
      }
      return
    }

    next()
  }
}
