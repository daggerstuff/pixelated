/**
 * Optimized Bias Detection Service
 * High-performance bias analysis with caching, connection pooling, and ML model optimization
 */

import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'

import { BiasDetectionEngine } from '../ai/bias-detection/BiasDetectionEngine'
import { getCache } from '../cache/redis-cache'
import { getPool, createContentHash, biasAnalysisManager, initializeDatabase } from '../db'
import { createBuildSafeLogger } from '../logging/build-safe-logger'

const logger = createBuildSafeLogger('bias-detection-service')

// Performance configuration
const PERFORMANCE_CONFIG = {
  // Cache TTL in seconds
  CACHE_TTL: {
    ANALYSIS_RESULTS: 3600, // 1 hour
    USER_SUMMARY: 1800, // 30 minutes
    DASHBOARD_DATA: 300, // 5 minutes
    ML_MODEL_CACHE: 7200, // 2 hours
  },

  // Database query timeouts
  QUERY_TIMEOUTS: {
    ANALYSIS_INSERT: 5000, 
    CACHE_LOOKUP: 1000,
    SUMMARY_QUERY: 3000,
  },

  // ML model optimization
  ML_CONFIG: {
    BATCH_SIZE: 10,
    MAX_CONCURRENT: 5,
    TIMEOUT_MS: 30000,
  },
}

// Optimized bias detection with caching and connection pooling
export class OptimizedBiasDetectionService {
  private static instance: OptimizedBiasDetectionService
  private cache = getCache()

  private constructor() {}

  public static getInstance(): OptimizedBiasDetectionService {
    if (!OptimizedBiasDetectionService.instance) {
      OptimizedBiasDetectionService.instance = new OptimizedBiasDetectionService()
    }
    return OptimizedBiasDetectionService.instance
  }

  /**
   * Perform high-performance bias analysis with intelligent caching
   */
  async analyzeBias(params: {
    text: string
    sessionId?: string
    context?: string
    demographics?: any
    sessionType?: string
    therapistNotes?: string
    therapistId?: string
    clientId?: string
  }): Promise<{
    id: string
    sessionId: string
    overallBiasScore: number
    alertLevel: 'low' | 'medium' | 'high' | 'critical'
    confidence: number
    layerResults: any
    detectedBiases: string[]
    recommendations: string[]
    demographics: any
    sessionType: string
    processingTimeMs: number
    createdAt: string
    cached: boolean
  }> {
    const startTime = performance.now()
    const analysisId = randomUUID()
    // Honour a caller-provided sessionId (e.g. from an existing session),
    // fall back to a fresh UUID only when none was supplied.
    const sessionId = params.sessionId ?? randomUUID()

    try {
      // Generate content hash for caching
      const contentHash = createContentHash(
        params.text,
        params.demographics || {},
      )
      const cacheKey = `bias:analysis:${contentHash}`

      // Check cache first with timeout
      const cachedResult = await this.getCachedAnalysis(cacheKey)
      if (cachedResult) {
        const processingTime = Math.round(performance.now() - startTime)
        logger.info('Bias analysis served from cache', {
          analysisId,
          processingTime,
          cacheHit: true,
        })

        return {
          ...cachedResult,
          id: analysisId,
          sessionId,
          processingTimeMs: processingTime,
          cached: true,
          createdAt: new Date().toISOString(),
        }
      }

      // Perform actual bias analysis with optimized ML model
      const analysisResult = await this.performOptimizedAnalysis(params.text)

      // Store in database with connection pooling
      await this.storeAnalysisResults({
        analysisId,
        sessionId,
        therapistId: params.therapistId || null,
        clientId: params.clientId || null,
        ...analysisResult,
        demographics: params.demographics || {},
        sessionType: params.sessionType || 'individual',
        contentHash,
        processingTimeMs: Math.round(performance.now() - startTime),
      })

      // Cache the result
      await this.cacheAnalysisResults(cacheKey, {
        ...analysisResult,
        demographics: params.demographics || {},
        sessionType: params.sessionType || 'individual',
      })

      const totalProcessingTime = Math.round(performance.now() - startTime)

      logger.info('Bias analysis completed', {
        analysisId,
        processingTime: totalProcessingTime,
        cacheHit: false,
        biasScore: analysisResult.overallBiasScore,
        alertLevel: analysisResult.alertLevel,
      })

      return {
        id: analysisId,
        sessionId,
        overallBiasScore: analysisResult.overallBiasScore,
        alertLevel: analysisResult.alertLevel,
        confidence: analysisResult.confidence,
        layerResults: analysisResult.layerResults,
        detectedBiases: analysisResult.detectedBiases,
        recommendations: analysisResult.recommendations,
        demographics: params.demographics || {},
        sessionType: params.sessionType || 'individual',
        processingTimeMs: totalProcessingTime,
        createdAt: new Date().toISOString(),
        cached: false,
      }
    } catch (error: unknown) {
      const processingTime = Math.round(performance.now() - startTime)
      logger.error('Bias analysis failed', {
        analysisId,
        processingTime,
        error: error instanceof Error ? (error instanceof Error ? error.message : "Unknown error") : String(error),
      })
      throw error
    }
  }

  /**
   * Optimized cache lookup with timeout
   */
  private async getCachedAnalysis(cacheKey: string): Promise<any | null> {
    try {
      const cachePromise = this.cache.get(cacheKey)
      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(
          () => resolve(null),
          PERFORMANCE_CONFIG.QUERY_TIMEOUTS.CACHE_LOOKUP,
        ),
      )

      return await Promise.race([cachePromise, timeoutPromise])
    } catch (error: unknown) {
      logger.warn('Cache lookup failed', { cacheKey, error })
      return null
    }
  }

  private engine = new BiasDetectionEngine()

  /**
   * High-performance bias analysis using the real AI engine
   */
  private async performOptimizedAnalysis(text: string): Promise<{
    overallBiasScore: number
    alertLevel: 'low' | 'medium' | 'high' | 'critical'
    confidence: number
    layerResults: any
    detectedBiases: string[]
    recommendations: string[]
  }> {
    if (!this.engine) {
      this.engine = new BiasDetectionEngine()
    }

    try {
      // Build a minimal TherapeuticSession for the engine
      const session = {
        sessionId: randomUUID(),
        sessionDate: new Date().toISOString(),
        participantDemographics: {
          age: 'unknown',
          gender: 'unknown',
          ethnicity: 'unknown',
          primaryLanguage: 'en',
        },
        scenario: { scenarioId: 'ad-hoc', type: 'general-wellness' as const },
        content: { transcript: text, aiResponses: [], userInputs: [text] },
        aiResponses: [],
        expectedOutcomes: [],
        transcripts: [],
        userInputs: [text],
        metadata: {
          sessionType: 'individual' as const,
          platform: 'web',
          modelVersion: '1.0',
          evaluationMode: false,
          sessionStartTime: new Date(),
          sessionEndTime: new Date(),
        },
        timestamp: new Date(),
      }

      const result = await this.engine.analyzeSession(session)

      // Extract detected biases from layer results (not a top-level field on AnalysisResult)
      const detectedBiases: string[] = []
      const lr = result.layerResults as Record<string, any> | null | undefined
      if (lr != null) {
        for (const layer of Object.values(lr)) {
          if (layer && Array.isArray(layer.detectedBiases)) {
            detectedBiases.push(...(layer.detectedBiases as string[]))
          }
        }
      }

      return {
        overallBiasScore: result.overallBiasScore,
        alertLevel: result.alertLevel as 'low' | 'medium' | 'high' | 'critical',
        confidence: result.confidence,
        layerResults: result.layerResults,
        detectedBiases: [...new Set(detectedBiases)],
        recommendations: result.recommendations,
      }
    } catch (error: unknown) {
      logger.error('Engine analysis failed', {
        error: error instanceof Error ? (error instanceof Error ? error.message : "Unknown error") : String(error),
      })
      throw error
    }
  }


  /**
   * Insert (or skip) the session row for this analysis.
   * Uses ON CONFLICT DO NOTHING so repeated calls with the same session ID are idempotent.
   */
  private async insertSessionRecord(
    client: import('pg').PoolClient,
    data: Pick<
      Parameters<OptimizedBiasDetectionService['storeAnalysisResults']>[0],
      'sessionId' | 'therapistId' | 'clientId' | 'sessionType'
    >,
  ): Promise<void> {
    // therapist_id is NOT NULL in the schema; skip the row when we have no therapist.
    if (!data.therapistId) return

    await client.query(
      `INSERT INTO sessions (
        id, therapist_id, client_id, session_type, context,
        started_at, state, summary
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO NOTHING`,
      [
        data.sessionId,
        data.therapistId,
        data.clientId,
        data.sessionType,
        JSON.stringify({ description: '' }),
        new Date(),
        'completed',
        '',
      ],
    )
  }

  /**
   * Insert the bias analysis row.
   */
  private async insertAnalysisRecord(
    client: import('pg').PoolClient,
    data: Omit<
      Parameters<OptimizedBiasDetectionService['storeAnalysisResults']>[0],
      'sessionType'
    >,
  ): Promise<void> {
    await client.query(
      `INSERT INTO bias_analyses (
        id, session_id, therapist_id, overall_bias_score,
        alert_level, confidence, layer_results, detected_biases, recommendations,
        demographics, content_hash, processing_time_ms, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        data.analysisId,
        data.sessionId,
        data.therapistId,
        data.overallBiasScore,
        data.alertLevel,
        data.confidence,
        JSON.stringify(data.layerResults),
        data.detectedBiases,
        data.recommendations,
        JSON.stringify(data.demographics),
        data.contentHash,
        data.processingTimeMs,
        new Date(),
      ],
    )
  }

  /**
   * Store analysis results with optimized database operations.
   * Orchestrates session + analysis inserts inside a single transaction
   * with a hard timeout; destroys the connection on timeout rather than
   * recycling it to prevent pool corruption.
   */
  private async storeAnalysisResults(data: {
    analysisId: string
    sessionId: string
    therapistId: string | null
    clientId: string | null
    overallBiasScore: number
    alertLevel: string
    confidence: number
    layerResults: any
    detectedBiases: string[]
    recommendations: string[]
    demographics: any
    sessionType: string
    contentHash: string
    processingTimeMs: number
  }): Promise<void> {
    await initializeDatabase()
    const pool = getPool()
    const client = await pool.connect()
    let timeoutHandle: NodeJS.Timeout | undefined
    let timedOut = false
    try {
      await client.query('BEGIN')

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new Error('Database operation timeout')),
          PERFORMANCE_CONFIG.QUERY_TIMEOUTS.ANALYSIS_INSERT,
        )
      })

      try {
        await Promise.race([
          Promise.all([
            this.insertSessionRecord(client, data),
            this.insertAnalysisRecord(client, data),
          ]),
          timeoutPromise,
        ])
        await client.query('COMMIT')
      } catch (error: unknown) {
        if ((error as Error).message === 'Database operation timeout') {
          // In-flight queries are still running on this connection — do not
          // attempt ROLLBACK (would cause pg sync errors). Mark for destruction.
          timedOut = true
        } else {
          try { await client.query('ROLLBACK') } catch { /* best-effort */ }
        }
        throw error
      } finally {
        if (timeoutHandle !== undefined) clearTimeout(timeoutHandle)
      }
    } finally {
      // Destroy connection on timeout; recycle normally otherwise.
      client.release(timedOut)
    }
  }

  /**
   * Cache analysis results with optimized serialization
   */
  private async cacheAnalysisResults(
    cacheKey: string,
    data: any,
  ): Promise<void> {
    try {
      // Use shorter TTL for high-bias results to ensure freshness
      const ttl =
        data.overallBiasScore > 0.6
          ? PERFORMANCE_CONFIG.CACHE_TTL.ANALYSIS_RESULTS / 2
          : PERFORMANCE_CONFIG.CACHE_TTL.ANALYSIS_RESULTS

      await this.cache.set(cacheKey, data, ttl)
    } catch (error: unknown) {
      logger.warn('Failed to cache analysis results', { cacheKey, error })
    }
  }

  /**
   * Get optimized bias summary for therapist
   */
  async getBiasSummary(
    therapistId: string,
    days: number = 30,
  ): Promise<{
    total_analyses: number
    avg_bias_score: number
    high_alerts: number
    low_alerts: number
    last_analysis: string | null
    trend: 'improving' | 'stable' | 'worsening'
  }> {
    const cacheKey = `bias:summary:${therapistId}:${days}`

    try {
      // Check cache first
      const cached = (await this.cache.get(cacheKey)) as any
      if (
        cached &&
        typeof cached === 'object' &&
        'total_analyses' in cached &&
        'avg_bias_score' in cached
      ) {
        return cached
      }

      // Get from database with timeout
      const summaryPromise = biasAnalysisManager.getBiasSummary(therapistId, days)
      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(
          () => resolve(null),
          PERFORMANCE_CONFIG.QUERY_TIMEOUTS.SUMMARY_QUERY,
        ),
      )

      const summary = await Promise.race([summaryPromise, timeoutPromise])

      if (!summary) {
        throw new Error('Failed to retrieve bias summary')
      }

      // Calculate trend
      const trend = this.calculateBiasTrend(summary.avg_bias_score)

      const result = {
        ...summary,
        trend,
      }

      // Cache the result
      await this.cache.set(
        cacheKey,
        result,
        PERFORMANCE_CONFIG.CACHE_TTL.USER_SUMMARY,
      )

      return result
    } catch (error: unknown) {
      logger.error('Failed to get bias summary', { therapistId, days, error })
      throw error
    }
  }

  /**
   * Calculate bias trend based on average score
   */
  private calculateBiasTrend(
    avgScore: number,
  ): 'improving' | 'stable' | 'worsening' {
    if (avgScore < 0.2) return 'improving'
    if (avgScore > 0.6) return 'worsening'
    return 'stable'
  }

  /**
   * Batch process multiple texts for bias analysis
   */
  async batchAnalyzeBias(
    texts: string[],
    _options: {
      demographics?: any[]
      context?: string[]
    } = {},
  ): Promise<
    Array<{
      id: string
      biasScore: number
      alertLevel: string
      confidence: number
      processingTimeMs: number
    }>
  > {
    const batchSize = PERFORMANCE_CONFIG.ML_CONFIG.BATCH_SIZE
    const results: Array<{
      id: string
      biasScore: number
      alertLevel: string
      confidence: number
      processingTimeMs: number
    }> = []

    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)

      const batchPromises = batch.map(async (text, _index) => {
        const startTime = performance.now()
        const analysisId = randomUUID()

        try {
          const result = await this.performOptimizedAnalysis(text)
          const processingTime = Math.round(performance.now() - startTime)

          return {
            id: analysisId,
            biasScore: result.overallBiasScore,
            alertLevel: result.alertLevel,
            confidence: result.confidence,
            processingTimeMs: processingTime,
          }
        } catch (error: unknown) {
          logger.error('Batch analysis failed for text', { analysisId, error })
          return {
            id: analysisId,
            biasScore: 0,
            alertLevel: 'low',
            confidence: 0,
            processingTimeMs: Math.round(performance.now() - startTime),
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      // Small delay between batches to prevent system overload
      if (i + batchSize < texts.length) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    return results
  }
}

export function getOptimizedBiasDetectionService(): OptimizedBiasDetectionService {
  return OptimizedBiasDetectionService.getInstance()
}

export function createOptimizedBiasDetectionService(): OptimizedBiasDetectionService {
  return OptimizedBiasDetectionService.getInstance()
}
