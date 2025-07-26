import type { NextApiRequest, NextApiResponse } from 'next'
import { RateLimiter } from '../../utils/rate-limiter'

// Create a rate limiter instance
const limiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
})

/**
 * Rate limiting middleware for Next.js API routes
 *
 * @param req The Next.js API request
 * @param res The Next.js API response
 * @returns A Promise that resolves when the middleware is done
 */
export function rateLimiter(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  // Get client IP from headers or direct connection
  const ip =
    req.headers['x-forwarded-for'] ||
    req.headers['x-real-ip'] ||
    req.socket.remoteAddress ||
    'unknown'

  // Use the first IP if x-forwarded-for returns a comma-separated list
  const clientIp =
    typeof ip === 'string'
      ? ip.split(',')[0].trim()
      : Array.isArray(ip)
        ? ip[0]
        : 'unknown'

  // Check rate limit for this IP
  return limiter.check(clientIp).then((result) => {
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', result.limit.toString())
    res.setHeader('X-RateLimit-Remaining', result.remaining.toString())
    res.setHeader('X-RateLimit-Reset', result.reset.toString())

    // If rate limit is exceeded, return 429 Too Many Requests
    if (!result.success) {
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
      })

      // This is a rejected promise to stop handling the request
      return Promise.reject('Rate limit exceeded')
    }

    // Continue processing the request
    return Promise.resolve()
  })
}
