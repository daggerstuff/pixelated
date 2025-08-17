import type { APIRoute } from 'astro'
import { emotionValidationPipeline } from '../../../../lib/ai/emotions/EmotionValidationPipeline'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { isAuthenticated } from '../../../../lib/auth'
import {
  createAuditLog,
  AuditEventType,
  AuditEventStatus,
} from '../../../../lib/audit'

export const POST: APIRoute = async ({ request }) => {
  const logger = createBuildSafeLogger('validation-api')

  try {
    // Authenticate the request
    const authResult = await isAuthenticated(request)
    if (!authResult['authenticated']) {
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
    if (!authResult['user']?.['isAdmin']) {
      // Create audit log for unauthorized access attempt
      await createAuditLog(
        AuditEventType.SECURITY_EVENT,
        'validation-pipeline-run-unauthorized',
        authResult['user']?.['id'] || 'unknown',
        'validation-api',
        {
          userId: authResult['user']?.['id'],
          email: authResult['user']?.['email'],
        },
        AuditEventStatus.FAILURE,
      )

      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: 'You do not have permission to run the validation pipeline',
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Initialize if not already
    if (!emotionValidationPipeline.isInitialized) {
      await emotionValidationPipeline.initialize()
    }

    // Run validation
    logger.info('Starting validation run')
    const results = await emotionValidationPipeline.runValidation()

    // Create audit log for successful run
    await createAuditLog(
      AuditEventType.AI_OPERATION,
      'validation-pipeline-run',
      authResult.user?.id || 'system',
      'validation-api',
      {
        userId: authResult.user?.id,
        resultsCount: results.length,
        passedCount: results.filter((r) => r.passed).length,
      },
      AuditEventStatus.SUCCESS,
    )

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Validation run completed successfully',
        resultsCount: results.length,
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
    logger.error(`Error running validation: ${errorMessage}`)

    // Create audit log for failed run
    await createAuditLog(
      AuditEventType.AI_OPERATION,
      'validation-pipeline-run',
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
        message: `Failed to run validation: ${errorMessage}`,
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
