/**
 * Simple in-memory rate limiter implementation
 * In production, this should be replaced with a Redis-based solution
 */
const rateLimits = new Map<string, number[]>()

/**
 * Check if a user has exceeded their rate limi
 */
export function checkRateLimit(
  userId: string,
  maxRequestsPerMinute: number,
): boolean {
  const now = Date.now()
  const windowMs = 60 * 1000 // 1 minute window

  // Get user's request timestamps
  const requests = rateLimits.get(userId) || []

  // Remove old requests outside the window
  const validRequests = requests.filter(
    (timestamp) => now - timestamp < windowMs,
  )

  // Check if user has exceeded limi
  if (validRequests.length >= maxRequestsPerMinute) {
    return true // Rate limited
  }

  // Add current request
  validRequests.push(now)
  rateLimits.set(userId, validRequests)

  return false // Not rate limited
}
