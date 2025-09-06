import type { Json } from '../../../types/json'
import type { User } from '../../auth/index'

/**
 * Base interface for all AI analysis results
 */
export interface BaseAnalysisResult {
  id: string
  userId: string
  user?: User
  createdAt: Date
  updatedAt: Date
  modelId: string
  modelProvider: string
  requestTokens: number
  responseTokens: number
  totalTokens: number
  latencyMs: number
  success: boolean
  error: string | null
}

/**
 * Sentiment analysis result
 */
export interface SentimentAnalysisResult extends BaseAnalysisResult {
  text: string
  sentiment: 'positive' | 'negative' | 'neutral'
  score: number
  confidence: number
  metadata: Json | null
  emotions?: Record<string, number>
}

/**
 * Crisis detection result
 */
export interface CrisisDetectionResult extends BaseAnalysisResult {
  text: string
  crisisDetected: boolean
  crisisType: string | null
  confidence: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  sensitivityLevel: number
  metadata: Json | null
}

/**
 * Therapeutic response generation result
 */
export interface ResponseGenerationResult extends BaseAnalysisResult {
  prompt: string
  response: string
  context: string | null
  instructions: string | null
  temperature: number
  maxTokens: number
  metadata: Json | null
}

/**
 * Intervention analysis result
 */
export interface InterventionAnalysisResult extends BaseAnalysisResult {
  conversation: string
  intervention: string
  userResponse: string
  effectiveness: number
  insights: string
  recommendedFollowUp: string | null
  metadata: Json | null
}

/**
 * AI usage statistics
 */
export interface AIUsageStats {
  userId: string
  user?: User
  period: 'daily' | 'weekly' | 'monthly'
  date: Date
  totalRequests: number
  totalTokens: number
  totalCost: number
  modelUsage: Json
}
