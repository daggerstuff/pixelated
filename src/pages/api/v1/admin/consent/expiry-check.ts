import { getConsentExpiryService } from '@/lib/consent'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

import { protectRoute } from '../../../../../lib/auth/serverAuth'

export const prerender = false
const logger = createBuildSafeLogger('admin-consent-expiry-api')

/**
 * GET /api/v1/admin/consent/expiry-check
 * Runs the consent expiry check and returns expiring/expired consents
 * with re-consent reminders.
 * Admin-only, no-store headers (PHI boundary).
 */
export const GET = protectRoute({
  requiredRole: 'admin',
  validateIPMatch: true,
  validateUserAgent: true,
})(async ({ request }) => {
  try {
    const searchParams = new URL(request.url).searchParams
    const days = searchParams.get('days')

    const service = getConsentExpiryService()

    if (days) {
      const dayNum = parseInt(days, 10)
      if (!Number.isNaN(dayNum) && dayNum > 0) {
        service.setConfig({ warningDays: dayNum })
      }
    }

    const result = await service.checkExpiries()

    logger.info('Expiry check completed', result.summary)

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error) {
    logger.error('Failed to run expiry check', { error: String(error) })
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  }
})
