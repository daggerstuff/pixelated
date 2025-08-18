// import type { APIRoute } from 'astro'
import { getDataExportDetails } from '../../../lib/services/patient-rights/dataPortabilityService'
import { createBuildSafeLogger } from '../../../../lib/logging/build-safe-logger'
import { protectApi } from '../../../lib/auth/apiAuth'
import { z } from 'zod'

const logger = createBuildSafeLogger('api-export-status')

// Schema for validating export status request
const exportStatusSchema = z.object({
  exportId: z.string().min(1, 'Export ID is required'),
})

export const GET = async ({ request, url }) => {
  try {
    // Get exportId from query parameters
    const exportId = url.searchParams.get('exportId')

    if (!exportId) {
      logger.warn('Missing export ID in status request')

      return new Response(
        JSON.stringify({
          success: false,
          message: 'Export ID is required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Validate the export ID
    const validation = exportStatusSchema.safeParse({ exportId })

    if (!validation.success) {
      const errors = validation.error.flatten()
      logger.warn('Invalid export ID format', { errors })

      return new Response(
        JSON.stringify({
          success: false,
          message: 'Invalid export ID format',
          errors: errors.fieldErrors,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Validate authentication
    const authResult = await protectApi(request)

    if (!authResult.success) {
      logger.warn('Unauthorized attempt to check export status', {
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

    // Get the export status
    const result = await getDataExportDetails(
      exportId,
      authResult.userId || 'unknown',
    )

    if (!result.success) {
      if (result.error === 'not_found') {
        logger.warn('Export request not found', { exportId })

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

      if (result.error === 'unauthorized') {
        logger.warn('User not authorized to view this export', {
          userId: authResult.userId,
          exportId,
        })

        return new Response(
          JSON.stringify({
            success: false,
            message: 'You are not authorized to view this export request',
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      logger.error('Error retrieving export status', {
        exportId,
        error: result.message,
      })

      return new Response(
        JSON.stringify({
          success: false,
          message:
            result.message || 'An error occurred retrieving export status',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Log successful status check
    logger.info('Export status retrieved successfully', {
      exportId,
      status: result.status,
      userId: authResult.userId,
    })

    // Return success response with export details
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          exportId: result.exportId,
          status: result.status,
          progress: result.progress,
          createdAt: result.createdAt,
          updatedAt: result.updatedAt,
          estimatedCompletionTime: result.estimatedCompletionTime,
          completedAt: result.completedAt,
          downloadUrl: result.downloadUrl,
          expiresAt: result.expiresAt,
          formats: result.formats,
          dataTypes: result.dataTypes,
          patientId: result.patientId,
          requestedBy: result.requestedBy,
          priority: result.priority,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error: unknown) {
    logger.error('Error checking export status', {
      error: error instanceof Error ? String(error) : String(error),
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
