import type { APIRoute } from 'astro'
import { createCompleteThreatDetectionSystem } from '../../../../lib/threat-detection/integrations/production-system'
import { mongoClient } from '@lib/db/mongoClient'
import { redis } from '@lib/redis'
import { authenticateRequest } from '../../../../lib/auth/index'
import { sanitizeInput } from '../../../../lib/auth/utils'

export const POST: APIRoute = async ({ request }) => {
  try {
    // Authenticate request
    const authResult = await authenticateRequest(request)
    if (!authResult.success) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Parse and validate request body
    const body = await request.json()
    const { threatId, userId, severity, templateId, metadata } = body

    if (!threatId || !userId) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: threatId, userId'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Sanitize inputs
    const sanitizedData = {
      threatId: sanitizeInput(threatId),
      userId: sanitizeInput(userId),
      severity: sanitizeInput(severity || 'medium'),
      templateId: sanitizeInput(templateId || 'standard_threat_investigation'),
      metadata: metadata ? sanitizeInput(JSON.stringify(metadata)) : undefined
    }

    // Get database connections (not used directly in this handler but kept for lifecycle/connection management)
    const _mongoClient = mongoClient
    const _redisClient = redis

    // Create mock orchestrator and rate limiter
    const { EventEmitter } = await import('events')
    const orchestrator = new EventEmitter()
    const rateLimiter = {
      checkLimit: async () => ({ allowed: true }),
      consume: async () => ({ allowed: true })
    }

    // Create threat detection system
    const threatDetectionSystem = createCompleteThreatDetectionSystem(
      orchestrator,
      rateLimiter,
      {
        threatDetection: {
          mongoUri: process.env.MONGODB_URI!,
          redisUrl: process.env.REDIS_URL!
        }
      }
    )

    // Start investigation
    const investigation = await threatDetectionSystem.huntingService.startInvestigation({
      threatId: sanitizedData.threatId,
      userId: sanitizedData.userId,
      severity: sanitizedData.severity as 'low' | 'medium' | 'high' | 'critical',
      templateId: sanitizedData.templateId,
      metadata: sanitizedData.metadata ? JSON.parse(sanitizedData.metadata) : undefined
    })

    return new Response(JSON.stringify({
      investigationId: investigation.id,
      status: investigation.status,
      startedAt: investigation.startedAt,
      estimatedDuration: investigation.estimatedDuration,
      message: 'Threat investigation started successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Threat investigation failed:', error)
    return new Response(JSON.stringify({
      error: 'Failed to start investigation',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const GET: APIRoute = async ({ request, url }) => {
  try {
    // Authenticate request
    const authResult = await authenticateRequest(request)
    if (!authResult.success) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const investigationId = url.searchParams.get('id')
    if (!investigationId) {
      return new Response(JSON.stringify({
        error: 'Missing investigation ID'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get database connections (not used directly in this handler but kept for lifecycle/connection management)
    const _mongoClient = mongoClient
    const _redisClient = redis

    // Create mock orchestrator and rate limiter
    const { EventEmitter } = await import('events')
    const orchestrator = new EventEmitter()
    const rateLimiter = {
      checkLimit: async () => ({ allowed: true }),
      consume: async () => ({ allowed: true })
    }

    // Create threat detection system
    const threatDetectionSystem = createCompleteThreatDetectionSystem(
      orchestrator,
      rateLimiter,
      {
        threatDetection: {
          mongoUri: process.env.MONGODB_URI!,
          redisUrl: process.env.REDIS_URL!
        }
      }
    )

    // Get investigation result
    const result = await threatDetectionSystem.huntingService.getInvestigationResult(
      sanitizeInput(investigationId)
    )

    if (!result) {
      return new Response(JSON.stringify({
        error: 'Investigation not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Get investigation result failed:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get investigation result',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
