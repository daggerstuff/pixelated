import { protectRoute } from '../../../../../lib/auth/serverAuth'
import { developerApiKeyManager } from '../../../../../lib/db/developer-api-keys'
import { getRateLimitService } from '../../../../../lib/rate-limit/RateLimitService'
import {
  API_TIERS,
  inferTierFromRateLimit,
} from '../../../../../lib/rate-limit/types'
import type { QuotaAlert } from '../../../../../lib/rate-limit/types'

export const prerender = false

export const GET = protectRoute({
  requiredRole: 'admin',
  validateIPMatch: true,
  validateUserAgent: true,
})(async ({ request }) => {
  const service = getRateLimitService()
  const keys = await developerApiKeyManager.listAllApiKeys({ activeOnly: true })
  const alerts: QuotaAlert[] = []

  for (const k of keys) {
    const tier = API_TIERS[inferTierFromRateLimit(k.rate_limit)]
    const usage = await service.getUsage(k.id, tier)

    if (!usage.alertThresholdExceeded) continue

    if (usage.rateLimit.remaining / usage.rateLimit.limit < 0.1) {
      alerts.push(
        service.createAlert(
          k.id,
          'rate_limit',
          tier,
          usage.rateLimit.currentWindowCount,
          tier.requestsPerMinute,
        ),
      )
    }

    if (usage.dailyQuota.remaining / usage.dailyQuota.limit < 0.2) {
      const used = tier.dailyQuota - usage.dailyQuota.remaining
      alerts.push(
        service.createAlert(k.id, 'daily_quota', tier, used, tier.dailyQuota),
      )
    }

    if (usage.monthlyQuota.remaining / usage.monthlyQuota.limit < 0.2) {
      const used = tier.monthlyQuota - usage.monthlyQuota.remaining
      alerts.push(
        service.createAlert(
          k.id,
          'monthly_quota',
          tier,
          used,
          tier.monthlyQuota,
        ),
      )
    }
  }

  const summary = {
    totalAlerts: alerts.length,
    rateLimitAlerts: alerts.filter((a) => a.type === 'rate_limit').length,
    dailyQuotaAlerts: alerts.filter((a) => a.type === 'daily_quota').length,
    monthlyQuotaAlerts: alerts.filter((a) => a.type === 'monthly_quota').length,
    keysWithAlerts: new Set(alerts.map((a) => a.apiKeyId)).size,
    alerts,
  }

  return new Response(JSON.stringify(summary), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
})
