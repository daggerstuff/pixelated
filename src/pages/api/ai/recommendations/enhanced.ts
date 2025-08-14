import type { APIRoute } from 'astro'
import { z } from 'zod'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { createProductionEnhancedRecommendationService } from '../../../../lib/ai/services/EnhancedRecommendationFactory'
import { validateRequestBody } from '../../../../lib/validation'
import type { ValidationErrorDetails } from '../../../../lib/validation'
import { getSession } from '../../../../lib/auth/session'

const logger = createBuildSafeLogger('enhanced-recommendation-api')

/**
 * Creates a standardized error response
 */
function createErrorResponse({
  status,
  message,
  errors,
  error,
}: {
  status: number
  message: string
  errors?: ValidationErrorDetails | Record<string, unknown> | z.ZodError
  error?: string
}) {
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      details: errors || error || undefined,
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )
}

// Validation schema for the request body
const enhancedRecommendationRequestSchema = z.object({
  clientId: z.string().uuid({ message: 'Valid client ID is required' }),
  indications: z
    .array(z.string())
    .min(1, { message: 'At least one indication is required' }),
  includePersonalization: z.boolean().default(true),
  includeEfficacyStats: z.boolean().default(true),
  includeAlternativeApproaches: z.boolean().default(true),
  maxMediaRecommendations: z.number().int().min(0).max(5).default(3),
  previousTechniques: z.array(z.string()).optional(),
})

export const POST: APIRoute = async ({ request }) => {
  try {
    // Verify authentication
    const sessionData = await getSession(request)
    if (!sessionData) {
      return createErrorResponse({
        status: 401,
        message: 'Authentication required',
      })
    }

    // Only therapists and admins can access this endpoint
    const userRole = sessionData.user?.role || 'user'
    if (userRole !== 'therapist' && userRole !== 'admin') {
      return createErrorResponse({
        status: 403,
        message: 'Insufficient permissions',
      })
    }

    // Validate request body
    const [validatedData, validationError] = await validateRequestBody<
      typeof enhancedRecommendationRequestSchema
    >(request, enhancedRecommendationRequestSchema)

    if (validationError || !validatedData) {
      return createErrorResponse({
        status: 400,
        message: 'Invalid request',
        ...(validationError && { errors: validationError.details }),
      })
    }

    const {
      clientId,
      indications,
      includePersonalization,
      includeEfficacyStats,
      includeAlternativeApproaches,
      maxMediaRecommendations,
      previousTechniques, // Not used in current implementation - future enhancement
    } = validatedData

    logger.info('Generating enhanced recommendations', {
      userId: sessionData.user.id,
      clientId,
      indicationsCount: indications.length,
      hasPreviousTechniques: previousTechniques
        ? previousTechniques.length > 0
        : false,
    })

    // Create enhanced recommendation service
    const recommendationService =
      await createProductionEnhancedRecommendationService()

    // Generate enhanced recommendations
    const recommendations =
      await recommendationService.generateEnhancedRecommendations(clientId, {
        ...(includePersonalization
          ? { personalizationOptions: {} as Record<string, unknown> }
          : {}),
        includeEfficacyStats,
        includeAlternatives: includeAlternativeApproaches,
        maxMediaRecommendations,
      })

    // Return the enhanced recommendations
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          recommendations,
          generated: new Date().toISOString(),
          metadata: {
            indicationsCount: indications.length,
            recommendationsCount: recommendations.length,
          },
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error) {
    logger.error('Error generating enhanced recommendations', { error })

    return createErrorResponse({
      status: 500,
      message: 'Failed to generate enhanced recommendations',
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

// For documentation and OpenAPI schema only - this endpoint only accepts POST
export const GET: APIRoute = ({  }: APIContext) => {
  return createErrorResponse({
    status: 405,
    message:
      'Method not allowed. Use POST to generate enhanced recommendations.',
  })
}
