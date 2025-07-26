import { BiasDetectionEngine } from '@/lib/ai/bias-detection/BiasDetectionEngine'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { isAuthenticated } from '@/lib/auth'

const logger = createBuildSafeLogger('bias-detection-api')
const biasDetectionEngine = new BiasDetectionEngine()

export const POST = async ({ request }: { request: Request }) => {
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
          message: 'You do not have permission to send test notifications',
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Parse request body
    const body = await request.json()
    const { notificationType, testData } = body

    if (!notificationType || !testData) {
      return new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: 'notificationType and testData are required',
        }),
        {
          status: 400,
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

    // Send test notification
    const result = await biasDetectionEngine.sendTestNotification(
      notificationType,
      testData,
      {
        userId: authResult.user?.id,
        email: authResult.user?.email,
      },
    )

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    logger.error('Error sending test notification:', error)

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
