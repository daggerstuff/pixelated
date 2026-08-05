import { randomBytes } from 'crypto'

import { getLogger } from '../logging/logger'
import { redis } from '../redis'
import { getRateLimitService } from './RateLimitService'
import { API_TIERS, inferTierFromRateLimit } from './types'
import type { ApiTier, RateLimitResult } from './types'

const logger = getLogger('RateLimitMiddleware')

const RATE_LIMIT_WINDOW_MS = 60 * 1000

/**
 * Rate limit headers to set on responses.
 */
export function setRateLimitHeaders(
  response: Response,
  result: RateLimitResult,
): Response {
  const headers = new Headers(response.headers)

  // Standard rate limit headers
  headers.set('X-RateLimit-Limit', result.rateLimit.limit.toString())
  headers.set('X-RateLimit-Remaining', result.rateLimit.remaining.toString())
  headers.set(
    'X-RateLimit-Reset',
    Math.ceil(result.rateLimit.resetTimeMs / 1000).toString(),
  )

  // Quota headers
  headers.set(
    'X-RateLimit-Daily-Remaining',
    result.dailyQuota.remaining.toString(),
  )
  headers.set(
    'X-RateLimit-Monthly-Remaining',
    result.monthlyQuota.remaining.toString(),
  )

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

/**
 * Create a 429 Too Many Requests response with Retry-After.
 */
export function createRateLimitResponse(result: RateLimitResult): Response {
  const retryAfter = Math.max(
    result.rateLimit.retryAfterSeconds,
    result.dailyQuota.retryAfterSeconds,
    result.monthlyQuota.retryAfterSeconds,
  )

  const reason = !result.rateLimit.allowed
    ? 'Rate limit exceeded'
    : !result.dailyQuota.allowed
      ? 'Daily quota exceeded'
      : 'Monthly quota exceeded'

  return new Response(
    JSON.stringify({
      error: reason,
      retryAfterSeconds: retryAfter,
      limit: {
        rateLimit: result.rateLimit.limit,
        dailyQuota: result.dailyQuota.limit,
        monthlyQuota: result.monthlyQuota.limit,
      },
      remaining: {
        rateLimit: result.rateLimit.remaining,
        dailyQuota: result.dailyQuota.remaining,
        monthlyQuota: result.monthlyQuota.remaining,
      },
      resetTimeMs: Math.max(
        result.rateLimit.resetTimeMs,
        result.dailyQuota.resetTimeMs,
        result.monthlyQuota.resetTimeMs,
      ),
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Limit': result.rateLimit.limit.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': Math.ceil(
          result.rateLimit.resetTimeMs / 1000,
        ).toString(),
        'X-RateLimit-Daily-Remaining': result.dailyQuota.remaining.toString(),
        'X-RateLimit-Monthly-Remaining':
          result.monthlyQuota.remaining.toString(),
        'Cache-Control': 'no-store',
      },
    },
  )
}

/**
 * Rate limit check for an API key.
 * Returns null if allowed, or a 429 Response if blocked.
 */
export async function checkApiKeyRateLimit(
  apiKeyId: string,
  rateLimitValue: number,
): Promise<
  | { allowed: true; result: RateLimitResult }
  | { allowed: false; response: Response }
> {
  const tier = API_TIERS[inferTierFromRateLimit(rateLimitValue)]
  const service = getRateLimitService()
  const result = await service.check(apiKeyId, tier)

  if (!result.allowed) {
    logger.warn('Rate limit exceeded', {
      apiKeyId,
      tier: tier.name,
      rateLimitAllowed: result.rateLimit.allowed,
      dailyQuotaAllowed: result.dailyQuota.allowed,
      monthlyQuotaAllowed: result.monthlyQuota.allowed,
    })
    return { allowed: false, response: createRateLimitResponse(result) }
  }

  return { allowed: true, result }
}
