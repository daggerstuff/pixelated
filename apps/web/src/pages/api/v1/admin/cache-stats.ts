import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { getCacheMetricsService } from '@/lib/services/cache-metrics'

import { protectRoute } from '../../../../lib/auth/serverAuth'

export const prerender = false
const logger = createBuildSafeLogger('admin-cache-stats-api')

/**
 * GET /api/v1/admin/cache-stats
 *
 * Returns cache performance metrics: overall hit ratio, per-prefix breakdown,
 * and top-missed keys. Admin-only.
 *
 * Query params:
 *   - refresh: If "1", persists counters to Redis before reading.
 */
export const GET = protectRoute({
  requiredRole: 'admin',
  validateIPMatch: true,
  validateUserAgent: true,
})(async ({ request }) => {
  try {
    const params = new URL(request.url).searchParams
    const shouldPersist = params.get('refresh') === '1'

    const metricsService = getCacheMetricsService()

    if (shouldPersist) {
      await metricsService.persist()
    }

    const stats = await metricsService.getStats()

    logger.info('Cache stats requested', {
      hitRatio: stats.overallHitRatio,
      total: stats.overallTotal,
    })

    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    })
  } catch (error: unknown) {
    logger.error('Failed to retrieve cache stats', { error })

    return new Response(
      JSON.stringify({
        error: 'Failed to retrieve cache statistics',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
})
