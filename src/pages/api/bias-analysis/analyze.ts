import type { APIRoute } from 'astro'
import { z } from 'zod'
import {
  initializeDatabase,
  sessionManager,
  biasAnalysisManager,
  transaction,
  createContentHash
} from '@/lib/db'
import { getOptimizedBiasDetectionService } from '@/lib/services/bias-detection-optimized'

/**
 * Interface for bias results
 */
interface BiasAnalysisResult {
  overallBiasScore: number
  alertLevel: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
  layerResults: Record<string, any>
  detectedBiases: string[]
  recommendations: string[]
}

/**
 * Validation schema for analysis request
 */
const AnalyzeRequestSchema = z.object({
  text: z.string().min(1),
  sessionId: z.string().optional(),
  therapistId: z.string(),
  clientId: z.string().optional(),
  context: z.string().optional(),
  demographics: z.record(z.string(), z.any()).optional(),
  sessionType: z.string().optional(),
  therapistNotes: z.string().optional()
})

/**
 * POST /api/bias-analysis/analyze
 */
export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now()

  try {
    // 1. Initialize and get connection
    await initializeDatabase()

    // 2. Parse request
    const body = await request.json() as unknown
    const validated = AnalyzeRequestSchema.safeParse(body)

    if (!validated.success) {
      return new Response(JSON.stringify({
        error: 'Invalid request',
        details: validated.error.format()
      }), { status: 400 })
    }

    const { text, sessionId, therapistId, demographics, context, therapistNotes, clientId, sessionType } = validated.data

    // 3. Perform analysis using the real AI engine
    const service = getOptimizedBiasDetectionService()
    const result = await service.analyzeBias({
      text,
      context,
      demographics,
      sessionType,
      therapistNotes,
      therapistId,
      clientId,
    })

    const contentHash = createContentHash(text, demographics ?? {})

    // 4. Save to database using a transaction
    const resultId = await transaction(async (_client) => {
      // Create session if not provided
      let finalSessionId = sessionId
      if (!finalSessionId) {
        finalSessionId = await sessionManager.createSession({
          therapistId,
          clientId,
          sessionType: sessionType ?? 'individual',
          context: { description: context ?? '', therapistNotes }
        })
      }

      // Save analysis
      return biasAnalysisManager.saveAnalysis({
        sessionId: finalSessionId,
        therapistId,
        overallBiasScore: result.overallBiasScore,
        alertLevel: result.alertLevel,
        confidence: result.confidence,
        layerResults: result.layerResults as Record<string, unknown>,
        detectedBiases: result.detectedBiases,
        recommendations: result.recommendations,
        demographics: (demographics ?? {}) as Record<string, unknown>,
        contentHash,
        processingTimeMs: Date.now() - startTime
      })
    })

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: resultId,
        overallBiasScore: result.overallBiasScore,
        alertLevel: result.alertLevel,
        confidence: result.confidence,
        layerResults: result.layerResults,
        detectedBiases: result.detectedBiases,
        recommendations: result.recommendations,
        processingTimeMs: Date.now() - startTime
      }
    }), { status: 200 })

  } catch (error: unknown) {
    console.error('Bias analysis failed:', error)
    return new Response(JSON.stringify({
      error: 'Analysis failed',
      message: 'An internal server error occurred'
    }), { status: 500 })
  }
}

/**
 * GET summary of results
 */
export const GET: APIRoute = async ({ url }) => {
  const therapistId = url.searchParams.get('therapistId')
  
  if (!therapistId) {
    return new Response(JSON.stringify({ error: 'therapistId required' }), { status: 400 })
  }

  try {
    await initializeDatabase()
    const summary = await biasAnalysisManager.getBiasSummary(therapistId)
    
    return new Response(JSON.stringify({
      success: true,
      data: summary
    }), { status: 200 })
  } catch (error: any) {
    console.error('Bias analysis summary failed:', error)
    return new Response(JSON.stringify({ error: 'An internal server error occurred' }), { status: 500 })
  }
}
