import type { AIMetrics } from '../../types/mongodb.types'
import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { mongoClient } from './mongoClient'

const logger = createBuildSafeLogger('ai-metrics') // Supabase import removed - migrate to MongoDB

/**
 * Insert AI metrics into the database.
 *
 * The stored document conforms to the shared `AIMetrics` contract consumed by
 * `AIMetricsDAO` and the admin aggregation/lookup paths, so inserted rows stay
 * visible to those readers.
 */
export async function insertAIPerformanceMetric(data: {
  model: string
  latency: number
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  success: boolean
  errorCode?: string
  cached?: boolean
  optimized?: boolean
  userId?: string
  sessionId?: string
  requestId: string
  requestType?: string
}): Promise<void> {
  try {
    const { ObjectId } = await import('mongodb')

    const db = await mongoClient.connect()

    const doc: AIMetrics = {
      userId: data.userId ? new ObjectId(data.userId) : new ObjectId(),
      sessionId: data.sessionId ?? data.requestId,
      modelName: data.model,
      requestType: data.requestType ?? 'completion',
      tokensUsed:
        data.totalTokens ?? (data.inputTokens ?? 0) + (data.outputTokens ?? 0),
      responseTime: data.latency,
      timestamp: new Date(),
      metadata: {
        success: data.success,
        errorCode: data.errorCode,
        cached: data.cached,
        optimized: data.optimized,
        requestId: data.requestId,
      },
    }

    await db.collection<AIMetrics>('ai_metrics').insertOne(doc)
  } catch (error: unknown) {
    logger.error('Error inserting AI performance metric:', error)
  }
}
