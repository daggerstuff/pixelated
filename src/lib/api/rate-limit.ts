import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { getSession } from '../auth/session'
import { createEnhancedRateLimiter } from '../middleware/enhanced-rate-limit'
import { generateHash } from '../crypto/hash'

// Initialize logger
const logger = createBuildSafeLogger('default')

// Create our limiter instance with default settings
const enhancedRateLimiter = createEnhancedRateLimiter(30, 60 * 1000)

/**
 * Applies rate limiting to an API request
 * Returns rate limit information and headers
 *
 * @param request The incoming request
 * @param endpoint The API endpoint path (e.g., '/api/auth/login')
 * @param customConfig Optional custom rate limit configuration
 * @returns Rate limit check result and response headers
 */
export async function applyRateLimit(
  request: Request,
  endpoint: string,
  customConfig?: {
    limits?: Record<string, number>
    windowMs?: number
    strictIpValidation?: boolean
    trackSuspiciousActivity?: boolean
  },
) {
  // Get client information
  const url = new URL(request.url)
  const path = url.pathname
  const clientIp =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    'unknown'
  const userAgent = request.headers.get('user-agent') || 'unknown'
  const referer = request.headers.get('referer') || 'direct'

  // Try to get user from session
  let userId = 'anonymous'
  let role = 'anonymous'

  try {
    const session = await getSession(request)
    if (session?.user?.id) {
      userId = session.user.id
      role = session.user.role || 'user'
    }
  } catch (error: unknown) {
    logger.warn('Error getting session for rate limiting:', { error, path })
  }

  // Create a unique client identifier by hashing the IP and user ID
  const clientIdentifier = await generateHash(`${clientIp}:${userId}`)

  // Apply the rate limit check
  const result = await enhancedRateLimiter.check({
    identifier: clientIdentifier,
    role,
    path: endpoint,
    clientIp,
    userAgent,
    referer,
    customConfig,
  })

  // Generate response headers
  const headers = new Headers()
  headers.set('X-RateLimit-Limit', result.limit.toString())
  headers.set('X-RateLimit-Remaining', result.remaining.toString())
  headers.set('X-RateLimit-Reset', result.reset.toString())

  if (!result.allowed) {
    headers.set(
      'Retry-After',
      Math.ceil((result.reset - Date.now()) / 1000).toString(),
    )

    // Log rate limit hit
    logger.warn(`Rate limit exceeded for ${path}`, {
      userId,
      clientIp,
      role,
      suspicious: result.suspicious,
      ipReputation: result.ipReputation,
    })
  }

  return {
    result,
    headers,
    createErrorResponse: () => {
      if (!result.allowed) {
        return new Response(
          JSON.stringify({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
          }),
          {
            status: 429,
            headers,
          },
        )
      }
      return null
    },
  }
}
