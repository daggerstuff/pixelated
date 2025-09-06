// MongoDB Atlas–backed AI schema definitions

import { mongodb } from '@/config/mongodb.config'
import type { Db } from 'mongodb'

/** AI collection names in MongoDB Atlas */
export const AI_COLLECTIONS = {
  SENTIMENT_ANALYSIS: 'ai_sentiment_analysis',
  CRISIS_DETECTION: 'ai_crisis_detection',
  RESPONSE_GENERATION: 'ai_response_generation',
  INTERVENTION_ANALYSIS: 'ai_intervention_analysis',
  USAGE_STATS: 'ai_usage_stats',
  BIAS_ANALYSIS: 'ai_bias_analysis',
  BIAS_METRICS: 'ai_bias_metrics',
  BIAS_ALERTS: 'ai_bias_alerts',
  BIAS_REPORTS: 'ai_bias_reports',
} as const

/**
 * Initialize AI collections: connect to MongoDB and create common indexes
 */
export async function initializeAICollections(): Promise<boolean> {
  const db: Db = await mongodb.connect()
  try {
    await Promise.all(
      Object.values(AI_COLLECTIONS).map((name) =>
        Promise.all([
          db.collection(name).createIndex({ user_id: 1 }),
          db.collection(name).createIndex({ created_at: 1 }),
        ]),
      ),
    )
    console.log('✅ AI collections initialized with indexes')
    return true
  } catch (error: unknown) {
    console.error('❌ Failed to initialize AI collections:', error)
    throw error
  }
}
