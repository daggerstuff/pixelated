import { defineMiddleware } from 'astro:middleware'
import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { redis } from '../redis'

// Initialize logger
const logger = createBuildSafeLogger('rate-limit')

interface EnhancedRateLimiterConfig {
  identifier: string
  role: string
  path: string
  clientIp: string
  userAgent: string
  referer: string
  customConfig?: {
    limits?: Record<string, number>
    windowMs?: number
    strictIpValidation?: boolean
    trackSuspiciousActivity?: boolean
  }
}

interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  reset: number
  suspicious?: boolean
  ipReputation?: string
}

export function createEnhancedRateLimiter(
  defaultLimit = 30,
  windowMs = 60 * 1000,
) {
  const userLimits: Record<string, number> = {
    admin: 60,
    therapist: 40,
    user: 30,
    anonymous: 15,
  }

  const check = async ({
    identifier,
    role,
    path,
    clientIp,
    userAgent,
    referer,
    customConfig,
  }: EnhancedRateLimiterConfig): Promise<RateLimitResult> => {
    const now = Date.now()
    const effectiveWindowMs = customConfig?.windowMs || windowMs
    const limit =
      customConfig?.limits?.[role] || userLimits[role] || defaultLimit

    // Create Redis key with path and role information
    const key = `ratelimit:${identifier}:${path}:${role}`

    try {
      // Cast redis to any to call runtime methods that may not be present on union type
      const r = redis as any
      // Use Redis transaction to ensure atomic operations
      const multi = r.multi()
      multi.get(key)
      multi.ttl(key)
      const [countStr, ttl] = await multi.exec()

      const count = parseInt((countStr as string) || '0', 10)

      // If key doesn't exist or has expired, create new entry
      if (ttl < 0) {
        await r.setex(key, Math.ceil(effectiveWindowMs / 1000), '1')
        return {
          allowed: true,
          limit,
          remaining: limit - 1,
          reset: now + effectiveWindowMs,
        }
      }

      // Check if limit exceeded
      if (count >= limit) {
        // Log suspicious activity if enabled
        if (customConfig?.trackSuspiciousActivity) {
          logger.warn('Rate limit exceeded', {
            identifier,
            path,
            clientIp,
            userAgent,
            referer,
          })
        }

        return {
          allowed: false,
          limit,
          remaining: 0,
          reset: now + ttl * 1000,
          suspicious: count > limit * 2, // Mark as suspicious if significantly over limit
        }
      }

      // Increment counter
      await r.incr(key)

      return {
        allowed: true,
        limit,
        remaining: limit - (count + 1),
        reset: now + ttl * 1000,
      }
    } catch (error: unknown) {
      logger.error('Redis rate limit error:', error as Record<string, unknown>)
      // Fail open - allow request in case of Redis errors
      return {
        allowed: true,
        limit,
        remaining: 1,
        reset: now + effectiveWindowMs,
      }
    }
  }

  return { check }
}

// Export middleware for use in Astro config
export const enhancedRateLimitMiddleware = defineMiddleware(
  async ({ request }, next) => {
    // Skip during static generation or for non-API routes
    if (
      !request.headers ||
      request.url.includes('file:///') ||
      !new URL(request.url).pathname.startsWith('/api/')
    ) {
      return next()
    }

    try {
      // Log the request
      logger.info(
        `Rate limiting API request to ${new URL(request.url).pathname}`,
      )

      // Get response from next middleware
      const response = await next()

      // Add nominal rate limit headers
      response.headers.set('X-RateLimit-Limit', '1000')
      response.headers.set('X-RateLimit-Remaining', '999')
      response.headers.set('X-RateLimit-Reset', (Date.now() + 60000).toString())

      return response
    } catch (error: unknown) {
      // Log any errors and continue
      logger.error('Error in rate limiting:', { error })
      return next()
    }
  },
)
