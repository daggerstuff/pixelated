import type { APIRoute, APIContext } from 'astro'
import { CrisisDetectionService } from '@/lib/ai/services/crisis-detection'
import { getAIServiceByProvider } from '@/lib/ai/providers'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import {
  createAuditLog,
  AuditEventType,
  AuditEventStatus,
  type AuditDetails,
} from '@/lib/audit'
import type { AuditResource } from '@/lib/audit/types'
import { CrisisProtocol } from '@/lib/ai/crisis/CrisisProtocol'
import type { CrisisDetectionResult } from '@/lib/ai/crisis/types'
import { getUserById } from '@/services/auth0.service'
import { validateToken } from '@/lib/auth/auth0-jwt-service'
import { extractTokenFromRequest } from '@/lib/auth/auth0-middleware'

// Initialize scoped logger for this module
const logger = createBuildSafeLogger('crisis-detection')

// CrisisProtocol instance
const crisisProtocolInstance = CrisisProtocol.getInstance()

/**
 * API route for crisis detection
 */
export const POST: APIRoute = async ({ request }: APIContext) => {
  const startTime = Date.now()
  let crisisDetected = false
  let userId: string | null = null

  try {
    // Extract token from request
    const token = extractTokenFromRequest(request as unknown as Request)

    if (!token) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Validate token
    const validation = await validateToken(token, 'access')

    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Get user from Auth0
    const user = await getUserById(validation.userId!)

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    userId = user.id

    const requestBody = await request.json()
    const { text, sessionId, context } = requestBody

    if (!text) {
      return new Response(
        JSON.stringify({ error: 'Text content is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Initialize crisis detection service
    const crisisDetectionService = new CrisisDetectionService()

    // Perform crisis detection
    const detectionResult: CrisisDetectionResult =
      await crisisDetectionService.detectCrisis(text, {
        sessionId,
        userId: userId,
        context,
      })

    // Handle crisis protocol if detected
    if (detectionResult.crisisDetected) {
      crisisDetected = true
      logger.info('Crisis detected, initiating protocol', {
        userId,
        sessionId,
        crisisType: detectionResult.crisisType,
        confidence: detectionResult.confidence,
      })

      // Execute crisis protocol
      await crisisProtocolInstance.handleCrisis({
        userId: userId,
        sessionId,
        crisisType: detectionResult.crisisType,
        confidence: detectionResult.confidence,
        text,
        context,
      })
    }

    // Create audit log
    const auditDetails: AuditDetails = {
      crisisDetected,
      confidence: detectionResult.confidence,
      crisisType: detectionResult.crisisType,
      processingTime: Date.now() - startTime,
      sessionId,
    }

    await createAuditLog(
      AuditEventType.CRISIS_DETECTION,
      'crisis_detection_analysis',
      userId,
      'ai-crisis-detection' as AuditResource,
      auditDetails,
      detectionResult.crisisDetected
        ? AuditEventStatus.SUCCESS
        : AuditEventStatus.INFO,
    )

    return new Response(JSON.stringify(detectionResult), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    logger.error('Error in crisis detection API', {
      error: error?.message,
      stack: error?.stack,
      userId,
    })

    // Create audit log for the error
    await createAuditLog(
      AuditEventType.SYSTEM_ERROR,
      'crisis_detection_error',
      userId || 'anonymous',
      'ai-crisis-detection' as AuditResource,
      {
        error: error?.message,
        stack: error?.stack,
        processingTime: Date.now() - startTime,
      },
      AuditEventStatus.FAILURE,
    )

    return new Response(
      JSON.stringify({ error: 'Internal server error during crisis detection' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}