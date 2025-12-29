// Rate Limiter Middleware
import { Request, Response, NextFunction } from 'express'
import { getRedisClient } from '../../lib/database/connection'

interface RateLimitStore {
    [key: string]: { count: number; resetTime: number }
}

const store: RateLimitStore = {}
let redisAvailable = true

async function incrementRedisCounter(key: string, windowSeconds: number) {
    try {
        const redis = getRedisClient()
        const tx = redis.multi()
        tx.incr(key)
        tx.expire(key, windowSeconds)
        const [count] = (await tx.exec()) as any[]
        return parseInt(count[1] as string, 10)
    } catch (error) {
        console.error('Rate limiter Redis error:', error)
        redisAvailable = false
        return null
    }
}

/**
 * Global IP-based rate limiter
 * Default: 100 requests per 60 seconds
 */
export function rateLimiter(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown'
    const windowMs = 60000 // 60 seconds
    const maxRequests = 100

    const windowSeconds = windowMs / 1000

    const applyHeaders = (count: number, resetTime: number) => {
        res.set('X-RateLimit-Limit', String(maxRequests))
        res.set('X-RateLimit-Remaining', String(Math.max(0, maxRequests - count)))
        res.set('X-RateLimit-Reset', String(Math.ceil(resetTime / 1000)))
    }

    const handleLimitExceeded = (resetTime: number) =>
        res.status(429).json({
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: `Too many requests, please retry after ${Math.ceil((resetTime - Date.now()) / 1000)}s`
            }
        })

    if (redisAvailable) {
        incrementRedisCounter(`rate:ip:${ip}`, windowSeconds)
            .then((count) => {
                if (count === null) {
                    // Fallback to in-memory if Redis failed
                    redisAvailable = false
                    return rateLimiter(req, res, next)
                }

                const resetTime = Date.now() + windowMs
                applyHeaders(count, resetTime)
                if (count > maxRequests) {
                    return handleLimitExceeded(resetTime)
                }
                return next()
            })
            .catch((error) => {
                console.error('Rate limiter failure:', error)
                redisAvailable = false
                return rateLimiter(req, res, next)
            })
        return
    }

    const now = Date.now()
    const record = store[ip] || { count: 0, resetTime: now + windowMs }

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
        return handleLimitExceeded(record.resetTime)
    }

    next()
}

/**
 * Per-user rate limiter
 * Used for endpoints that should throttle by authenticated user
 */
export function rateLimitByUser(maxRequests: number = 30, windowMs: number = 60000) {
    const userStore: RateLimitStore = {}

    return (req: Request, res: Response, next: NextFunction) => {
        const userId = (req as any).user?.id || req.ip || 'anonymous'
        const now = Date.now()
        const record = userStore[userId] || { count: 0, resetTime: now + windowMs }

        // Reset if window has passed
        if (now > record.resetTime) {
            record.count = 0
            record.resetTime = now + windowMs
        }

        record.count++
        userStore[userId] = record

        // Set rate limit headers
        res.set('X-RateLimit-Limit', String(maxRequests))
        res.set('X-RateLimit-Remaining', String(Math.max(0, maxRequests - record.count)))
        res.set('X-RateLimit-Reset', String(Math.ceil(record.resetTime / 1000)))

        // Check limit exceeded
        if (record.count > maxRequests) {
            return res.status(429).json({
                error: {
                    code: 'RATE_LIMIT_EXCEEDED',
                    message: `Too many requests, please retry after ${Math.ceil((record.resetTime - now) / 1000)}s`
                }
            })
        }

        next()
    }
}
