import { BiasDetectionEngine } from '@/lib/ai/bias-detection/BiasDetectionEngine'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { isAuthenticated } from '@/lib/auth'

const logger = createBuildSafeLogger('bias-detection-api')
const biasDetectionEngine = new BiasDetectionEngine()

export const GET = async ({ request }: { request: Request }) => {
  try {
    // Authenticate request
    const authResult = await isAuthenticated(request)
    if (!authResult?.authenticated) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          message: 'You must be authenticated to access this endpoint',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Check admin permission
    if (!authResult.user?.isAdmin) {
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: 'You do not have permission to access the dashboard',
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Initialize engine if needed
    if (!biasDetectionEngine.getInitializationStatus()) {
      await biasDetectionEngine.initialize()
    }

    // Get dashboard data
    const dashboardData = await biasDetectionEngine.getDashboardData({
      includeDetails: true,
    })

    return new Response(JSON.stringify(dashboardData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    logger.error('Error fetching dashboard data:', error)

    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }
}
