import { defineMiddleware } from 'astro:middleware'
import { getSession } from '../auth/session'
import { createBuildSafeLogger } from '../logging/build-safe-logger'

// Initialize logger
const logger = createBuildSafeLogger('default')

// Rate limit configuration for different API endpoints
export interface RateLimitConfig {
  /** Path pattern to match */
  path: string
  /** Rate limits by role */
  limits: Record<string, number>
  /** Time window in milliseconds */
  windowMs: number
}

// Default rate limit configuration for different endpoints
const rateLimitConfigs: RateLimitConfig[] = [
  {
    path: '/api/ai/',
    limits: {
      admin: 120, // 120 requests per minute for admins
      therapist: 80, // 80 requests per minute for therapists
      user: 40, // 40 requests per minute for regular users
      anonymous: 10, // 10 requests per minute for unauthenticated users
    },
    windowMs: 60 * 1000, // 1 minute
  },
  {
    path: '/api/auth/',
    limits: {
      admin: 30,
      therapist: 30,
      user: 20,
      anonymous: 5,
    },
    windowMs: 60 * 1000, // 1 minute
  },
  {
    path: '/api/',
    limits: {
      admin: 300,
      therapist: 200,
      user: 100,
      anonymous: 30,
    },
    windowMs: 60 * 1000, // 1 minute
  },
]

/**
 * Redis-based rate limiter implementation
 */
export class RateLimiter {
  private readonly defaultLimit: number
  private readonly windowMs: number
  private readonly userLimits: Record<string, number>
  private storage: Map<string, number>

  constructor(defaultLimit = 30, windowMs = 60 * 1000) {
    this.defaultLimit = defaultLimit
    this.windowMs = windowMs
    this.userLimits = {
      admin: 60,
      therapist: 40,
      user: 30,
      anonymous: 15,
    }
    this.storage = new Map<string, number>()
  }

  /**
   * Check if a request is within rate limits
   */
  check(
    key: string,
    role: string,
    limits: Record<string, number> = rateLimitConfigs[2].limits,
    windowMs: number = rateLimitConfigs[2].windowMs,
  ): {
    allowed: boolean
    limit: number
    remaining: number
    reset: number
  } {
    const limit = limits[role] || limits.anonymous || 10
    const now = Date.now()
    const resetTime = now + windowMs

    // Get current count from storage
    const currentCount = this.storage.get(key) || 0

    if (currentCount >= limit) {
      return {
        allowed: false,
        limit,
        remaining: 0,
        reset: resetTime,
      }
    }

    // Increment count
    this.storage.set(key, currentCount + 1)

    // Set expiry
    setTimeout(() => {
      this.storage.delete(key)
    }, windowMs)

    return {
      allowed: true,
      limit,
      remaining: limit - (currentCount + 1),
      reset: resetTime,
    }
  }
}

// Export an instance of RateLimiter for direct use in API routes
export const rateLimit = new RateLimiter()

// Define the middleware for use in Astro.config.mjs
export const rateLimitMiddleware = defineMiddleware(
  async ({ request }, next) => {
    // Skip for non-API routes or during static generation
    if (!request.url.includes('/api/') || request.url.includes('file:///')) {
      return next()
    }

    try {
      // Get client IP for rate limiting
      const clientIp =
        request.headers.get('x-forwarded-for') ||
        request.headers.get('cf-connecting-ip') ||
        'anonymous'

      // Get user role from session
      const session = await getSession(request)
      const role = session?.user?.role || 'anonymous'

      // Get the pathname for matching against rate limit configs
      const { pathname } = new URL(request.url)

      // Find the most specific rate limit config that matches the path
      const config =
        rateLimitConfigs.find((cfg) => pathname.startsWith(cfg.path)) ||
        rateLimitConfigs[2]

      // Check rate limit
      const rateLimitResult = rateLimit.check(
        clientIp,
        role,
        config.limits,
        config.windowMs,
      )

      if (!rateLimitResult.allowed) {
        logger.warn(
          `Rate limit exceeded for ${role} at ${pathname} from ${clientIp}`,
        )

        return new Response(
          JSON.stringify({
            success: false,
            error: 'Rate limit exceeded. Please try again later.',
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'X-RateLimit-Limit': rateLimitResult.limit.toString(),
              'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
              'X-RateLimit-Reset': rateLimitResult.reset.toString(),
            },
          },
        )
      }

      // Add rate limit headers
      const response = await next()
      if (response) {
        response.headers.set(
          'X-RateLimit-Limit',
          rateLimitResult.limit.toString(),
        )
        response.headers.set(
          'X-RateLimit-Remaining',
          rateLimitResult.remaining.toString(),
        )
        response.headers.set(
          'X-RateLimit-Reset',
          rateLimitResult.reset.toString(),
        )
      }

      return response
    } catch (error: unknown) {
      logger.error(
        'Error in rate limiting middleware:',
        error as Record<string, unknown>,
      )
      return next()
    }
  },
)
