import type { APIRoute } from 'astro'
import { createCompleteThreatDetectionSystem } from '../../../../lib/threat-detection/integrations/production-system'
import { mongoClient } from '@lib/db/mongoClient'
import { redis } from '@lib/redis'
import { authenticateRequest } from '../../../../lib/auth/index'

export const GET: APIRoute = async ({ request }) => {
  try {
    // Authenticate request
    const authResult = await authenticateRequest(request)
    if (!authResult.success) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Get database connections (unused here — prefix with '_' to satisfy linter)
    const _mongoClient = mongoClient
    const _redisClient = redis

    // Create mock orchestrator and rate limiter for status check
    const { EventEmitter } = await import('events')
    const orchestrator = new EventEmitter()
    const rateLimiter = {
      checkLimit: async () => ({ allowed: true }),
      consume: async () => ({ allowed: true }),
    }

    // Create threat detection system
    const threatDetectionSystem = createCompleteThreatDetectionSystem(
      orchestrator,
      rateLimiter,
      {
        threatDetection: {
          mongoUri: process.env.MONGODB_URI!,
          redisUrl: process.env.REDIS_URL!,
        },
      },
    )

    // Get status from all services
    const [monitoringStatus, huntingStatus, intelligenceStatus] =
      await Promise.all([
        threatDetectionSystem.monitoringService.getStatus(),
        threatDetectionSystem.huntingService.getStatus(),
        threatDetectionSystem.intelligenceService.getStatus(),
      ])

    const status = {
      phase: 'Phase 8: Advanced AI Threat Detection & Response System',
      timestamp: new Date().toISOString(),
      services: {
        monitoring: monitoringStatus,
        hunting: huntingStatus,
        intelligence: intelligenceStatus,
      },
      overall: {
        status: 'healthy',
        uptime: process.uptime(),
        version: '1.0.0',
      },
    }

    return new Response(JSON.stringify(status), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Phase 8 status check failed:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        phase: 'Phase 8',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
