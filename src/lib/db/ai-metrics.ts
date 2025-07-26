import { supabase } from './supabase'

/**
 * Insert AI metrics into the database
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
}): Promise<void> {
  try {
    await supabase.from('ai_metrics').insert({
      model: data?.model,
      latency: data?.latency,
      input_tokens: data?.inputTokens,
      output_tokens: data?.outputTokens,
      total_tokens: data?.totalTokens,
      success: data?.success,
      error_code: data?.errorCode,
      cached: data?.cached ? 1 : 0,
      optimized: data?.optimized ? 1 : 0,
      user_id: data?.userId,
      session_id: data?.sessionId,
      request_id: data?.requestId,
      timestamp: new Date(),
    })
  } catch (error) {
    console.error('Error inserting AI performance metric:', error)
  }
}
