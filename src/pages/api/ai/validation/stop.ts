import { emotionValidationPipeline } from '../../../../lib/ai/emotions/EmotionValidationPipeline'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { getCurrentUser } from '@/lib/auth'
import {
  createAuditLog,
  AuditEventType,
  AuditEventStatus,
} from '../../../../lib/audit'

export const POST = async ({
  cookies,
}: {
  cookies: { get(name: string): { value: string } | undefined }
}): Promise<Response> => {
  const logger = createBuildSafeLogger('validation-api')

  try {
    // Authenticate the request
    if (!cookies) {
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
      );
    }
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
        'validation-pipeline-stop-unauthorized',
        user.id,
        'validation-api',
        {
          userId: user.id,
          role: user.role,
        },
        AuditEventStatus.FAILURE,
      )

      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: 'You do not have permission to stop the validation pipeline',
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Stop continuous validation
    logger.info('Stopping continuous validation')
    emotionValidationPipeline.stopContinuousValidation()

    // Create audit log for successful stop
    await createAuditLog(
      AuditEventType.AI_OPERATION,
      'validation-pipeline-stop',
      user.id,
      'validation-api',
      {
        userId: user.id,
      },
      AuditEventStatus.SUCCESS,
    )

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Continuous validation stopped successfully',
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
    logger.error(`Error stopping continuous validation: ${errorMessage}`)

    // Create audit log for failed stop
    await createAuditLog(
      AuditEventType.AI_OPERATION,
      'validation-pipeline-stop',
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
        message: `Failed to stop continuous validation: ${errorMessage}`,
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
