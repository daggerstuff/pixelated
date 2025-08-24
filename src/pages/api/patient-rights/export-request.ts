import { z } from 'zod'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { protectApi } from '../../../lib/auth/apiAuth'
import type { ExportFormat } from '../../../lib/services/patient-rights/dataPortabilityService'
import { createDataExportRequest } from '../../../lib/services/patient-rights/dataPortabilityService'

const logger = createBuildSafeLogger('api-export-request')

// Define validation schema for export request
const exportRequestSchema = z.object({
  patientId: z.string().uuid({ message: 'Patient ID must be a valid UUID' }),
  format: z.enum(['json', 'csv', 'xml', 'pdf'], {
    errorMap: () => ({ message: 'Format must be one of: json, csv, xml, pdf' }),
  }),
  includeCategories: z.array(z.string()).optional(),
  dateRange: z
    .object({
      start: z.string().optional(),
      end: z.string().optional(),
    })
    .optional(),
})

export const POST = async ({ request }) => {
  try {
    // Parse request body as JSON
    let requestBody
    try {
      requestBody = await request.json()
    } catch (error: unknown) {
      // Log the JSON parsing error
      logger.error('Invalid JSON in request body', {
        error: error instanceof Error ? String(error) : String(error),
        stack: error instanceof Error ? (error as Error)?.stack : undefined,
        url: request.url,
        method: request.method,
      })

      return new Response(
        JSON.stringify({
          success: false,
          error: 'invalid_request',
          message: 'Invalid JSON in request body',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Validate request body against schema
    const validationResult = exportRequestSchema.safeParse(requestBody)
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors
        .map((e) => e.message)
        .join(', ')

      return new Response(
        JSON.stringify({
          success: false,
          error: 'invalid_parameters',
          message: errorMessage,
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Authenticate the user
    const authResult = await protectApi(request)
    if (!authResult.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'unauthorized',
          message: 'Authentication required',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    const { userId } = authResult
    const { patientId, format, includeCategories } = validationResult.data

    // Create data export request
    const exportResult = await createDataExportRequest({
      patientId,
      formats: [format as ExportFormat],
      dataTypes: includeCategories || ['all'],
      reason: 'User-initiated export',
      priority: 'normal',
      requestedBy: userId || 'unknown',
    })

    if (!exportResult.success) {
      // Return appropriate error response based on the error type
      const status =
        exportResult.error === 'unauthorized'
          ? 403
          : exportResult.error === 'not_found'
            ? 404
            : exportResult.error === 'validation_error'
              ? 400
              : 500

      return new Response(
        JSON.stringify({
          success: false,
          error: exportResult.error,
          message: exportResult.message,
        }),
        {
          status,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Log successful request
    logger.info('Export request created', {
      exportId: exportResult.exportId,
      patientId,
      format,
      userId,
    })

    // Return success response with export details
    return new Response(JSON.stringify(exportResult), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error: unknown) {
    // Log the error
    logger.error('Error creating export request', {
      error: error instanceof Error ? String(error) : String(error),
      stack: error instanceof Error ? (error as Error)?.stack : undefined,
    })

    // Return a generic error response
    return new Response(
      JSON.stringify({
        success: false,
        error: 'internal_error',
        message:
          'An unexpected error occurred while creating the export request',
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
