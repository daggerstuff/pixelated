import type { APIRoute, APIContext } from 'astro'
import { emotionValidationPipeline } from '@/lib/ai/emotions/EmotionValidationPipeline'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { getCurrentUser } from '@/lib/auth'
import {
  createAuditLog,
  AuditEventType,
  AuditEventStatus,
} from '@/lib/audit'

export const POST: APIRoute = async ({ cookies }: never) => {
  const logger = createBuildSafeLogger('validation-api')

  try {
    // Authenticate the request and get user
    const user = await getCurrentUser(cookies)
    if (!user) {
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

    // Check user permissions (must be admin)
    if (user.role !== 'admin') {
      // Create audit log for unauthorized access attempt
      await createAuditLog(
        AuditEventType.SECURITY,
        'validation-pipeline-start-unauthorized',
        user.id || 'unknown',
        'validation-api',
        {
          userId: user.id,
          email: user.email,
        },
        AuditEventStatus.FAILURE,
      )

      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          message:
            'You do not have permission to start the validation pipeline',
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Initialize if not already initialized
    if (!emotionValidationPipeline.isInitialized) {
      await emotionValidationPipeline.initialize()
    }

    // Start continuous validation
    logger.info('Starting continuous validation')
    emotionValidationPipeline.startContinuousValidation()

    // Create audit log for successful start
    await createAuditLog(
      AuditEventType.AI_OPERATION,
      'validation-pipeline-start',
      user.id || 'system',
      'validation-api',
      {
        userId: user.id,
        username: user.fullName || user.email,
      },
      AuditEventStatus.SUCCESS,
    )

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Continuous validation started successfully',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error) {
    // Log the error
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    logger.error(`Error starting continuous validation: ${errorMessage}`)

    // Create audit log for failed start
    await createAuditLog(
      AuditEventType.AI_OPERATION,
      'validation-pipeline-start',
      'system',
      'validation-api',
      {
        error: errorMessage,
      },
      AuditEventStatus.FAILURE,
    )

    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: `Failed to start continuous validation: ${errorMessage}`,
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
