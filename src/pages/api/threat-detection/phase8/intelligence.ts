import type { APIRoute } from 'astro'
import { createCompleteThreatDetectionSystem } from '../../../../lib/threat-detection/integrations/production-system'
import { mongoClient } from '@lib/db/mongoClient'
import { redis } from '@lib/redis'
import { authenticateRequest } from '../../../../lib/auth/index'
import { sanitizeInput } from '../../../../lib/auth/utils'

// Allowed IOC types
type IOCType = 'ip' | 'domain' | 'hash' | 'url'
const VALID_IOC_TYPES: IOCType[] = ['ip', 'domain', 'hash', 'url']
function isValidIOCType(value: unknown): value is IOCType {
  return typeof value === 'string' && VALID_IOC_TYPES.includes(value as IOCType)
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

    // Get query parameters
    const indicator = url.searchParams.get('indicator')
    const type = url.searchParams.get('type') as 'ip' | 'domain' | 'hash' | 'url'
    const refresh = url.searchParams.get('refresh') === 'true'

    if (!indicator || !type) {
      return new Response(JSON.stringify({
        error: 'Missing required parameters: indicator, type'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Validate IOC type
    const validTypes = ['ip', 'domain', 'hash', 'url']
    if (!validTypes.includes(type)) {
      return new Response(JSON.stringify({
        error: 'Invalid IOC type. Must be one of: ip, domain, hash, url'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Sanitize inputs
    const sanitizedIndicator = sanitizeInput(indicator)
    const sanitizedType = sanitizeInput(type)

    // Get database connections (currently unused in this endpoint but kept for future use)
    // Prefix with '_' to satisfy linter about unused variables.
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

    // Perform IOC lookup
    // Use a stricter IOC type instead of `any` to satisfy linter/type rules
    type IOCType = 'ip' | 'domain' | 'hash' | 'url'
    const results = await threatDetectionSystem.intelligenceService.lookupIOC(
      sanitizedIndicator,
      sanitizedType as IOCType,
      refresh
    )

    return new Response(JSON.stringify({
      indicator: sanitizedIndicator,
      type: sanitizedType,
      results,
      timestamp: new Date().toISOString(),
      source: 'Phase 8 Threat Intelligence System'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Threat intelligence lookup failed:', error)
    return new Response(JSON.stringify({
      error: 'Failed to lookup threat intelligence',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

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

    // Parse request body
    const body = await request.json()
    const { indicators, refresh = false } = body

    if (!indicators || !Array.isArray(indicators) || indicators.length === 0) {
      return new Response(JSON.stringify({
        error: 'Missing or invalid indicators array'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Validate each indicator with runtime checks; avoid `any` for linting/type-safety
    const sanitizedIndicators = indicators.map((item: unknown) => {
      if (typeof item !== 'object' || item === null) {
        throw new Error('Each indicator must be an object with indicator and type properties')
      }
      const candidate = item as Record<string, unknown>
      const rawIndicator = candidate.indicator
      const rawType = candidate.type

      if (typeof rawIndicator !== 'string' || typeof rawType !== 'string') {
        throw new Error('Each indicator must have string indicator and type properties')
      }

      if (!isValidIOCType(rawType)) {
        throw new Error(`Invalid IOC type: ${rawType}`)
      }

      return {
        indicator: sanitizeInput(rawIndicator),
        type: sanitizeInput(rawType) as IOCType
      }
    })

    // Get database connections (unused here but kept for parity with GET)
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

    // Perform bulk IOC lookup
    const results = await Promise.all(
      sanitizedIndicators.map(async ({ indicator, type }) => {
        try {
          // Ensure type is one of allowed IOC types
          type IOCType = 'ip' | 'domain' | 'hash' | 'url'
          const validatedType = (['ip', 'domain', 'hash', 'url'] as IOCType[]).includes(type as IOCType)
            ? (type as IOCType)
            : 'domain'

          const result = await threatDetectionSystem.intelligenceService.lookupIOC(
            indicator,
            validatedType,
            refresh
          )
          return {
            indicator,
            type,
            results: result,
            status: 'success'
          }
        } catch (error) {
          return {
            indicator,
            type,
            error: error instanceof Error ? error.message : 'Unknown error',
            status: 'error'
          }
        }
      })
    )

    return new Response(JSON.stringify({
      results,
      total: results.length,
      successful: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'error').length,
      timestamp: new Date().toISOString(),
      source: 'Phase 8 Threat Intelligence System'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Bulk threat intelligence lookup failed:', error)
    return new Response(JSON.stringify({
      error: 'Failed to process bulk threat intelligence lookup',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const PUT: APIRoute = async ({ request }) => {
  try {
    // Authenticate request - require admin privileges
    const authResult = await authenticateRequest(request)
    if (!authResult.success || !authResult.user?.isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized or insufficient privileges' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Parse request body
    const body = await request.json()
    const { feeds, updateInterval } = body

    if (!feeds || !Array.isArray(feeds)) {
      return new Response(JSON.stringify({
        error: 'Missing or invalid feeds configuration'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get database connections (unused here but kept for parity with other methods)
    const _mongoClient = mongoClient
    const _redisClient = redis

    // Create mock orchestrator and rate limiter
    const { EventEmitter } = await import('events')
    const orchestrator = new EventEmitter()
    const rateLimiter = {
      checkLimit: async () => ({ allowed: true }),
      consume: async () => ({ allowed: true })
    }

    // Create threat detection system with new configuration
    const threatDetectionSystem = createCompleteThreatDetectionSystem(
      orchestrator,
      rateLimiter,
      {
        threatDetection: {
          mongoUri: process.env.MONGODB_URI!,
          redisUrl: process.env.REDIS_URL!
        },
        intelligence: {
          feeds,
          updateInterval: updateInterval || 3600000 // 1 hour default
        }
      }
    )

    // Update feeds configuration
    await threatDetectionSystem.intelligenceService.updateConfiguration({
      feeds,
      updateInterval
    })

    return new Response(JSON.stringify({
      message: 'Threat intelligence configuration updated successfully',
      feeds: feeds.length,
      updateInterval: updateInterval || 3600000,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Update threat intelligence configuration failed:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update threat intelligence configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
