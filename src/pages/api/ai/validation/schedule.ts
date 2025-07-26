import type { APIRoute } from 'astro'
import { validationRunner } from '../../../../lib/ai/validation/ContinuousValidationRunner'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { isAuthenticated } from '../../../../lib/auth'
import {
  createAuditLog,
  AuditEventType,
  AuditEventStatus,
} from '../../../../lib/audit'

export const POST: APIRoute = async ({ request }) => {
  const logger = createBuildSafeLogger('validation-schedule')

  try {
    // Authenticate the request
    const authResult = await isAuthenticated(request)
    if (!authResult.authenticated) {
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
    if (!authResult.user?.isAdmin) {
      // Create audit log for unauthorized access attempt
      await createAuditLog(
        AuditEventType.SECURITY_EVENT,
        'validation-schedule-unauthorized',
        authResult.user?.id || 'unknown',
        'validation-api',
        {
          userId: authResult.user?.id,
          email: authResult.user?.email,
        },
        AuditEventStatus.FAILURE,
      )

      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: 'You do not have permission to schedule validation runs',
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
    const { action, schedule } = body

    // Initialize the validation runner if needed
    await validationRunner.initialize()

    if (action === 'schedule' && schedule) {
      // Set up schedule
      await validationRunner.scheduleValidationRuns(schedule)

      // Create audit log
      await createAuditLog(
        AuditEventType.AI_OPERATION,
        'validation-schedule-create',
        authResult.user?.id || 'system',
        'validation-api',
        {
          userId: authResult.user?.id,
          schedule,
        },
        AuditEventStatus.SUCCESS,
      )

      return new Response(
        JSON.stringify({
          success: true,
          message: `Validation schedule set to: ${schedule}`,
          state: validationRunner.getState(),
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    } else if (action === 'stop') {
      // Stop scheduling
      validationRunner.stopScheduledRuns()

      // Create audit log
      await createAuditLog(
        AuditEventType.AI_OPERATION,
        'validation-schedule-stop',
        authResult.user?.id || 'system',
        'validation-api',
        {
          userId: authResult.user?.id,
        },
        AuditEventStatus.SUCCESS,
      )

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Validation schedule stopped',
          state: validationRunner.getState(),
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    } else if (action === 'get') {
      // Get current state
      return new Response(
        JSON.stringify({
          success: true,
          state: validationRunner.getState(),
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    } else {
      return new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: 'Invalid action. Supported actions: schedule, stop, get',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }
  } catch (error) {
    // Log the error
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    logger.error(`Validation schedule error: ${errorMessage}`)

    // Create audit log
    await createAuditLog(
      AuditEventType.AI_OPERATION,
      'validation-schedule',
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
        message: `Failed to manage validation schedule: ${errorMessage}`,
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
