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
  demographics: z.object({
    age: z.number().int().min(18).max(120).optional(),
    gender: z.enum(['male', 'female', 'non-binary', 'other']).optional(),
    ethnicity: z.string().optional(),
    primaryLanguage: z.string().optional()
  }).optional(),
  sessionType: z.enum(['individual', 'group', 'family', 'couples']).optional(),
  therapistNotes: z.string().max(1000).optional(),
  therapistId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional()
})

// Response caching headers
const CACHE_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block'
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

export const POST: APIRoute = async ({ request }) => {
  const requestId = randomUUID()
  const startTime = Date.now()
  
  const metrics: PerformanceMetrics = {
    requestId,
    startTime,
    totalTime: 0,
    cached: false
  }
  
  try {
    // Apply security middleware with timeout
    const securityStart = Date.now()
    const securityResult = await Promise.race([
      securityMiddleware(request, {}),
      new Promise<Response>((resolve) => 
        setTimeout(() => resolve(new Response('Security check timeout', { status: 408 })), 5000)
      )
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
        return new Response(JSON.stringify({
          error: 'Validation failed',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        }), {
          status: 400,
          headers: CACHE_HEADERS
        })
      }
      
      return new Response(JSON.stringify({
        error: 'Invalid request body'
      }), {
        status: 400,
        headers: CACHE_HEADERS
      })
    }
    
    metrics.validationTime = (metrics.validationTime || 0) + (Date.now() - parseStart)
    
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
        clientId: body.clientId
      }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Analysis timeout')), 30000) // 30 second timeout
      )
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
        cached: analysisResult.cached
      },
      performance: {
        requestId,
        totalTime: Date.now() - startTime,
        validationTime: metrics.validationTime,
        analysisTime: metrics.analysisTime,
        serverTime: Date.now() - startTime
      }
    }
    
    metrics.responseTime = Date.now() - responseStart
    metrics.totalTime = Date.now() - startTime
    
    // Log performance metrics
    logger.info('Bias analysis request completed', {
      requestId,
      totalTime: metrics.totalTime,
      cached: metrics.cached,
      biasScore: analysisResult.overallBiasScore,
      alertLevel: analysisResult.alertLevel
    })
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...CACHE_HEADERS,
        'X-Request-ID': requestId,
        'X-Processing-Time': metrics.totalTime.toString(),
        'X-Cached': metrics.cached.toString()
      }
    })
    
  } catch (error) {
    metrics.totalTime = Date.now() - startTime
    metrics.error = error instanceof Error ? error.message : String(error)
    
    logger.error('Bias analysis request failed', {
      requestId,
      totalTime: metrics.totalTime,
      error: metrics.error
    })
    
    // Return appropriate error response
    if (error instanceof Error && error.message === 'Analysis timeout') {
      return new Response(JSON.stringify({
        error: 'Analysis timeout',
        message: 'The bias analysis took too long to complete. Please try again.',
        requestId
      }), {
        status: 408,
        headers: CACHE_HEADERS
      })
    }
    
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? metrics.error : 'An error occurred during analysis',
      requestId
    }), {
      status: 500,
      headers: CACHE_HEADERS
    })
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
      return new Response(JSON.stringify({
        error: 'therapistId is required'
      }), {
        status: 400,
        headers: CACHE_HEADERS
      })
    }
    
    // Get optimized bias detection service
    const biasService = getOptimizedBiasDetectionService()
    
    // Get bias summary with timeout
    const summary = await Promise.race([
      biasService.getBiasSummary(therapistId, days),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Summary timeout')), 10000) // 10 second timeout
      )
    ])
    
    const totalTime = Date.now() - startTime
    
    logger.info('Bias summary request completed', {
      requestId,
      totalTime,
      therapistId,
      days
    })
    
    return new Response(JSON.stringify({
      success: true,
      summary,
      performance: {
        requestId,
        totalTime
      }
    }), {
      status: 200,
      headers: {
        ...CACHE_HEADERS,
        'X-Request-ID': requestId,
        'X-Processing-Time': totalTime.toString()
      }
    })
    
  } catch (error) {
    const totalTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    logger.error('Bias summary request failed', {
      requestId,
      totalTime,
      error: errorMessage
    })
    
    if (error instanceof Error && error.message === 'Summary timeout') {
      return new Response(JSON.stringify({
        error: 'Summary timeout',
        message: 'The summary request took too long to complete',
        requestId
      }), {
        status: 408,
        headers: CACHE_HEADERS
      })
    }
    
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? errorMessage : 'Failed to retrieve summary',
      requestId
    }), {
      status: 500,
      headers: CACHE_HEADERS
    })
  }
}

// Batch analysis endpoint for multiple texts
export const PUT: APIRoute = async ({ request }) => {
  const requestId = randomUUID()
  const startTime = Date.now()
  
  try {
    // Apply security middleware
    const securityResult = await securityMiddleware(request, {})
    if (securityResult) {
      return securityResult
    }
    
    // Parse request body
    const body = await request.json()
    const { texts, options } = body
    
    if (!Array.isArray(texts) || texts.length === 0) {
      return new Response(JSON.stringify({
        error: 'texts must be a non-empty array'
      }), {
        status: 400,
        headers: CACHE_HEADERS
      })
    }
    
    if (texts.length > 100) {
      return new Response(JSON.stringify({
        error: 'Maximum 100 texts allowed per batch request'
      }), {
        status: 400,
        headers: CACHE_HEADERS
      })
    }
    
    // Get optimized bias detection service
    const biasService = getOptimizedBiasDetectionService()
    
    // Perform batch analysis with timeout
    const results = await Promise.race([
      biasService.batchAnalyzeBias(texts, options || {}),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Batch analysis timeout')), 60000) // 60 second timeout
      )
    ])
    
    const totalTime = Date.now() - startTime
    
    logger.info('Batch bias analysis request completed', {
      requestId,
      totalTime,
      textCount: texts.length
    })
    
    return new Response(JSON.stringify({
      success: true,
      results,
      performance: {
        requestId,
        totalTime,
        textCount: texts.length,
        avgTimePerText: Math.round(totalTime / texts.length)
      }
    }), {
      status: 200,
      headers: {
        ...CACHE_HEADERS,
        'X-Request-ID': requestId,
        'X-Processing-Time': totalTime.toString(),
        'X-Text-Count': texts.length.toString()
      }
    })
    
  } catch (error) {
    const totalTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    logger.error('Batch bias analysis request failed', {
      requestId,
      totalTime,
      error: errorMessage
    })
    
    if (error instanceof Error && error.message === 'Batch analysis timeout') {
      return new Response(JSON.stringify({
        error: 'Batch analysis timeout',
        message: 'The batch analysis took too long to complete',
        requestId
      }), {
        status: 408,
        headers: CACHE_HEADERS
      })
    }
    
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? errorMessage : 'Batch analysis failed',
      requestId
    }), {
      status: 500,
      headers: CACHE_HEADERS
    })
  }
}