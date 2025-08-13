

// Use local types to avoid Astro 5.x APIContext bug
type AstroAPIContext = {
  request: Request
  cookies: never
  url: URL
  params: Record<string, string | undefined>
  site?: URL
  generator: string
}
type APIRoute = (context: AstroAPIContext) => Response | Promise<Response>
import { CrisisDetectionService } from '@/lib/ai/services/crisis-detection'
import { getAIServiceByProvider } from '@/lib/ai/providers'
import { getSession } from '@/lib/auth/session'
import type { SessionData } from '@/lib/auth/session'
import { createBuildSafeLogger } from '../../../../lib/logging/build-safe-logger'
import {
  createAuditLog,
  AuditEventType,
  AuditEventStatus,
  type AuditDetails,
} from '@/lib/audit'
import type { AuditResource } from '@/lib/audit/types'
import { CrisisProtocol } from '@/lib/ai/crisis/CrisisProtocol'

import type { CrisisDetectionResult } from '@/lib/ai/crisis/types'
// Initialize scoped logger for this module
const logger = createBuildSafeLogger('crisis-detection')

// CrisisProtocol instance
const crisisProtocolInstance = CrisisProtocol.getInstance()

/**
 * API route for crisis detection
 */
export const POST: APIRoute = async ({ request }: AstroAPIContext) => {
  const startTime = Date.now()
  let crisisDetected = false
  let session: SessionData | null = null

  // DEBUG LOG: POST handler invoked
  console.log('[crisis-detection.ts] POST handler invoked')

  try {
    // Get session for authentication
    session = await getSession(request)

    // Check if user is authenticated
    if (!session) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          message: 'You must be logged in to access this endpoint',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Parse request body
    const body = await request.json()
    const {
      text,
      batch,
      sensitivityLevel = 'medium',
      provider = 'anthropic',
    } = body

    // Validate required fields
    if (!text && (!batch || !Array.isArray(batch))) {
      return new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: 'Either text or batch must be provided',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Get the appropriate AI service
    const aiService = getAIServiceByProvider(provider)
    if (!aiService) {
      return new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: `Provider ${provider} is not supported`,
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Create crisis detection service
    const crisisService = new CrisisDetectionService({
      aiService,
      sensitivityLevel: sensitivityLevel as 'low' | 'medium' | 'high',
    })

    // Process request (either single text or batch)
    let result: CrisisDetectionResult | CrisisDetectionResult[] | null = null

    if (batch) {
      const batchResult = await crisisService.detectBatch(batch, {
        sensitivityLevel: sensitivityLevel as 'low' | 'medium' | 'high',
        userId: session.user.id,
        source: 'api-batch-request',
      })

      result = batchResult

      // Store each result in the database (now handled by the risk assessment system)
      // Check if any crisis was detected
      for (const detection of batchResult) {
        if (detection.isCrisis) {
          crisisDetected = true // General flag
          // Call CrisisProtocol for each detected crisis in the batch
          try {
            await crisisProtocolInstance.handleCrisis(
              session.user.id,
              session.session?.access_token?.substring(0, 8) ||
                `batch-item-session-${crypto.randomUUID()}`, // Use part of access token or generate UUID
              detection.content, // Text sample from CrisisDetectionResult
              detection.confidence, // Detection score from CrisisDetectionResult
              detection.category ? [detection.category] : [], // Detected risks from CrisisDetectionResult
            )
          } catch (error) {
            logger.error('Error handling crisis event in batch:', {
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
              detection,
            })
          }
        }
      }
    } else {
      const singleResult = await crisisService.detectCrisis(text, {
        sensitivityLevel: sensitivityLevel as 'low' | 'medium' | 'high',
        userId: session.user.id,
        source: 'api-request',
      })

      result = singleResult

      // Check if crisis was detected
      if (singleResult.isCrisis) {
        crisisDetected = true
        // Call CrisisProtocol for the detected crisis
        try {
          await CrisisProtocol.getInstance().handleCrisis(
            session.user.id,
            session.session?.access_token?.substring(0, 8) ||
              `single-item-session-${crypto.randomUUID()}`, // Use part of access token or generate UUID
            singleResult.content, // Text sample from CrisisDetectionResult
            singleResult.confidence, // Detection score from CrisisDetectionResult
            singleResult.category ? [singleResult.category] : [], // Detected risks from CrisisDetectionResult
          )
        } catch (error) {
          logger.error('Error handling single crisis event:', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            result,
          })
        }
      }
    }

    // Calculate latency
    const latencyMs = Date.now() - startTime

    // Log results
    logger.info('Crisis detection completed', {
      latencyMs,
      crisisDetected,
      sensitivityLevel,
      isBatch: !!batch,
      userId: session.user.id,
    })

    // Define audit resource
    const aiResource: AuditResource = {
      id: 'crisis-detection',
      type: 'ai',
    }

    // Create audit log entry for the request
    await createAuditLog(
      AuditEventType.AI_OPERATION,
      'ai.crisis.request',
      session.user.id,
      aiResource.id, // resource is a string
      {
        // details instead of metadata
        modelName: aiService.getModelInfo('default')?.name || 'unknown',
        sensitivityLevel,
        batchSize: batch ? batch.length : 0,
        textLength: text ? text.length : 0,
        resourceType: aiResource.type,
      } as AuditDetails,
      AuditEventStatus.SUCCESS,
    )

    // Create audit log entry for the response
    await createAuditLog(
      AuditEventType.AI_OPERATION,
      'ai.crisis.response',
      session.user.id,
      aiResource.id, // resource is a string
      {
        // details instead of metadata
        modelName: aiService.getModelInfo('default')?.name || 'unknown',
        resultCount: Array.isArray(result) ? result.length : 1,
        crisisDetected,
        latencyMs: Date.now() - startTime,
        priority: crisisDetected ? 'high' : 'normal',
        resourceType: aiResource.type,
      } as AuditDetails,
      AuditEventStatus.SUCCESS,
    )

    // Return response
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Error processing crisis detection request:', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    })

    // Define audit resource for error
    const aiResource: AuditResource = {
      id: 'crisis-detection',
      type: 'ai',
    }

    // Create audit log entry for the error
    await createAuditLog(
      AuditEventType.AI_OPERATION,
      'ai.crisis.error',
      session?.user?.id || 'anonymous',
      aiResource.id, // resource is a string
      {
        // details instead of metadata
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        status: 'error', // This can go into details
        resourceType: aiResource.type,
      } as AuditDetails,
      AuditEventStatus.FAILURE,
    )

    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to process crisis detection request',
        details: errorMessage,
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
