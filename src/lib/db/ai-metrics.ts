// Supabase import removed - migrate to MongoDB

/**
 * Insert AI metrics into the database
 */
export async function insertAIPerformanceMetric(_data: {
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
}): Promise<void> {
  try {
    // TODO: Implement MongoDB insert for AI metrics
    // Example: await mongoClient.db().collection('ai_metrics').insertOne({...})
    return
  } catch (error: unknown) {
    console.error('Error inserting AI performance metric:', error)
  }
}
