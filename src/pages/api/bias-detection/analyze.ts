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

    // Parse request body
    const body = await request.json()
    const { text, sessionId, metadata } = body

    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: 'Text parameter is required and must be a string',
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

    // Analyze text for bias
    const result = await biasDetectionEngine.analyzeSession(
      {
        sessionId: sessionId || 'unknown',
        content: text,
        metadata: metadata || {},
      },
      {
        userId: authResult.user?.id || 'unknown',
        email: authResult.user?.email || 'unknown',
      },
      {
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    )

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    logger.error('Error in bias detection analysis:', error)

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
