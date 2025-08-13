import type { APIRoute } from 'astro'
import { z } from 'zod'
import { createBuildSafeLogger } from '../../../../lib/logging/build-safe-logger'
import { getSession } from '../../../lib/auth/session'
import { createDataExportRequest } from '../../../lib/services/patient-rights/dataPortabilityService'

const logger = createBuildSafeLogger('api:patient-rights:request-export')

// Validation schema for export request
const exportRequestSchema = z.object({
  patientId: z.string().uuid('Patient ID must be a valid UUID'),
  formats: z
    .array(z.enum(['json', 'csv', 'pdf']))
    .min(1, 'At least one export format is required'),
  dataTypes: z.array(z.string()).min(1, 'At least one data type is required'),
  reason: z
    .string()
    .min(1, 'Reason for export is required')
    .max(500, 'Reason cannot exceed 500 characters'),
  priority: z.enum(['normal', 'high']).optional().default('normal'),
})

export const POST: APIRoute = async ({ request }) => {
  try {
    // Parse request body as JSON
    let requestBody
    try {
      requestBody = await request.json()
    } catch (error) {
      logger.warn('Invalid JSON in request body', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      return new Response(
        JSON.stringify({
          success: false,
          error: 'bad_request',
          message: 'Invalid JSON in request body',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Validate request body against schema
    const parseResult = exportRequestSchema.safeParse(requestBody)
    if (!parseResult.success) {
      const { errors } = parseResult.error
      logger.warn('Invalid export request format', { errors })

      return new Response(
        JSON.stringify({
          success: false,
          error: 'validation_error',
          message: 'Invalid export request format',
          details: errors,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const validatedData = parseResult.data

    // Verify user is authenticated
    const sessionData = await getSession(request)
    if (!sessionData || !sessionData.user) {
      logger.warn('Unauthorized access attempt to request export API')
      return new Response(
        JSON.stringify({
          success: false,
          error: 'unauthorized',
          message: 'Authentication required',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Get user ID from the session
    const userId = sessionData.user.id

    // Create the export request
    const result = await createDataExportRequest({
      patientId: validatedData.patientId,
      formats: validatedData.formats,
      dataTypes: validatedData.dataTypes,
      reason: validatedData.reason,
      priority: validatedData.priority,
      requestedBy: userId,
    })

    if (!result.success) {
      // Determine appropriate status code
      let statusCode = 500
      if (result.error === 'not_found') {
        statusCode = 404
      }
      if (result.error === 'unauthorized') {
        statusCode = 403
      }
      if (result.error === 'invalid_request') {
        statusCode = 400
      }

      return new Response(JSON.stringify(result), {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Return successful response
    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    logger.error('Error processing export request', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    return new Response(
      JSON.stringify({
        success: false,
        error: 'internal_error',
        message: 'An unexpected error occurred while processing export request',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
