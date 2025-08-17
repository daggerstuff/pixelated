// import type { APIRoute } from 'astro'
import { cancelDataExportRequest } from '../../../lib/services/patient-rights/dataPortabilityService'
import { createBuildSafeLogger } from '../../../../lib/logging/build-safe-logger'
import { protectApi } from '../../../lib/auth/apiAuth'
import { z } from 'zod'

const logger = createBuildSafeLogger('api-cancel-export')

// Schema for validating cancel export request
const cancelExportSchema = z.object({
  exportId: z.string().min(1, 'Export ID is required'),
  reason: z.string().optional(),
})

export const POST = async ({ request }) => {
  try {
    // Parse request body
    const body = await request.json()

    // Validate request data
    const validation = cancelExportSchema.safeParse(body)

    if (!validation.success) {
      const errors = validation.error.flatten()
      logger.warn('Invalid cancel export request', { errors })

      return new Response(
        JSON.stringify({
          success: false,
          message: 'Invalid request data',
          errors: errors.fieldErrors,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const { exportId, reason } = validation.data

    // Validate authentication
    const authResult = await protectApi(request)

    if (!authResult.success) {
      logger.warn('Unauthorized attempt to cancel export request', {
        ip: request.headers.get('x-forwarded-for') || 'unknown',
      })

      return new Response(
        JSON.stringify({
          success: false,
          message: 'Authentication required',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // For simplicity, assume authenticated users have permission

    // Cancel the export request
    const result = await cancelDataExportRequest({
      exportId,
      cancelledBy: authResult.userId || 'unknown',
      reason: reason || 'User-initiated cancellation',
    })

    if (!result.success) {
      // If the error is that the export request doesn't exist, return 404
      if (result.message.includes('not found')) {
        logger.warn('Export request not found for cancellation', { exportId })

        return new Response(
          JSON.stringify({
            success: false,
            message: 'Export request not found',
          }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      // If the export can't be canceled due to its status
      if (
        result.message.includes('already completed') ||
        result.message.includes('already cancelled')
      ) {
        logger.warn('Cannot cancel export due to its status', {
          exportId,
          status: result.status,
        })

        return new Response(
          JSON.stringify({
            success: false,
            message: result.message,
            status: result.status,
          }),
          {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      // For other errors
      logger.error('Failed to cancel export request', { error: result.message })

      return new Response(
        JSON.stringify({
          success: false,
          message: result.message,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Log successful cancellation
    logger.info('Export request cancelled successfully', {
      exportId,
      cancelledBy: authResult.userId,
      reason,
    })

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Export request cancelled successfully',
        data: {
          exportId,
          status: 'cancelled',
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    logger.error('Error cancelling export request', {
      error: error instanceof Error ? error.message : String(error),
    })

    return new Response(
      JSON.stringify({
        success: false,
        message: 'An internal server error occurred',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
