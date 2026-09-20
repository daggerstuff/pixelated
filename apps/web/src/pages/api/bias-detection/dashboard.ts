import { createBuildSafeLogger } from '../../../lib/logging/build-safe-logger'

import { BiasDetectionEngine } from '../../../lib/ai/bias-detection'

const logger = createBuildSafeLogger('bias-detection-api')

/**
 * GET /api/bias-detection/dashboard
 *
 * Serves the bias-detection dashboard payload from the real engine.
 * Query parameters:
 *   - timeRange: 1h | 6h | 24h | 7d | 30d | 90d (default 24h)
 *   - demographic: demographic filter (default 'all')
 */
export const GET = async ({
  request,
}: {
  request: Request
}): Promise<Response> => {
  const startTime = Date.now()

  try {
    const url = new URL(request.url)
    const timeRange = url.searchParams.get('timeRange') || '24h'
    const demographicFilter = url.searchParams.get('demographic') || 'all'

    logger.info('Fetching bias detection dashboard data', {
      timeRange,
      demographicFilter,
    })

    // The engine is a cheap config-only construction; per-request
    // instantiation keeps the endpoint stateless.
    const engine = new BiasDetectionEngine()
    const data = await engine.getDashboardData({
      timeRange,
      demographicFilter,
    })

    const processingTime = Math.max(Date.now() - startTime, 1)

    logger.info('Dashboard data retrieved successfully', {
      processingTime,
      alertCount: data.alerts?.length ?? 0,
      sessionCount: data.summary?.totalSessions ?? 0,
    })

    return new Response(
      JSON.stringify({
        success: true,
        data,
        processingTime,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Processing-Time': String(processingTime),
        },
      },
    )
  } catch (error: unknown) {
    logger.error('Failed to fetch dashboard data', {
      error: String(error),
    })

    const processingTime = Math.max(Date.now() - startTime, 1)

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Dashboard Data Retrieval Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        processingTime,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Processing-Time': String(processingTime),
        },
      },
    )
  }
}
