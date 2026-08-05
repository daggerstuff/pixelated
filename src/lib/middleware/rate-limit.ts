import { defineMiddleware } from 'astro:middleware'

import { getSession } from '../auth/session'
import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { getRequestHeader } from '../utils/request-headers'

// Initialize logger
const logger = createBuildSafeLogger('rate-limit')

function safeParseInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback
  const parsed = parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

// Read rate limit configuration from environment variables
// Falls back to defaults if not set (60 second window, 100 requests max)
const RATE_LIMIT_WINDOW_MS = safeParseInt(
  process.env['RATE_LIMIT_WINDOW_MS'],
  60_000,
)
const RATE_LIMIT_MAX_REQUESTS = safeParseInt(
  process.env['RATE_LIMIT_MAX_REQUESTS'],
  100,
)

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
// Uses env vars for the base limits, with role-based multipliers
const rateLimitConfigs: RateLimitConfig[] = [
  {
    path: '/api/ai/',
    limits: {
      admin: Math.round(RATE_LIMIT_MAX_REQUESTS * 1.2), // 120% of base for admins
      therapist: Math.round(RATE_LIMIT_MAX_REQUESTS * 0.8), // 80% of base for therapists
      user: Math.round(RATE_LIMIT_MAX_REQUESTS * 0.4), // 40% of base for regular users
      anonymous: Math.round(RATE_LIMIT_MAX_REQUESTS * 0.1), // 10% of base for unauthenticated users
    },
    windowMs: RATE_LIMIT_WINDOW_MS,
  },
  {
    path: '/api/auth/',
    limits: {
      admin: Math.round(RATE_LIMIT_MAX_REQUESTS * 0.3),
      therapist: Math.round(RATE_LIMIT_MAX_REQUESTS * 0.3),
      user: Math.round(RATE_LIMIT_MAX_REQUESTS * 0.2),
      anonymous: Math.round(RATE_LIMIT_MAX_REQUESTS * 0.05),
    },
    windowMs: RATE_LIMIT_WINDOW_MS,
  },
  {
    path: '/api/',
    limits: {
      admin: RATE_LIMIT_MAX_REQUESTS * 3, // 3x base for admins
      therapist: RATE_LIMIT_MAX_REQUESTS * 2, // 2x base for therapists
      user: RATE_LIMIT_MAX_REQUESTS, // base limit for users
      anonymous: Math.round(RATE_LIMIT_MAX_REQUESTS * 0.3), // 30% of base for anonymous
    },
    windowMs: RATE_LIMIT_WINDOW_MS,
  },
]

/**
 * Redis-based rate limiter implementation
 */
export class RateLimiter {
  private readonly storage: Map<string, number>

  constructor(defaultLimit = 30) {
    this.storage = new Map<string, number>()
  }

  /**
   * Check if a request is within rate limits
   */
  check(
    key: string,
    role: string,
    limits: Record<string, number> = rateLimitConfigs?.[2].limits,
    windowMs: number = rateLimitConfigs?.[2].windowMs,
  ): {
    allowed: boolean
    limit: number
    remaining: number
    reset: number
  } {
    const limit = limits[role] ?? limits['anonymous'] ?? 10
    const now = Date.now()
    const resetTime = now + windowMs

    // Get current count from storage
    const currentCount = this.storage.get(key) ?? 0

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

// Define the middleware for use in the main middleware sequence
export const rateLimitMiddleware = defineMiddleware(
  async ({ request }, next) => {
    // Skip for non-API routes or during static generation
    if (!request.url.includes('/api/') || request.url.includes('file:///')) {
      return next()
    }

    try {
      // Get the pathname for matching against rate limit configs
      const { pathname } = new URL(request.url)

      // Exempt health check endpoints from rate limiting (per PIX-3944 requirements)
      if (pathname === '/health' || pathname.endsWith('/health')) {
        return next()
      }

      // Get client IP for rate limiting
      const clientIp =
        getRequestHeader(request, 'x-forwarded-for')?.split(',')[0].trim() ??
        getRequestHeader(request, 'cf-connecting-ip') ??
        getRequestHeader(request, 'x-real-ip') ??
        'anonymous'

      // Get user role from session
      const session = await getSession(request)
      const role = session?.user?.role ?? 'anonymous'

      // Find the most specific rate limit config that matches the path
      const config =
        rateLimitConfigs.find((cfg) => pathname.startsWith(cfg.path)) ??
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

        // Calculate Retry-After in seconds
        const retryAfterSeconds = Math.ceil(
          (rateLimitResult.reset - Date.now()) / 1000,
        )

        return new Response(
          JSON.stringify({
            success: false,
            error: 'Rate limit exceeded. Please try again later.',
            retryAfter: retryAfterSeconds,
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'X-RateLimit-Limit': rateLimitResult.limit.toString(),
              'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
              'X-RateLimit-Reset': rateLimitResult.reset.toString(),
              'Retry-After': retryAfterSeconds.toString(),
            },
          },
        )
      }

      // Add rate limit headers to successful responses
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
      logger.error('Error in rate limiting middleware:', error)
      // Fail open - allow request through if rate limiting errors
      return next()
    }
  },
)
