import type { APIRoute } from 'astro'
import { createMentalLLaMAFromEnv } from '@/lib/ai/mental-llama'
import { getApiEndpointLogger } from '@/lib/logging/standardized-logger'
import type { RoutingContext } from '../../../../lib/ai/mental-llama/types/mentalLLaMATypes.js'

const logger = getApiEndpointLogger('mental-health-analyze')

/**
 * @file src/pages/api/ai/mental-health/analyze.ts
 * @description API endpoint for analyzing text for mental health indicators using MentalLLaMA.
 *
 * This endpoint accepts POST requests with text and optional configuration to perform
 * mental health analysis. It utilizes the MentalLLaMA adapter for processing.
 * It also handles OPTIONS requests for CORS preflight.
 */

// Cache for the MentalLLaMA instance
let mentalLLaMAInstanceCache: Awaited<
  ReturnType<typeof createMentalLLaMAFromEnv>
> | null = null

/**
 * Defines the expected structure of the request body for the POST /api/ai/mental-health/analyze endpoint.
 */
interface AnalyzeRequestBody {
  /** The text content to be analyzed for mental health indicators. */
  text: string
  /**
   * Optional flag to indicate whether expert guidance should be incorporated into the analysis.
   * Defaults to true if not provided.
   */
  useExpertGuidance?: boolean
  /**
   * Optional routing context providing additional information for the analysis,
   * such as user ID, session ID, session type, or explicit task hints.
   */
  routingContext?: Partial<RoutingContext> // Allow partial context from client
}

async function getInitializedMentalLLaMA() {
  if (!mentalLLaMAInstanceCache) {
    logger.info('MentalLLaMA instance not cached, creating and caching...')
    try {
      mentalLLaMAInstanceCache = await createMentalLLaMAFromEnv()
      logger.info('MentalLLaMA instance created and cached successfully.')
    } catch (error: unknown) {
      logger.error('Failed to create MentalLLaMA instance for cache', { error })
      throw error // Rethrow to make it explicit that initialization failed
    }
  } else {
    logger.info('Using cached MentalLLaMA instance.')
  }
  return mentalLLaMAInstanceCache
}

/**
 * Mental Health Analysis API
 *
 * This endpoint analyzes text for mental health indicators using MentalLLaMA.
 *
 * Request body:
 * {
 *   "text": "Text to analyze for mental health indicators",
 *   "useExpertGuidance"?: boolean, // Optional, defaults to true
 *   "routingContext"?: {        // Optional
 *     "userId"?: string,
 *     "sessionId"?: string,
 *     "sessionType"?: string,
 *     "explicitTaskHint"?: string
 *   }
 * }
 *
 * Response:
 * {
 *   "hasMentalHealthIssue": boolean,
 *   "mentalHealthCategory": string,
 *   "explanation": string,
 *   "confidence": number,
 *   "supportingEvidence": string[],
 *   "expertGuided": boolean,   // If expert guidance was used
 *   "modelInfo": {
 *     "directModelAvailable": boolean,
 *     "modelTier": "7B" | "13B"
 *   }
 * }
 */
export const POST: APIRoute = async ({ request }) => {
  const overallStartTime = Date.now()
  let timing = {
    requestParsingMs: -1,
    factoryCreationMs: -1,
    analysisMs: -1,
    totalMs: -1,
  }

  let requestBody: unknown = null
  let text = ''

  try {
    let startTime = Date.now()
    // Parse request body
    requestBody = await request.json()
    timing.requestParsingMs = Date.now() - startTime

    // Type assertion and validation for the request body
    if (
      !requestBody ||
      typeof requestBody !== 'object' ||
      !('text' in requestBody) ||
      typeof (requestBody as { text?: unknown }).text !== 'string'
    ) {
      return new Response(
        JSON.stringify({
          error: 'Invalid request. "text" field (string) is required.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const validatedBody = requestBody as AnalyzeRequestBody
    text = validatedBody.text.trim().substring(0, 2000) // Limit to 2000 chars
    const useExpertGuidance = validatedBody.useExpertGuidance !== false // Default to true
    // Sanitize routingContext to ensure it matches the expected RoutingContext interface
    const rawRoutingContext = validatedBody.routingContext || {}
    const routingContext: RoutingContext = {}

    // Only include properties that have actual string values
    if (typeof rawRoutingContext.userId === 'string') {
      routingContext.userId = rawRoutingContext.userId
    }
    if (typeof rawRoutingContext.sessionId === 'string') {
      routingContext.sessionId = rawRoutingContext.sessionId
    }
    if (typeof rawRoutingContext.sessionType === 'string') {
      routingContext.sessionType = rawRoutingContext.sessionType
    }
    if (typeof rawRoutingContext.explicitTaskHint === 'string') {
      routingContext.explicitTaskHint = rawRoutingContext.explicitTaskHint
    }
    // Note: previousConversationState and failureInfo are not included from client requests

    const logContext = {
      textLength: text.length,
      useExpertGuidance,
      userId: routingContext?.userId,
      sessionId: routingContext?.sessionId,
    }
    logger.info('Analyzing text for mental health indicators', logContext)

    startTime = Date.now()
    const { adapter, modelProvider } = await getInitializedMentalLLaMA()
    timing.factoryCreationMs = Date.now() - startTime

    const modelInfo = modelProvider?.getModelInfo?.()
    const directModelAvailable =
      !!modelInfo && !modelInfo.name?.startsWith('mock-')
    const modelTier = modelInfo?.version || 'unknown'

    logger.info('MentalLLaMA configuration', {
      directModelAvailable,
      modelTier,
      userId: routingContext?.userId,
      sessionId: routingContext?.sessionId,
    })

    startTime = Date.now()
    const analysisParams = { text, routingContext }
    const analysis = useExpertGuidance
      ? await adapter.analyzeMentalHealthWithExpertGuidance(
          text,
          true,
          routingContext,
        )
      : await adapter.analyzeMentalHealth(analysisParams)
    timing.analysisMs = Date.now() - startTime

    const responsePayload = {
      ...analysis,
      modelInfo: {
        directModelAvailable,
        modelTier: modelTier, // Use actual model tier
      },
    }

    timing.totalMs = Date.now() - overallStartTime
    logger.info('Mental health analysis complete', {
      ...logContext,
      timing,
      modelTierUsed: responsePayload.modelInfo.modelTier,
      category: responsePayload.mentalHealthCategory,
      isCrisis: responsePayload.isCrisis,
    })

    // Return the analysis results
    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error: unknown) {
    timing.totalMs = Date.now() - overallStartTime
    const userId = (requestBody as Partial<AnalyzeRequestBody>)?.routingContext
      ?.userId
    const sessionId = (requestBody as Partial<AnalyzeRequestBody>)
      ?.routingContext?.sessionId
    logger.error('Error analyzing mental health', {
      error: error instanceof Error ? String(error) : String(error),
      stack: error instanceof Error ? (error as Error)?.stack : undefined,
      timing,
      textLength: text.length, // text might not be initialized if parsing failed early
      userId,
      sessionId,
    })

    return new Response(
      JSON.stringify({
        error: 'An error occurred while analyzing the text.',
        detail: error instanceof Error ? String(error) : 'Unknown error',
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

/**
 * Provide proper response for OPTIONS requests (CORS preflight)
 */
export const options: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
