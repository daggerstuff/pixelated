/**
 * Optimized Bias Analysis API Endpoint
 * High-performance API with caching, connection pooling, and response optimization
 */

import type { APIRoute } from 'astro'
import { securityMiddleware } from '@/middleware/security'
import { getOptimizedBiasDetectionService } from '@/lib/services/bias-detection-optimized'
import { getLogger } from '@/lib/logging'
import { randomUUID } from 'crypto'
import { z } from 'zod'

const logger = getLogger('bias-analysis-api')

// Request validation schema
const AnalyzeBiasRequestSchema = z.object({
  text: z.string().min(50).max(10000), // 50-10000 characters
  context: z.string().optional(),
  demographics: z
    .object({
      age: z.number().int().min(18).max(120).optional(),
      gender: z.enum(['male', 'female', 'non-binary', 'other']).optional(),
      ethnicity: z.string().optional(),
      primaryLanguage: z.string().optional(),
    })
    .optional(),
  sessionType: z.enum(['individual', 'group', 'family', 'couples']).optional(),
  therapistNotes: z.string().max(1000).optional(),
  therapistId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
})

// Response caching headers
const CACHE_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
}

// Performance monitoring
interface PerformanceMetrics {
  requestId: string
  startTime: number
  validationTime?: number
  analysisTime?: number
  responseTime?: number
  totalTime: number
  cached: boolean
  error?: string
}

// Add small helper to avoid exposing stacks in responses and to control logging
const isProduction = process.env.NODE_ENV === 'production'

function safeErrorForLogging(err: unknown) {
  return {
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  }
}

// Add: scrub responses before sending to clients to avoid exposing stack traces or sensitive fields
function scrubForClient(input: unknown): unknown {
  const seen = new WeakSet()
  function scrub(value: any): any {
    if (value === null || typeof value !== 'object') {
      return value
    }
    if (seen.has(value)) return undefined
    seen.add(value)

    if (Array.isArray(value)) {
      return value.map(scrub)
    }

    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      const lk = key.toLowerCase()
      // Remove definitely sensitive keys
      if (
        lk === 'stack' ||
        lk === 'trace' ||
        lk.includes('stack') ||
        lk.includes('trace') ||
        lk.includes('password') ||
        lk.includes('secret') ||
        lk.includes('token') ||
        lk.includes('authorization') ||
        lk.includes('ssn') ||
        lk.includes('credit_card')
      ) {
        continue
      }

      if (typeof val === 'string') {
        // Truncate very long strings to avoid leaking data
        out[key] = val.length > 1000 ? val.slice(0, 1000) + '...' : val
      } else {
        out[key] = scrub(val)
      }
    }
    return out
  }

  return scrub(input)
}

export const POST: APIRoute = async ({ request }) => {
  const requestId = randomUUID()
  const startTime = Date.now()

  const metrics: PerformanceMetrics = {
    requestId,
    startTime,
    totalTime: 0,
    cached: false,
  }

  try {
    // Apply security middleware with timeout
    const securityStart = Date.now()
    const securityResult = await Promise.race([
      securityMiddleware(request, {}),
      new Promise<Response>((resolve) =>
        setTimeout(
          () =>
            resolve(new Response('Security check timeout', { status: 408 })),
          5000,
        ),
      ),
    ])

    if (securityResult) {
      return securityResult
    }

    metrics.validationTime = Date.now() - securityStart

    // Parse and validate request body with timeout
    const parseStart = Date.now()
    let body: z.infer<typeof AnalyzeBiasRequestSchema>

    try {
      const rawBody = await request.json()
      body = AnalyzeBiasRequestSchema.parse(rawBody)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return new Response(
          JSON.stringify(
            scrubForClient({
              error: 'Validation failed',
              details: error.errors.map((e) => ({
                field: e.path.join('.'),
                message: e.message,
              })),
            }),
          ),
          {
            status: 400,
            headers: CACHE_HEADERS,
          },
        )
      }

      return new Response(
        JSON.stringify(scrubForClient({ error: 'Invalid request body' })),
        {
          status: 400,
          headers: CACHE_HEADERS,
        },
      )
    }

    metrics.validationTime =
      (metrics.validationTime || 0) + (Date.now() - parseStart)

    // Get optimized bias detection service
    const biasService = getOptimizedBiasDetectionService()

    // Perform bias analysis with timeout
    const analysisStart = Date.now()
    const analysisResult = await Promise.race([
      biasService.analyzeBias({
        text: body.text,
        context: body.context,
        demographics: body.demographics,
        sessionType: body.sessionType,
        therapistNotes: body.therapistNotes,
        therapistId: body.therapistId,
        clientId: body.clientId,
      }),
      new Promise<never>(
        (_, reject) =>
          setTimeout(() => reject(new Error('Analysis timeout')), 30000), // 30 second timeout
      ),
    ])

    metrics.analysisTime = Date.now() - analysisStart
    metrics.cached = analysisResult.cached

    // Prepare response with performance metrics
    const responseStart = Date.now()
    const response = {
      success: true,
      analysis: {
        id: analysisResult.id,
        sessionId: analysisResult.sessionId,
        overallBiasScore: analysisResult.overallBiasScore,
        alertLevel: analysisResult.alertLevel,
        confidence: analysisResult.confidence,
        layerResults: analysisResult.layerResults,
        recommendations: analysisResult.recommendations,
        demographics: analysisResult.demographics,
        sessionType: analysisResult.sessionType,
        processingTimeMs: analysisResult.processingTimeMs,
        createdAt: analysisResult.createdAt,
        cached: analysisResult.cached,
      },
      performance: {
        requestId,
        totalTime: Date.now() - startTime,
        validationTime: metrics.validationTime,
        analysisTime: metrics.analysisTime,
        serverTime: Date.now() - startTime,
      },
    }

    metrics.responseTime = Date.now() - responseStart
    metrics.totalTime = Date.now() - startTime

    // Log performance metrics
    logger.info('Bias analysis request completed', {
      requestId,
      totalTime: metrics.totalTime,
      cached: metrics.cached,
      biasScore: analysisResult.overallBiasScore,
      alertLevel: analysisResult.alertLevel,
    })

    return new Response(JSON.stringify(scrubForClient(response)), {
      status: 200,
      headers: {
        ...CACHE_HEADERS,
        'X-Request-ID': requestId,
        'X-Processing-Time': metrics.totalTime.toString(),
        'X-Cached': metrics.cached.toString(),
      },
    })
  } catch (error) {
    // Replace detailed exposure with sanitized handling and controlled logging
    metrics.totalTime = Date.now() - startTime
    const safe = safeErrorForLogging(error)
    // In production do not expose internal messages; keep a short safe message
    metrics.error = isProduction ? 'Internal server error' : safe.message

    // Log full stack only when not in production (so support can debug); always include requestId
    logger.error('Bias analysis request failed', {
      requestId,
      totalTime: metrics.totalTime,
      error: metrics.error,
      ...(isProduction ? {} : { stack: safe.stack }),
    })

    // Return sanitized error to client (no stack)
    if (error instanceof Error && error.message === 'Analysis timeout') {
      return new Response(
        JSON.stringify(
          scrubForClient({
            error: 'Analysis timeout',
            message:
              'The bias analysis took too long to complete. Please try again.',
            requestId,
          }),
        ),
        {
          status: 408,
          headers: CACHE_HEADERS,
        },
      )
    }

    return new Response(
      JSON.stringify(
        scrubForClient({
          error: 'Internal server error',
          message:
            'An internal error occurred. Please provide the requestId to support for details.',
          requestId,
        }),
      ),
      {
        status: 500,
        headers: CACHE_HEADERS,
      },
    )
  }
}

export const GET: APIRoute = async ({ request }) => {
  const requestId = randomUUID()
  const startTime = Date.now()

  try {
    // Apply security middleware
    const securityResult = await securityMiddleware(request, {})
    if (securityResult) {
      return securityResult
    }

    // Get query parameters
    const url = new URL(request.url)
    const therapistId = url.searchParams.get('therapistId')
    const days = parseInt(url.searchParams.get('days') || '30')

    if (!therapistId) {
      return new Response(
        JSON.stringify(scrubForClient({ error: 'therapistId is required' })),
        {
          status: 400,
          headers: CACHE_HEADERS,
        },
      )
    }

    // Get optimized bias detection service
    const biasService = getOptimizedBiasDetectionService()

    // Get bias summary with timeout
    const summary = await Promise.race([
      biasService.getBiasSummary(therapistId, days),
      new Promise<never>(
        (_, reject) =>
          setTimeout(() => reject(new Error('Summary timeout')), 10000), // 10 second timeout
      ),
    ])

    const totalTime = Date.now() - startTime

    logger.info('Bias summary request completed', {
      requestId,
      totalTime,
      therapistId,
      days,
    })

    return new Response(
      JSON.stringify(
        scrubForClient({
          success: true,
          summary,
          performance: {
            requestId,
            totalTime,
          },
        }),
      ),
      {
        status: 200,
        headers: {
          ...CACHE_HEADERS,
          'X-Request-ID': requestId,
          'X-Processing-Time': totalTime.toString(),
        },
      },
    )
  } catch (error) {
    const totalTime = Date.now() - startTime
    const safe = safeErrorForLogging(error)
    const safeMessage = isProduction ? 'Internal server error' : safe.message

    logger.error('Bias summary request failed', {
      requestId,
      totalTime,
      error: safeMessage,
      ...(isProduction ? {} : { stack: safe.stack }),
    })

    if (error instanceof Error && error.message === 'Summary timeout') {
      return new Response(
        JSON.stringify(
          scrubForClient({
            error: 'Summary timeout',
            message: 'The summary request took too long to complete',
            requestId,
          }),
        ),
        {
          status: 408,
          headers: CACHE_HEADERS,
        },
      )
    }

    return new Response(
      JSON.stringify(
        scrubForClient({
          error: 'Internal server error',
          message:
            'An internal error occurred. Please provide the requestId to support for details.',
          requestId,
        }),
      ),
      {
        status: 500,
        headers: CACHE_HEADERS,
      },
    )
  }
}

// Batch analysis endpoint for multiple texts
export const PUT: APIRoute = async ({ request }) => {
  const requestId = randomUUID()
  const startTime = Date.now()

  try {
    // Apply security middleware with timeout (same pattern as POST)
    const securityStart = Date.now()
    const securityResult = await Promise.race([
      securityMiddleware(request, {}),
      new Promise<Response>((resolve) =>
        setTimeout(
          () =>
            resolve(new Response('Security check timeout', { status: 408 })),
          5000,
        ),
      ),
    ])

    if (securityResult) {
      return securityResult
    }

    // Parse and validate batch request body
    const BatchRequestSchema = z.object({
      items: z.array(AnalyzeBiasRequestSchema).min(1).max(20), // limit to 20 items per batch
    })

    let body: z.infer<typeof BatchRequestSchema>

    try {
      const rawBody = await request.json()
      body = BatchRequestSchema.parse(rawBody)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return new Response(
          JSON.stringify(
            scrubForClient({
              error: 'Validation failed',
              details: error.errors.map((e) => ({
                field: e.path.join('.'),
                message: e.message,
              })),
            }),
          ),
          {
            status: 400,
            headers: CACHE_HEADERS,
          },
        )
      }

      return new Response(
        JSON.stringify(scrubForClient({ error: 'Invalid request body' })),
        {
          status: 400,
          headers: CACHE_HEADERS,
        },
      )
    }

    // Get optimized bias detection service
    const biasService = getOptimizedBiasDetectionService()

    // Process all items in parallel with per-item timeouts
    const perItemTimeoutMs = 30000 // 30s per item
    const analysisPromises = body.items.map((item) =>
      Promise.race([
        biasService.analyzeBias({
          text: item.text,
          context: item.context,
          demographics: item.demographics,
          sessionType: item.sessionType,
          therapistNotes: item.therapistNotes,
          therapistId: item.therapistId,
          clientId: item.clientId,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Analysis timeout')),
            perItemTimeoutMs,
          ),
        ),
      ]),
    )

    const settled = await Promise.allSettled(analysisPromises)

    const results = settled.map((res, idx) => {
      if (res.status === 'fulfilled') {
        const r = res.value
        return {
          success: true,
          index: idx,
          analysis: {
            id: r.id,
            sessionId: r.sessionId,
            overallBiasScore: r.overallBiasScore,
            alertLevel: r.alertLevel,
            confidence: r.confidence,
            layerResults: r.layerResults,
            recommendations: r.recommendations,
            demographics: r.demographics,
            sessionType: r.sessionType,
            processingTimeMs: r.processingTimeMs,
            createdAt: r.createdAt,
            cached: r.cached,
          },
        }
      }

      const message =
        res.reason instanceof Error ? res.reason.message : String(res.reason)
      const safeMsg = isProduction ? 'Analysis failed' : message

      return {
        success: false,
        index: idx,
        error: safeMsg,
      }
    })

    const totalTime = Date.now() - startTime

    logger.info('Batch bias analysis completed', {
      requestId,
      totalTime,
      count: results.length,
      failures: results.filter((r) => !r.success).length,
    })

    return new Response(
      JSON.stringify(
        scrubForClient({
          success: true,
          results,
          performance: {
            requestId,
            totalTime,
          },
        }),
      ),
      {
        status: 200,
        headers: {
          ...CACHE_HEADERS,
          'X-Request-ID': requestId,
          'X-Processing-Time': totalTime.toString(),
        },
      },
    )
  } catch (error) {
    const totalTime = Date.now() - startTime
    const safe = safeErrorForLogging(error)
    const safeMessage = isProduction ? 'Internal server error' : safe.message

    logger.error('Batch bias analysis failed', {
      requestId,
      totalTime,
      error: safeMessage,
      ...(isProduction ? {} : { stack: safe.stack }),
    })

    if (error instanceof Error && error.message === 'Analysis timeout') {
      return new Response(
        JSON.stringify(
          scrubForClient({
            error: 'Analysis timeout',
            message: 'The batch analysis took too long to complete',
            requestId,
          }),
        ),
        {
          status: 408,
          headers: CACHE_HEADERS,
        },
      )
    }

    return new Response(
      JSON.stringify(
        scrubForClient({
          error: 'Internal server error',
          message:
            'An internal error occurred. Please provide the requestId to support for details.',
          requestId,
        }),
      ),
      {
        status: 500,
        headers: CACHE_HEADERS,
      },
    )
  }
}
