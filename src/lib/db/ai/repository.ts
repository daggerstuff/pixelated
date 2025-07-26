import type { Database } from '../../../types/supabase'
import type {
  AIUsageStats,
  CrisisDetectionResult,
  InterventionAnalysisResult,
  ResponseGenerationResult,
  SentimentAnalysisResult,
} from './types'
import type { TherapySession } from '../../ai/models/ai-types'
import type { EmotionAnalysis } from '../../ai/emotions/types'
import { supabase } from '../../supabase'
// TODO: Create these service interfaces when services are implemented
interface EfficacyFeedback {
  recommendationId: string
  clientId: string
  techniqueId: string
  efficacyRating: number
  timestamp: string | Date
  feedback: string
  sessionId: string
  therapistId: string
  context: Record<string, unknown>
}

interface EfficacyFeedbackRecord {
  recommendation_id: string
  client_id: string
  technique_id: string
  efficacy_rating: number
  timestamp: string
  feedback: string
  session_id: string
  therapist_id: string
  context: Record<string, unknown>
}

interface Technique {
  id: string
  name: string
  description: string
  indication: string
  category: string
}

interface ClientProfile {
  preferences?: Record<string, unknown>
  characteristics?: Record<string, unknown>
  demographic?: Record<string, unknown>
  history?: {
    pastTechniques: PastTechnique[]
  }
}

interface PastTechnique {
  techniqueId: string
  techniqueName: string
  lastUsed: Date
  efficacy: number
  usageCount: number
}

interface ClientTechniqueHistoryItem {
  technique_id: string
  technique_name: string
  last_used_at: string
  efficacy_rating: number
  usage_count: number
}

interface TherapySessionRecord {
  id: string
  client_id: string
  therapist_id: string
  start_time: string
  end_time?: string
  status: string
  security_level: string
  emotion_analysis_enabled: boolean
  metadata: Record<string, unknown>
}

interface EmotionAnalysisRecord {
  id: string
  timestamp: string
  emotions: unknown
  dominant_emotion: string
  risk_factors?: unknown
  requires_attention: boolean
  text: string
  client_id: string
}

interface Emotion {
  type: string
  intensity: number
  timestamp: Date
  confidence: number
}

interface RiskFactor {
  type: string
  severity: 'low' | 'medium' | 'high'
  description: string
  confidence: number
}

interface BiasAnalysisResult {
  id: string
  sessionId: string
  userId: string
  createdAt: Date
  updatedAt: Date
  overallBiasScore: number
  alertLevel: string
  confidenceScore: number
  layerResults: Record<string, unknown>
  demographics: Record<string, unknown>
  demographicGroups: Record<string, unknown>
  recommendations: string[]
  explanation: string
  latencyMs: number
  modelId: string
  modelProvider: string
  metadata: Record<string, unknown>
}

interface BiasMetric {
  id: string
  metricType: string
  metricName: string
  metricValue: number
  sessionId?: string
  userId?: string
  timestamp: Date
  aggregationPeriod: string
  metadata: Record<string, unknown>
  createdAt: Date
}

interface BiasAlert {
  id: string
  alertId: string
  sessionId?: string
  userId?: string
  createdAt: Date
  updatedAt: Date
  alertType: string
  alertLevel: string
  message: string
  details: Record<string, unknown>
  acknowledged: boolean
  acknowledgedBy?: string
  acknowledgedAt?: Date | null
  resolved: boolean
  resolvedBy?: string
  resolvedAt?: Date | null
  actions: unknown[]
  notificationChannels: string[]
  escalated: boolean
  escalatedAt?: Date | null
}

interface AlertAction {
  type: string
  timestamp: Date
  userId: string
  description: string
  metadata?: Record<string, unknown>
}

interface AlertUpdateData {
  acknowledged?: boolean
  acknowledged_at?: string | null
  acknowledged_by?: string
  resolved?: boolean
  resolved_at?: string | null
  resolved_by?: string
  escalated?: boolean
  escalated_at?: string | null
  actions?: AlertAction[]
}

interface BiasAlertDistribution {
  low: number
  medium: number
  high: number
  critical: number
}

interface BiasAggregatedMetrics {
  totalAnalyses: number
  averageBiasScore: number
  alertCounts: BiasAlertDistribution
  demographics: Record<string, unknown>
}

interface BiasTrendAnalysis {
  periodType: 'daily' | 'weekly' | 'monthly'
  trends: Array<{
    period: string
    biasScore: number
    alertCount: number
    sessionCount: number
  }>
}

interface BiasCustomAnalysis {
  analysisType: string
  parameters: Record<string, unknown>
  results: Record<string, unknown>
}

interface BiasRecommendations {
  priority: 'low' | 'medium' | 'high' | 'critical'
  recommendations: Array<{
    type: string
    description: string
    actionItems: string[]
    timeline: string
  }>
}

interface BiasReport {
  id: string
  reportId: string
  userId?: string
  title: string
  description?: string
  createdAt: Date
  updatedAt: Date
  timeRangeStart: Date
  timeRangeEnd: Date
  sessionCount: number
  format: 'json' | 'pdf' | 'html' | 'csv'
  overallFairnessScore?: number
  averageBiasScore?: number
  alertDistribution?: BiasAlertDistribution
  aggregatedMetrics?: BiasAggregatedMetrics
  trendAnalysis?: BiasTrendAnalysis
  customAnalysis?: BiasCustomAnalysis
  recommendations?: BiasRecommendations
  executionTimeMs?: number
  filePath?: string
  expiresAt?: Date | null
  metadata?: Record<string, unknown>
}

/**
 * Repository for AI analysis results
 */
export class AIRepository {
  /**
   * Store a sentiment analysis result
   */
  async storeSentimentAnalysis(
    result: Omit<SentimentAnalysisResult, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<string> {
    const { data, error } = await supabase
      .from('ai_sentiment_analysis')
      .insert({
        user_id: result?.userId,
        model_id: result?.modelId,
        model_provider: result?.modelProvider,
        request_tokens: result?.requestTokens,
        response_tokens: result?.responseTokens,
        total_tokens: result?.totalTokens,
        latency_ms: result?.latencyMs,
        success: result?.success,
        error: result?.error,
        text: result?.text,
        sentiment: result?.sentiment,
        score: result?.score,
        confidence: result?.confidence,
        metadata: result?.metadata,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error storing sentiment analysis:', error)
      throw error
    }

    return data?.id
  }

  /**
   * Store a crisis detection result
   */
  async storeCrisisDetection(
    result: Omit<CrisisDetectionResult, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<string> {
    const { data, error } = await supabase
      .from('ai_crisis_detection')
      .insert({
        user_id: result?.userId,
        model_id: result?.modelId,
        model_provider: result?.modelProvider,
        request_tokens: result?.requestTokens,
        response_tokens: result?.responseTokens,
        total_tokens: result?.totalTokens,
        latency_ms: result?.latencyMs,
        success: result?.success,
        error: result?.error,
        text: result?.text,
        crisis_detected: result?.crisisDetected,
        crisis_type: result?.crisisType,
        confidence: result?.confidence,
        risk_level: result?.riskLevel,
        sensitivity_level: result?.sensitivityLevel,
        metadata: result?.metadata,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error storing crisis detection:', error)
      throw error
    }

    return data?.id
  }

  /**
   * Store a response generation result
   */
  async storeResponseGeneration(
    result: Omit<ResponseGenerationResult, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<string> {
    const { data, error } = await supabase
      .from('ai_response_generation')
      .insert({
        user_id: result?.userId,
        model_id: result?.modelId,
        model_provider: result?.modelProvider,
        request_tokens: result?.requestTokens,
        response_tokens: result?.responseTokens,
        total_tokens: result?.totalTokens,
        latency_ms: result?.latencyMs,
        success: result?.success,
        error: result?.error,
        prompt: result?.prompt,
        response: result?.response,
        context: result?.context,
        instructions: result?.instructions,
        temperature: result?.temperature,
        max_tokens: result?.maxTokens,
        metadata: result?.metadata,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error storing response generation:', error)
      throw error
    }

    return data?.id
  }

  /**
   * Store an intervention analysis result
   */
  async storeInterventionAnalysis(
    result: Omit<InterventionAnalysisResult, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<string> {
    if (!result?.userId || !result?.modelId || !result?.modelProvider) {
      throw new Error('Missing required fields')
    }

    const { data, error } = await supabase
      .from('ai_intervention_analysis')
      .insert({
        user_id: result?.userId,
        model_id: result?.modelId,
        model_provider: result?.modelProvider,
        request_tokens: result?.requestTokens ?? 0,
        response_tokens: result?.responseTokens ?? 0,
        total_tokens: result?.totalTokens ?? 0,
        latency_ms: result?.latencyMs ?? 0,
        success: result?.success ?? false,
        error: result?.error ?? null,
        conversation: result?.conversation,
        intervention: result?.intervention,
        user_response: result?.userResponse,
        effectiveness: result?.effectiveness,
        insights: result?.insights,
        recommended_follow_up: result?.recommendedFollowUp ?? null,
        metadata: result?.metadata ?? null,
      } as unknown as Database['public']['Tables']['ai_intervention_analysis']['Insert'])
      .select('id')
      .single()

    if (error) {
      console.error('Error storing intervention analysis:', error)
      throw error
    }

    return data?.id
  }

  /**
   * Update or create AI usage statistics
   */
  async updateUsageStats(stats: Omit<AIUsageStats, 'id'>): Promise<void> {
    const { error } = await supabase.from('ai_usage_stats').upsert(
      {
        user_id: stats.userId,
        period: stats.period,
        date: stats.date.toISOString().split('T')[0],
        total_requests: stats.totalRequests,
        total_tokens: stats.totalTokens,
        total_cost: stats.totalCost,
        model_usage: stats.modelUsage,
      },
      {
        onConflict: 'user_id, period, date',
      },
    )

    if (error) {
      console.error('Error updating AI usage stats:', error)
      throw error
    }
  }

  /**
   * Get sentiment analysis results for a user
   */
  async getSentimentAnalysisByUser(
    userId: string,
    limit = 10,
    offset = 0,
  ): Promise<SentimentAnalysisResult[]> {
    const { data, error } = await supabase
      .from('ai_sentiment_analysis')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error getting sentiment analysis:', error)
      throw error
    }

    return data?.map(
      (item: Database['public']['Tables']['ai_sentiment_analysis']['Row']) => ({
        id: item.id,
        userId: item.user_id,
        createdAt: new Date(item.created_at),
        updatedAt: new Date(item.updated_at),
        modelId: item.model_id,
        modelProvider: item.model_provider,
        requestTokens: item.request_tokens,
        responseTokens: item.response_tokens,
        totalTokens: item.total_tokens,
        latencyMs: item.latency_ms,
        success: item.success,
        error: item.error,
        text: item.text,
        sentiment: item.sentiment as 'positive' | 'negative' | 'neutral',
        score: item.score,
        confidence: item.confidence,
        metadata: item.metadata || {},
      }),
    )
  }

  /**
   * Get crisis detection results for a user
   */
  async getCrisisDetectionByUser(
    userId: string,
    limit = 10,
    offset = 0,
  ): Promise<CrisisDetectionResult[]> {
    const { data, error } = await supabase
      .from('ai_crisis_detection')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error getting crisis detection:', error)
      throw error
    }

    return data?.map(
      (item: Database['public']['Tables']['ai_crisis_detection']['Row']) => ({
        id: item.id,
        userId: item.user_id,
        createdAt: new Date(item.created_at),
        updatedAt: new Date(item.updated_at),
        modelId: item.model_id,
        modelProvider: item.model_provider,
        requestTokens: item.request_tokens,
        responseTokens: item.response_tokens,
        totalTokens: item.total_tokens,
        latencyMs: item.latency_ms,
        success: item.success,
        error: item.error,
        text: item.text,
        crisisDetected: item.crisis_detected,
        crisisType: item.crisis_type,
        confidence: item.confidence,
        riskLevel: item.risk_level as 'low' | 'medium' | 'high' | 'critical',
        sensitivityLevel: item.sensitivity_level,
        metadata: item.metadata || {},
      }),
    )
  }

  /**
   * Get response generation results for a user
   */
  async getResponseGenerationByUser(
    userId: string,
    limit = 10,
    offset = 0,
  ): Promise<ResponseGenerationResult[]> {
    const { data, error } = await supabase
      .from('ai_response_generation')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error getting response generation:', error)
      throw error
    }

    return data?.map(
      (
        item: Database['public']['Tables']['ai_response_generation']['Row'],
      ) => ({
        id: item.id,
        userId: item.user_id,
        createdAt: new Date(item.created_at),
        updatedAt: new Date(item.updated_at),
        modelId: item.model_id,
        modelProvider: item.model_provider,
        requestTokens: item.request_tokens,
        responseTokens: item.response_tokens,
        totalTokens: item.total_tokens,
        latencyMs: item.latency_ms,
        success: item.success,
        error: item.error,
        prompt: item.prompt,
        response: item.response,
        context: item.context,
        instructions: item.instructions,
        temperature: item.temperature,
        maxTokens: item.max_tokens,
        metadata: item.metadata || {},
      }),
    )
  }

  /**
   * Get intervention analysis results for a user
   */
  async getInterventionAnalysisByUser(
    userId: string,
    limit = 10,
    offset = 0,
  ): Promise<InterventionAnalysisResult[]> {
    const { data, error } = await supabase
      .from('ai_intervention_analysis')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error getting intervention analysis:', error)
      throw error
    }

    return data?.map(
      (
        item: Database['public']['Tables']['ai_intervention_analysis']['Row'],
      ) => ({
        id: item.id,
        userId: item.user_id,
        createdAt: new Date(item.created_at),
        updatedAt: new Date(item.updated_at),
        modelId: item.model_id,
        modelProvider: item.model_provider,
        requestTokens: item.request_tokens,
        responseTokens: item.response_tokens,
        totalTokens: item.total_tokens,
        latencyMs: item.latency_ms,
        success: item.success,
        error: item.error,
        conversation: item.conversation,
        intervention: item.intervention,
        userResponse: item.user_response,
        effectiveness: item.effectiveness,
        insights: item.insights,
        recommendedFollowUp: item.recommended_follow_up,
        metadata: item.metadata || {},
      }),
    )
  }

  /**
   * Get AI usage statistics for a user
   */
  async getUsageStatsByUser(
    userId: string,
    period: 'daily' | 'weekly' | 'monthly',
    limit = 30,
  ): Promise<AIUsageStats[]> {
    const { data, error } = await supabase
      .from('ai_usage_stats')
      .select('*')
      .eq('user_id', userId)
      .eq('period', period)
      .order('date', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error getting AI usage stats:', error)
      throw error
    }

    return data?.map(
      (item: Database['public']['Tables']['ai_usage_stats']['Row']) => ({
        userId: item.user_id,
        period: item.period as 'daily' | 'weekly' | 'monthly',
        date: new Date(item.date),
        totalRequests: item.total_requests,
        totalTokens: item.total_tokens,
        totalCost: item.total_cost,
        modelUsage: item.model_usage as Record<
          string,
          { requests: number; tokens: number; cost: number }
        >,
      }),
    )
  }

  /**
   * Get AI usage statistics for all users (admin only)
   */
  async getAllUsageStats(
    period: 'daily' | 'weekly' | 'monthly',
    limit = 30,
  ): Promise<AIUsageStats[]> {
    const { data, error } = await supabase
      .from('ai_usage_stats')
      .select('*')
      .eq('period', period)
      .order('date', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error getting all AI usage stats:', error)
      throw error
    }

    return data?.map(
      (item: Database['public']['Tables']['ai_usage_stats']['Row']) => ({
        userId: item.user_id,
        period: item.period as 'daily' | 'weekly' | 'monthly',
        date: new Date(item.date),
        totalRequests: item.total_requests,
        totalTokens: item.total_tokens,
        totalCost: item.total_cost,
        modelUsage: item.model_usage as Record<
          string,
          { requests: number; tokens: number; cost: number }
        >,
      }),
    )
  }

  /**
   * Get crisis detections with high risk level (admin only)
   */
  async getHighRiskCrisisDetections(
    limit = 20,
    offset = 0,
  ): Promise<CrisisDetectionResult[]> {
    const { data, error } = await supabase
      .from('ai_crisis_detection')
      .select('*')
      .in('risk_level', ['high', 'critical'])
      .eq('crisis_detected', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error getting high risk crisis detections:', error)
      throw error
    }

    return data?.map(
      (item: Database['public']['Tables']['ai_crisis_detection']['Row']) => ({
        id: item.id,
        userId: item.user_id,
        createdAt: new Date(item.created_at),
        updatedAt: new Date(item.updated_at),
        modelId: item.model_id,
        modelProvider: item.model_provider,
        requestTokens: item.request_tokens,
        responseTokens: item.response_tokens,
        totalTokens: item.total_tokens,
        latencyMs: item.latency_ms,
        success: item.success,
        error: item.error,
        text: item.text,
        crisisDetected: item.crisis_detected,
        crisisType: item.crisis_type,
        confidence: item.confidence,
        riskLevel: item.risk_level as 'low' | 'medium' | 'high' | 'critical',
        sensitivityLevel: item.sensitivity_level,
        metadata: item.metadata || {},
      }),
    )
  }

  /**
   * Get therapy sessions based on a filter
   *
   * @param filter The filter to apply
   * @returns Array of therapy sessions matching the filter
   */
  async getSessions(filter?: {
    clientId?: string
    therapistId?: string
    startDate?: Date
    endDate?: Date
    status?: string
  }): Promise<TherapySession[]> {
    let query = supabase.from('therapy_sessions').select('*')

    // Apply filters if they exist
    if (filter?.clientId) {
      query = query.eq('client_id', filter.clientId)
    }

    if (filter?.therapistId) {
      query = query.eq('therapist_id', filter.therapistId)
    }

    if (filter?.startDate) {
      query = query.gte('start_time', filter.startDate.toISOString())
    }

    if (filter?.endDate) {
      query = query.lte('end_time', filter.endDate.toISOString())
    }

    if (filter?.status) {
      query = query.eq('status', filter.status)
    }

    const { data, error } = await query.order('start_time', {
      ascending: false,
    })

    if (error) {
      console.error('Error retrieving therapy sessions:', error)
      throw error
    }

    // Map the database record to the TherapySession type
    return (data || []).map((session: TherapySessionRecord) => ({
      sessionId: session.id,
      clientId: session.client_id,
      therapistId: session.therapist_id,
      startTime: new Date(session.start_time),
      endTime: session.end_time ? new Date(session.end_time) : new Date(), // Provide default if undefined
      status: session.status as 'scheduled' | 'active' | 'completed' | 'cancelled',
      metadata: session.metadata,
    }))
  }

  /**
   * Get therapy sessions by their IDs
   *
   * @param sessionIds Array of session IDs to retrieve
   * @returns Array of therapy sessions matching the provided IDs
   */
  async getSessionsByIds(sessionIds: string[]): Promise<TherapySession[]> {
    if (!sessionIds.length) {
      return []
    }

    const { data, error } = await supabase
      .from('therapy_sessions')
      .select('*')
      .in('id', sessionIds)

    if (error) {
      console.error('Error retrieving therapy sessions by IDs:', error)
      throw error
    }

    // Map the database record to the TherapySession type
    return (data || []).map((session: TherapySessionRecord) => ({
      sessionId: session.id,
      clientId: session.client_id,
      therapistId: session.therapist_id,
      startTime: new Date(session.start_time),
      endTime: session.end_time ? new Date(session.end_time) : new Date(), // Provide default if undefined
      status: session.status as 'scheduled' | 'active' | 'completed' | 'cancelled',
      metadata: session.metadata,
    }))
  }

  /**
   * Get emotion analysis data for a specific session
   *
   * @param sessionId The session ID to get emotions for
   * @returns Array of emotion analysis data for the session
   */
  async getEmotionsForSession(sessionId: string): Promise<EmotionAnalysis[]> {
    const { data, error } = await supabase
      .from('ai_emotion_analyses')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true })

    if (error) {
      console.error('Error retrieving emotion analyses for session:', error)
      throw error
    }

    // Map the database record to the EmotionAnalysis type
    return (data || []).map((analysis: EmotionAnalysisRecord) => {
      let parsedEmotions: Emotion[] = []
      if (analysis.emotions && typeof analysis.emotions === 'object') {
        // Assuming analysis.emotions is an array of Emotion-like objects or can be cast directly.
        // This might need more robust parsing/validation depending on the actual DB structure.
        try {
          // If it's stored as a JSON string representing Emotion[]
          if (typeof analysis.emotions === 'string') {
            parsedEmotions = JSON.parse(analysis.emotions) as Emotion[]
          } else if (Array.isArray(analysis.emotions)) {
            // If it's already an array (e.g. from Supabase auto-parsing JSONB)
            parsedEmotions = analysis.emotions.map((e) => ({
              ...e,
              timestamp: new Date(e.timestamp), // Ensure timestamp is a Date object
            })) as Emotion[]
          } else {
            // If it's a single object or other structure, this will fail or needs specific handling
            // For now, attempt a direct cast, which is risky.
            // A better approach would be a validation/transformation function.
            parsedEmotions = analysis.emotions as unknown as Emotion[]
          }
        } catch (e) {
          console.error('Failed to parse emotions:', e, analysis.emotions)
          parsedEmotions = [] // Default to empty array on error
        }
      }

      let _parsedRiskFactors: RiskFactor[] | undefined = undefined
      if (analysis.risk_factors) {
        if (typeof analysis.risk_factors === 'string') {
          try {
            _parsedRiskFactors = JSON.parse(
              analysis.risk_factors,
            ) as RiskFactor[]
          } catch (e) {
            console.error(
              'Failed to parse risk_factors:',
              e,
              analysis.risk_factors,
            )
          }
        } else if (Array.isArray(analysis.risk_factors)) {
          _parsedRiskFactors = analysis.risk_factors as RiskFactor[] // Assuming it's already correctly typed
        }
      }

      return {
        id: analysis.id,
        sessionId: sessionId, // Use the sessionId parameter
        timestamp: analysis.timestamp,
        emotions: parsedEmotions.reduce((acc, emotion) => {
          acc[emotion.type as keyof typeof acc] = emotion.intensity;
          return acc;
        }, {
          joy: 0, sadness: 0, anger: 0, fear: 0,
          surprise: 0, disgust: 0, trust: 0, anticipation: 0
        }),
        dimensions: {
          valence: 0, // Default values, should be calculated from emotions
          arousal: 0,
          dominance: 0
        },
        confidence: parsedEmotions.length > 0 ? 
          parsedEmotions.reduce((sum, e) => sum + e.confidence, 0) / parsedEmotions.length : 0,
        metadata: {
          source: 'text' as const,
          processingTime: 0,
          modelVersion: 'v1',
          confidence: {
            overall: parsedEmotions.length > 0 ? 
              parsedEmotions.reduce((sum, e) => sum + e.confidence, 0) / parsedEmotions.length : 0,
            perEmotion: parsedEmotions.reduce((acc, emotion) => {
              acc[emotion.type as keyof typeof acc] = emotion.confidence;
              return acc;
            }, {
              joy: 0, sadness: 0, anger: 0, fear: 0,
              surprise: 0, disgust: 0, trust: 0, anticipation: 0
            })
          }
        }
      } as EmotionAnalysis
    })
  }

  /**
   * Check if a therapist is associated with a client
   *
   * @param therapistId The therapist ID to check
   * @param clientId The client ID to check against
   * @returns Boolean indicating if the therapist is associated with the client
   */
  async isTherapistForClient(
    therapistId: string,
    clientId: string,
  ): Promise<boolean> {
    try {
      // Check therapy_client_relationships table
      const { data, error } = await supabase
        .from('therapy_client_relationships')
        .select('*')
        .eq('therapist_id', therapistId)
        .eq('client_id', clientId)
        .limit(1)

      if (error) {
        console.error('Error checking therapist-client relationship:', error)
        throw error
      }

      // If we found at least one relationship record, the therapist is associated with the client
      return data && data.length > 0
    } catch (error) {
      console.error('Error checking therapist-client relationship:', error)
      throw error
    }
  }

  /**
   * Store efficacy feedback for a recommendation
   */
  async storeEfficacyFeedback(feedback: EfficacyFeedback): Promise<void> {
    const { error } = await supabase.from('ai_efficacy_feedback').insert({
      recommendation_id: feedback.recommendationId,
      client_id: feedback.clientId,
      technique_id: feedback.techniqueId,
      efficacy_rating: feedback.efficacyRating,
      timestamp:
        feedback.timestamp instanceof Date
          ? feedback.timestamp.toISOString()
          : feedback.timestamp,
      feedback: feedback.feedback,
      session_id: feedback.sessionId,
      therapist_id: feedback.therapistId,
      context: feedback.context,
    })

    if (error) {
      console.error('Error storing efficacy feedback:', error)
      throw error
    }
  }

  /**
   * Get technique by ID
   */
  async getTechniqueById(techniqueId: string): Promise<Technique | null> {
    const { data, error } = await supabase
      .from('ai_therapeutic_techniques')
      .select('*')
      .eq('id', techniqueId)
      .single()

    if (error) {
      console.error('Error getting technique by ID:', error)
      throw error
    }

    return data
  }

  /**
   * Get efficacy feedback for a technique
   */
  async getEfficacyFeedbackForTechnique(
    techniqueId: string,
  ): Promise<EfficacyFeedback[]> {
    const { data, error } = await supabase
      .from('ai_efficacy_feedback')
      .select('*')
      .eq('technique_id', techniqueId)

    if (error) {
      console.error('Error getting efficacy feedback for technique:', error)
      throw error
    }

    return (data || []).map((item: EfficacyFeedbackRecord) => ({
      recommendationId: item.recommendation_id,
      clientId: item.client_id,
      techniqueId: item.technique_id,
      efficacyRating: item.efficacy_rating,
      timestamp: new Date(item.timestamp),
      feedback: item.feedback,
      sessionId: item.session_id,
      therapistId: item.therapist_id,
      context: item.context,
    }))
  }

  /**
   * Get efficacy feedback for a client
   */
  async getEfficacyFeedbackForClient(
    clientId: string,
  ): Promise<EfficacyFeedback[]> {
    const { data, error } = await supabase
      .from('ai_efficacy_feedback')
      .select('*')
      .eq('client_id', clientId)

    if (error) {
      console.error('Error getting efficacy feedback for client:', error)
      throw error
    }

    return (data || []).map((item: EfficacyFeedbackRecord) => ({
      recommendationId: item.recommendation_id,
      clientId: item.client_id,
      techniqueId: item.technique_id,
      efficacyRating: item.efficacy_rating,
      timestamp: new Date(item.timestamp),
      feedback: item.feedback,
      sessionId: item.session_id,
      therapistId: item.therapist_id,
      context: item.context,
    }))
  }

  /**
   * Get techniques for a specific indication
   */
  async getTechniquesForIndication(indication: string): Promise<Technique[]> {
    const { data, error } = await supabase
      .from('techniques')
      .select('*')
      .contains('indications', [indication])

    if (error) {
      console.error('Error fetching techniques by indication:', error)
      return []
    }
    return data || []
  }

  /**
   * Get a client's profile, including preferences, characteristics, and technique history.
   * Assumes existence of 'client_profiles' and 'client_technique_history' tables.
   */
  async getClientProfile(clientId: string): Promise<ClientProfile | null> {
    // Step 1: Fetch main profile data from 'client_profiles'
    const { data: profileData, error: profileError } = await supabase
      .from('client_profiles')
      .select('preferences, characteristics, demographic')
      .eq('client_id', clientId)
      .single()

    if (profileError) {
      if (profileError.code === 'PGRST116') {
        // PostgREST error code for "Searched for one row but found 0 rows"
        // This means the client profile does not exist, which is a valid case.
        console.log(`No client profile found for clientId: ${clientId}`)
        return null
      }
      console.error(
        `Error fetching client profile for clientId ${clientId}:`,
        profileError,
      )
      throw profileError
    }

    // If profileData is null but no error (should not happen with .single() if no record is PGRST116)
    // but as a safeguard, or if a profile exists but is completely empty (all nulls).
    if (!profileData) {
      console.log(
        `Client profile data is unexpectedly null for clientId: ${clientId}, though no explicit error was thrown.`,
      )
      return null
    }

    // Step 2: Fetch technique history from 'client_technique_history'
    const { data: techniqueHistoryData, error: historyError } = await supabase
      .from('client_technique_history')
      .select(
        'technique_id, technique_name, last_used_at, efficacy_rating, usage_count',
      )
      .eq('client_id', clientId)
      .order('last_used_at', { ascending: false })

    if (historyError) {
      console.error(
        `Error fetching technique history for clientId ${clientId}:`,
        historyError,
      )
      // We might still return the profile data even if history fetching fails,
      // or throw, depending on requirements. For now, let's return profile with empty/no history.
      // Or, if history is critical, re-throw: throw historyError;
    }

    const pastTechniques =
      techniqueHistoryData?.map((item: ClientTechniqueHistoryItem) => ({
        techniqueId: item.technique_id,
        techniqueName: item.technique_name,
        lastUsed: new Date(item.last_used_at),
        efficacy: item.efficacy_rating, // Assuming efficacy_rating is a number
        usageCount: item.usage_count,
      })) || []

    // Step 3: Combine into ClientProfile structure
    // The profileData itself can be partial according to ClientProfile interface (e.g. preferences can be undefined)
    const clientProfile: ClientProfile = {
      preferences: profileData.preferences ?? undefined,
      characteristics: profileData.characteristics ?? undefined,
      demographic: profileData.demographic ?? undefined,
      history: {
        pastTechniques,
      },
    }

    // If all parts of the profile are essentially empty after fetching,
    // we might consider this as 'no profile' as well, depending on desired behavior.
    // For now, returning the structured profile even if its fields are undefined/empty arrays.
    // A profile exists if the 'client_profiles' row for clientId exists.

    return clientProfile
  }

  /**
   * Store a bias analysis result
   */
  async storeBiasAnalysis(result: {
    sessionId: string
    userId?: string
    overallBiasScore: number
    alertLevel: 'low' | 'medium' | 'high' | 'critical'
    confidenceScore: number
    layerResults: Record<string, unknown>
    demographics?: Record<string, unknown>
    demographicGroups?: Record<string, unknown>
    recommendations?: string[]
    explanation?: string
    latencyMs?: number
    modelId?: string
    modelProvider?: string
    metadata?: Record<string, unknown>
  }): Promise<string> {
    const { data, error } = await supabase
      .from('ai_bias_analysis')
      .insert({
        session_id: result.sessionId,
        user_id: result.userId || null,
        overall_bias_score: result.overallBiasScore,
        alert_level: result.alertLevel,
        confidence_score: result.confidenceScore,
        layer_results: result.layerResults,
        demographics: result.demographics || null,
        demographic_groups: result.demographicGroups || null,
        recommendations: result.recommendations || [],
        explanation: result.explanation || null,
        latency_ms: result.latencyMs || 0,
        model_id: result.modelId || 'bias-detection-v1',
        model_provider: result.modelProvider || 'internal',
        success: true,
        metadata: result.metadata || {},
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error storing bias analysis:', error)
      throw error
    }

    return data?.id
  }

  /**
   * Get bias analysis result by session ID
   */
  async getBiasAnalysisBySession(sessionId: string): Promise<BiasAnalysisResult | null> {
    const { data, error } = await supabase
      .from('ai_bias_analysis')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return null
      }
      console.error('Error getting bias analysis:', error)
      throw error
    }

    return data
      ? {
          id: data.id,
          sessionId: data.session_id,
          userId: data.user_id,
          createdAt: new Date(data.created_at),
          updatedAt: new Date(data.updated_at),
          overallBiasScore: data.overall_bias_score,
          alertLevel: data.alert_level,
          confidenceScore: data.confidence_score,
          layerResults: data.layer_results,
          demographics: data.demographics,
          demographicGroups: data.demographic_groups,
          recommendations: data.recommendations,
          explanation: data.explanation,
          latencyMs: data.latency_ms,
          modelId: data.model_id,
          modelProvider: data.model_provider,
          metadata: data.metadata || {},
        }
      : null
  }

  /**
   * Get bias analysis results for a user
   */
  async getBiasAnalysisByUser(
    userId: string,
    options?: {
      limit?: number
      offset?: number
      alertLevel?: string[]
      timeRange?: { start: Date; end: Date }
    },
  ): Promise<BiasAnalysisResult[]> {
    let query = supabase
      .from('ai_bias_analysis')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (options?.alertLevel) {
      query = query.in('alert_level', options.alertLevel)
    }

    if (options?.timeRange) {
      query = query
        .gte('created_at', options.timeRange.start.toISOString())
        .lte('created_at', options.timeRange.end.toISOString())
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    if (options?.offset) {
      query = query.range(
        options.offset,
        options.offset + (options.limit || 10) - 1,
      )
    }

    const { data, error } = await query

    if (error) {
      console.error('Error getting bias analysis by user:', error)
      throw error
    }

    return (
      data?.map((item) => ({
        id: item.id,
        sessionId: item.session_id,
        userId: item.user_id,
        createdAt: new Date(item.created_at),
        updatedAt: new Date(item.updated_at),
        overallBiasScore: item.overall_bias_score,
        alertLevel: item.alert_level,
        confidenceScore: item.confidence_score,
        layerResults: item.layer_results,
        demographics: item.demographics,
        demographicGroups: item.demographic_groups,
        recommendations: item.recommendations,
        explanation: item.explanation,
        latencyMs: item.latency_ms,
        modelId: item.model_id,
        modelProvider: item.model_provider,
        metadata: item.metadata || {},
      })) || []
    )
  }

  /**
   * Store bias metric
   */
  async storeBiasMetric(metric: {
    metricType:
      | 'bias_score'
      | 'alert_level'
      | 'analysis_type'
      | 'response_time'
      | 'demographic'
      | 'performance'
    metricName: string
    metricValue: number
    sessionId?: string
    userId?: string
    timestamp: Date
    aggregationPeriod?: 'hourly' | 'daily' | 'weekly' | 'monthly'
    metadata?: Record<string, unknown>
  }): Promise<string> {
    const { data, error } = await supabase
      .from('ai_bias_metrics')
      .insert({
        metric_type: metric.metricType,
        metric_name: metric.metricName,
        metric_value: metric.metricValue,
        session_id: metric.sessionId || null,
        user_id: metric.userId || null,
        timestamp: metric.timestamp.toISOString(),
        aggregation_period: metric.aggregationPeriod || null,
        metadata: metric.metadata || {},
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error storing bias metric:', error)
      throw error
    }

    return data?.id
  }

  /**
   * Get bias metrics
   */
  async getBiasMetrics(options?: {
    metricType?: string[]
    metricName?: string[]
    timeRange?: { start: Date; end: Date }
    aggregationPeriod?: string
    userId?: string
    limit?: number
  }): Promise<BiasMetric[]> {
    let query = supabase
      .from('ai_bias_metrics')
      .select('*')
      .order('timestamp', { ascending: false })

    if (options?.metricType) {
      query = query.in('metric_type', options.metricType)
    }

    if (options?.metricName) {
      query = query.in('metric_name', options.metricName)
    }

    if (options?.aggregationPeriod) {
      query = query.eq('aggregation_period', options.aggregationPeriod)
    }

    if (options?.userId) {
      query = query.eq('user_id', options.userId)
    }

    if (options?.timeRange) {
      query = query
        .gte('timestamp', options.timeRange.start.toISOString())
        .lte('timestamp', options.timeRange.end.toISOString())
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error getting bias metrics:', error)
      throw error
    }

    return (
      data?.map((item) => ({
        id: item.id,
        metricType: item.metric_type,
        metricName: item.metric_name,
        metricValue: item.metric_value,
        sessionId: item.session_id,
        userId: item.user_id,
        timestamp: new Date(item.timestamp),
        aggregationPeriod: item.aggregation_period,
        metadata: item.metadata || {},
        createdAt: new Date(item.created_at),
      })) || []
    )
  }

  /**
   * Store bias alert
   */
  async storeBiasAlert(alert: {
    alertId: string
    sessionId?: string
    userId?: string
    alertType: 'bias' | 'system' | 'performance' | 'threshold'
    alertLevel: 'low' | 'medium' | 'high' | 'critical'
    message: string
    details: Record<string, unknown>
    notificationChannels?: string[]
  }): Promise<string> {
    const { data, error } = await supabase
      .from('ai_bias_alerts')
      .insert({
        alert_id: alert.alertId,
        session_id: alert.sessionId || null,
        user_id: alert.userId || null,
        alert_type: alert.alertType,
        alert_level: alert.alertLevel,
        message: alert.message,
        details: alert.details,
        notification_channels: alert.notificationChannels || [],
        actions: [],
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error storing bias alert:', error)
      throw error
    }

    return data?.id
  }

  /**
   * Get bias alerts
   */
  async getBiasAlerts(options?: {
    alertLevel?: string[]
    alertType?: string[]
    timeRange?: { start: Date; end: Date }
    acknowledgedOnly?: boolean
    unresolvedOnly?: boolean
    userId?: string
    limit?: number
    offset?: number
  }): Promise<BiasAlert[]> {
    let query = supabase
      .from('ai_bias_alerts')
      .select('*')
      .order('created_at', { ascending: false })

    if (options?.alertLevel) {
      query = query.in('alert_level', options.alertLevel)
    }

    if (options?.alertType) {
      query = query.in('alert_type', options.alertType)
    }

    if (options?.acknowledgedOnly) {
      query = query.eq('acknowledged', true)
    }

    if (options?.unresolvedOnly) {
      query = query.eq('resolved', false)
    }

    if (options?.userId) {
      query = query.eq('user_id', options.userId)
    }

    if (options?.timeRange) {
      query = query
        .gte('created_at', options.timeRange.start.toISOString())
        .lte('created_at', options.timeRange.end.toISOString())
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    if (options?.offset) {
      query = query.range(
        options.offset,
        options.offset + (options.limit || 10) - 1,
      )
    }

    const { data, error } = await query

    if (error) {
      console.error('Error getting bias alerts:', error)
      throw error
    }

    return (
      data?.map((item) => ({
        id: item.id,
        alertId: item.alert_id,
        sessionId: item.session_id,
        userId: item.user_id,
        createdAt: new Date(item.created_at),
        updatedAt: new Date(item.updated_at),
        alertType: item.alert_type,
        alertLevel: item.alert_level,
        message: item.message,
        details: item.details,
        acknowledged: item.acknowledged,
        acknowledgedBy: item.acknowledged_by,
        acknowledgedAt: item.acknowledged_at
          ? new Date(item.acknowledged_at)
          : null,
        resolved: item.resolved,
        resolvedBy: item.resolved_by,
        resolvedAt: item.resolved_at ? new Date(item.resolved_at) : null,
        actions: item.actions || [],
        notificationChannels: item.notification_channels || [],
        escalated: item.escalated,
        escalatedAt: item.escalated_at ? new Date(item.escalated_at) : null,
      })) || []
    )
  }

  /**
   * Update bias alert status
   */
  async updateBiasAlert(
    alertId: string,
    updates: {
      acknowledged?: boolean
      acknowledgedBy?: string
      resolved?: boolean
      resolvedBy?: string
      escalated?: boolean
      actions?: AlertAction[]
    },
  ): Promise<boolean> {
    const updateData: AlertUpdateData = {}

    if (updates.acknowledged !== undefined) {
      updateData.acknowledged = updates.acknowledged
      updateData.acknowledged_at = updates.acknowledged
        ? new Date().toISOString()
        : null
      if (updates.acknowledgedBy) {
        updateData.acknowledged_by = updates.acknowledgedBy
      }
    }

    if (updates.resolved !== undefined) {
      updateData.resolved = updates.resolved
      updateData.resolved_at = updates.resolved
        ? new Date().toISOString()
        : null
      if (updates.resolvedBy) {
        updateData.resolved_by = updates.resolvedBy
      }
    }

    if (updates.escalated !== undefined) {
      updateData.escalated = updates.escalated
      updateData.escalated_at = updates.escalated
        ? new Date().toISOString()
        : null
    }

    if (updates.actions) {
      updateData.actions = updates.actions
    }

    const { error } = await supabase
      .from('ai_bias_alerts')
      .update(updateData)
      .eq('alert_id', alertId)

    if (error) {
      console.error('Error updating bias alert:', error)
      return false
    }

    return true
  }

  /**
   * Store bias report
   */
  async storeBiasReport(report: {
    reportId: string
    userId?: string
    title: string
    description?: string
    timeRangeStart: Date
    timeRangeEnd: Date
    sessionCount: number
    format: 'json' | 'pdf' | 'html' | 'csv'
    overallFairnessScore?: number
    averageBiasScore?: number
    alertDistribution?: BiasAlertDistribution
    aggregatedMetrics?: BiasAggregatedMetrics
    trendAnalysis?: BiasTrendAnalysis
    customAnalysis?: BiasCustomAnalysis
    recommendations?: BiasRecommendations
    executionTimeMs?: number
    filePath?: string
    expiresAt?: Date
    metadata?: Record<string, unknown>
  }): Promise<string> {
    const { data, error } = await supabase
      .from('ai_bias_reports')
      .insert({
        report_id: report.reportId,
        user_id: report.userId || null,
        title: report.title,
        description: report.description || null,
        time_range_start: report.timeRangeStart.toISOString(),
        time_range_end: report.timeRangeEnd.toISOString(),
        session_count: report.sessionCount,
        format: report.format,
        overall_fairness_score: report.overallFairnessScore || null,
        average_bias_score: report.averageBiasScore || null,
        alert_distribution: report.alertDistribution || null,
        aggregated_metrics: report.aggregatedMetrics || null,
        trend_analysis: report.trendAnalysis || null,
        custom_analysis: report.customAnalysis || null,
        recommendations: report.recommendations || null,
        execution_time_ms: report.executionTimeMs || 0,
        file_path: report.filePath || null,
        expires_at: report.expiresAt?.toISOString() || null,
        metadata: report.metadata || {},
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error storing bias report:', error)
      throw error
    }

    return data?.id
  }

  /**
   * Get bias report by report ID
   */
  async getBiasReport(reportId: string): Promise<BiasReport | null> {
    const { data, error } = await supabase
      .from('ai_bias_reports')
      .select('*')
      .eq('report_id', reportId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return null
      }
      console.error('Error getting bias report:', error)
      throw error
    }

    return data
      ? {
          id: data.id,
          reportId: data.report_id,
          userId: data.user_id,
          createdAt: new Date(data.created_at),
          updatedAt: new Date(data.updated_at),
          title: data.title,
          description: data.description,
          timeRangeStart: new Date(data.time_range_start),
          timeRangeEnd: new Date(data.time_range_end),
          sessionCount: data.session_count,
          format: data.format,
          overallFairnessScore: data.overall_fairness_score,
          averageBiasScore: data.average_bias_score,
          alertDistribution: data.alert_distribution,
          aggregatedMetrics: data.aggregated_metrics,
          trendAnalysis: data.trend_analysis,
          customAnalysis: data.custom_analysis,
          recommendations: data.recommendations,
          executionTimeMs: data.execution_time_ms,
          filePath: data.file_path,
          expiresAt: data.expires_at ? new Date(data.expires_at) : null,
          metadata: data.metadata || {},
        }
      : null
  }

  /**
   * Get bias reports for a user
   */
  async getBiasReportsByUser(
    userId: string,
    options?: {
      limit?: number
      offset?: number
      format?: string[]
      timeRange?: { start: Date; end: Date }
    },
  ): Promise<BiasReport[]> {
    let query = supabase
      .from('ai_bias_reports')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (options?.format) {
      query = query.in('format', options.format)
    }

    if (options?.timeRange) {
      query = query
        .gte('created_at', options.timeRange.start.toISOString())
        .lte('created_at', options.timeRange.end.toISOString())
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    if (options?.offset) {
      query = query.range(
        options.offset,
        options.offset + (options.limit || 10) - 1,
      )
    }

    const { data, error } = await query

    if (error) {
      console.error('Error getting bias reports by user:', error)
      throw error
    }

    return (
      data?.map((item) => ({
        id: item.id,
        reportId: item.report_id,
        userId: item.user_id,
        createdAt: new Date(item.created_at),
        updatedAt: new Date(item.updated_at),
        title: item.title,
        description: item.description,
        timeRangeStart: new Date(item.time_range_start),
        timeRangeEnd: new Date(item.time_range_end),
        sessionCount: item.session_count,
        format: item.format,
        overallFairnessScore: item.overall_fairness_score,
        averageBiasScore: item.average_bias_score,
        alertDistribution: item.alert_distribution,
        aggregatedMetrics: item.aggregated_metrics,
        trendAnalysis: item.trend_analysis,
        customAnalysis: item.custom_analysis,
        recommendations: item.recommendations,
        executionTimeMs: item.execution_time_ms,
        filePath: item.file_path,
        expiresAt: item.expires_at ? new Date(item.expires_at) : null,
        metadata: item.metadata || {},
      })) || []
    )
  }

  /**
   * Get bias analysis summary statistics
   */
  async getBiasAnalysisSummary(options?: {
    timeRange?: { start: Date; end: Date }
    userId?: string
  }): Promise<{
    totalAnalyses: number
    averageBiasScore: number
    alertDistribution: Record<string, number>
    dailyTrends: Array<{ date: string; count: number; avgBias: number }>
  }> {
    // Use the materialized view for better performance
    let query = supabase.from('bias_analysis_summary').select('*')

    if (options?.timeRange) {
      query = query
        .gte(
          'analysis_date',
          options.timeRange.start.toISOString().split('T')[0],
        )
        .lte('analysis_date', options.timeRange.end.toISOString().split('T')[0])
    }

    const { data: summaryData, error: summaryError } = await query

    if (summaryError) {
      console.error('Error getting bias analysis summary:', summaryError)
      throw summaryError
    }

    // Calculate totals from summary data
    const totalAnalyses =
      summaryData?.reduce((sum, row) => sum + row.analysis_count, 0) || 0
    const avgBiasWeighted =
      summaryData?.reduce(
        (sum, row) => sum + row.avg_bias_score * row.analysis_count,
        0,
      ) || 0
    const averageBiasScore =
      totalAnalyses > 0 ? avgBiasWeighted / totalAnalyses : 0

    // Group by alert level
    const alertDistribution: Record<string, number> = {}
    summaryData?.forEach((row) => {
      alertDistribution[row.alert_level] =
        (alertDistribution[row.alert_level] || 0) + row.analysis_count
    })

    // Group by date for trends
    interface DailyTrendData {
      date: string
      count: number
      totalBias: number
      analyses: number
    }

    const dailyTrends = Object.values(
      summaryData?.reduce((acc: Record<string, DailyTrendData>, row) => {
        const date = row.analysis_date.split('T')[0]
        if (!acc[date]) {
          acc[date] = { date, count: 0, totalBias: 0, analyses: 0 }
        }
        acc[date].count += row.analysis_count
        acc[date].totalBias += row.avg_bias_score * row.analysis_count
        acc[date].analyses += row.analysis_count
        return acc
      }, {}) || {},
    ).map((item: DailyTrendData) => ({
      date: item.date,
      count: item.count,
      avgBias: item.analyses > 0 ? item.totalBias / item.analyses : 0,
    }))

    return {
      totalAnalyses,
      averageBiasScore: Math.round(averageBiasScore * 1000) / 1000,
      alertDistribution,
      dailyTrends,
    }
  }
}