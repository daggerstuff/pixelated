import { protectRoute } from '../../../../../lib/auth/serverAuth'
import { getRateLimitService } from '../../../../../lib/rate-limit/RateLimitService'
import {
  API_TIERS,
  inferTierFromRateLimit,
} from '../../../../../lib/rate-limit/types'
import { developerApiKeyManager } from '../../../../../lib/db/developer-api-keys'

export const prerender = false

export const GET = protectRoute({
  requiredRole: 'admin',
  validateIPMatch: true,
  validateUserAgent: true,
})(async ({ request }) => {
  const url = new URL(request.url)
  const stats = url.searchParams.get('stats') === 'true'

  // Get all API keys
  const keys = await developerApiKeyManager.listAllApiKeys({ activeOnly: true })
  const service = getRateLimitService()

  // Get usage for each key
  const usages = await Promise.all(
    keys.map(async (k) => {
      const tier = API_TIERS[inferTierFromRateLimit(k.rate_limit)]
      return service.getUsage(k.id, tier)
    }),
  )

  if (stats) {
    const totalKeys = usages.length
    const keysNearRateLimit = usages.filter(
      (u) => u.rateLimit.remaining / u.rateLimit.limit < 0.1,
    ).length
    const keysNearDailyQuota = usages.filter(
      (u) => u.dailyQuota.remaining / u.dailyQuota.limit < 0.2,
    ).length
    const keysNearMonthlyQuota = usages.filter(
      (u) => u.monthlyQuota.remaining / u.monthlyQuota.limit < 0.2,
    ).length

    const tierDistribution: Record<string, number> = {}
    for (const u of usages) {
      tierDistribution[u.tier.name] = (tierDistribution[u.tier.name] ?? 0) + 1
    }

    return new Response(
      JSON.stringify({
        totalKeys,
        keysNearRateLimit,
        keysNearDailyQuota,
        keysNearMonthlyQuota,
        tierDistribution,
        usages,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      },
    )
  }

  return new Response(JSON.stringify({ usages }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
})
