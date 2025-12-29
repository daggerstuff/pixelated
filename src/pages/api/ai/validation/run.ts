// Note: APIRoute type not available in current Astro version
import { emotionValidationPipeline } from '../../../../lib/ai/emotions/EmotionValidationPipeline'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { isAuthenticated } from '@/lib/auth'
import {
  createAuditLog,
  AuditEventType,
  AuditEventStatus,
} from '../../../../lib/audit'

export const POST = async ({
  request,
}: {
  request: Request
}): Promise<Response> => {
  const logger = createBuildSafeLogger('validation-api')

  try {
    // Authenticate the request
    const authResult = await isAuthenticated(request as any)
    if (!authResult || !authResult['authenticated']) {
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
        AuditEventType.SECURITY,
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
    const results = await (
      emotionValidationPipeline as unknown as {
        runValidation?: () => Promise<unknown[]>
      }
    )?.runValidation?.()

    // Create audit log for successful run
    await createAuditLog(
      AuditEventType.AI_OPERATION,
      'validation-pipeline-run',
      (authResult as unknown as { user?: { id?: string } })?.user?.id ||
        'system',
      'validation-api',
      {
        userId: (authResult as unknown as { user?: { id?: string } })?.user?.id,
        resultsCount: results?.length || 0,
        passedCount:
          results?.filter?.((r: unknown) => (r as { passed?: boolean })?.passed)
            ?.length || 0,
      },
      AuditEventStatus.SUCCESS,
    )

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Validation run completed successfully',
        resultsCount: results?.length || 0,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error: unknown) {
    // Log the error
    const errorMessage =
      error instanceof Error ? String(error) : 'Unknown error'
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
