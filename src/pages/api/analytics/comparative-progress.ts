import type { APIRoute } from 'astro'
import { z } from 'zod'
import { createBuildSafeLogger } from '../../../lib/logging/build-safe-logger'
import { ComparativeProgressService } from '../../../lib/services/analytics/ComparativeProgressService'
import type { ComparativeProgressParams } from '../../../types/analytics'

// Schema for validating request parameters
const requestSchema = z.object({
  anonymizedUserId: z.string().min(1, 'User ID is required'),
  metricName: z.string().min(1, 'Metric name is required'),
  cohortId: z.string().min(1, 'Cohort ID is required'),
  dateRange: z.object({
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'),
  }),
})

// Initialize logger
const logger = createBuildSafeLogger('default')

// Initialize service
const comparativeProgressService = new ComparativeProgressService(logger)

export const get = async ({ request, cookies }) => {
  try {
    // Basic authentication check (replace with your actual auth logic)
    const authToken = cookies.get('auth-token')?.value
    if (!authToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Authentication required',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Parse query parameters
    const url = new URL(request.url)
    const params: Partial<ComparativeProgressParams> = {
      anonymizedUserId: url.searchParams.get('anonymizedUserId') || '',
      metricName: url.searchParams.get('metric') || '',
      cohortId: url.searchParams.get('cohort') || '',
      dateRange: {
        startDate: url.searchParams.get('startDate') || '',
        endDate: url.searchParams.get('endDate') || '',
      },
    }

    // Validate parameters
    const validationResult = requestSchema.safeParse(params)
    if (!validationResult.success) {
      logger.warn('Invalid comparative progress request', {
        errors: validationResult.error.format(),
        path: url.pathname,
      })

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid request parameters',
          details: validationResult.error.format(),
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Parameters are valid, perform the analysis
    const analysisResult = await comparativeProgressService.analyzeProgress(
      validationResult.data,
    )

    // Check for analysis errors
    if (analysisResult.error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: analysisResult.error,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Return successful response
    return new Response(
      JSON.stringify({
        success: true,
        data: analysisResult,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'private, max-age=300', // Cache for 5 minutes
        },
      },
    )
  } catch (error) {
    // Log the error
    logger.error('Error processing comparative progress request', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    // Return error response
    return new Response(
      JSON.stringify({
        success: false,
        error: 'An unexpected error occurred while processing the request',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
