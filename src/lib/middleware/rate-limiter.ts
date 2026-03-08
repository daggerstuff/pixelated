import { RateLimiter } from '../../utils/rate-limiter'

// Create a rate limiter instance
const limiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
})

/**
 * Rate limiting middleware for Astro API routes
 *
 * @param request The request object
 * @returns A Response if rate limited, undefined otherwise
 */
export async function rateLimiter(
  request: Request,
): Promise<Response | undefined> {
  // Get client IP from headers
  const ip =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    'unknown'

  // Use the first IP if x-forwarded-for returns a comma-separated list
  const clientIp = ip.split(',')[0].trim()

  // Check rate limit for this IP
  const result = await limiter.check(clientIp)

  // If rate limit is exceeded, return 429 Too Many Requests
  if (!result.success) {
    return new Response(
      JSON.stringify({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': result.reset.toString(),
          'Retry-After': Math.ceil(
            (result.reset - Date.now()) / 1000,
          ).toString(),
        },
      },
    )
  }

  // Continue processing the request
  return undefined
}
