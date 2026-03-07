import type {
  AIUsageStats,
  CrisisDetectionResult,
  InterventionAnalysisResult,
  ResponseGenerationResult,
  SentimentAnalysisResult,
} from './types'
import type { TherapySession } from '../../ai/models/ai-types'
import type { EmotionAnalysis } from '../../ai/emotions/types'
let mongodb: unknown
let ObjectId: unknown

if (typeof window === 'undefined') {
  // Server side - import real MongoDB dependencies
  ;(async () => {
    try {
      const configModule = await import('../../../config/mongodb.config')
      mongodb = configModule.default
      const mongodbLib = await import('mongodb')
      ObjectId = mongodbLib.ObjectId
    } catch {
      // Fallback if MongoDB is not available
      mongodb = null
      ObjectId = class MockObjectId {
        id: string
        constructor(id?: string) {
          this.id = id || 'mock-object-id'
        }
        toString() {
          return this.id
        }
        toHexString() {
          return this.id
        }
      }
    }
  })()
} else {
  // Client side - use mocks
  mongodb = null
  ObjectId = class MockObjectId {
    id: string
    constructor(id?: string) {
      this.id = id || 'mock-object-id'
    }
    toString() {
      return this.id
    }
    toHexString() {
      return this.id
    }
  }
}
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
  private async getDatabase() {
    if (!mongodb) {
      throw new Error('MongoDB not available on client side')
    }

    try {
      return mongodb.getDb()
    } catch {
      // If not connected, try to connect
      await mongodb.connect()
      return mongodb.getDb()
    }
  }

  /**
   * Store a sentiment analysis result
   */
  async storeSentimentAnalysis(
    result: Omit<SentimentAnalysisResult, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<string> {
    const db = await this.getDatabase()
    const documentToInsert = {
      ...result,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const { insertedId } = await db
      .collection('ai_sentiment_analysis')
      .insertOne(documentToInsert)
    return insertedId.toHexString()
  }

  /**
   * Store a crisis detection result
   */
  async storeCrisisDetection(
    result: Omit<CrisisDetectionResult, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<string> {
    const db = await this.getDatabase()
    const documentToInsert = {
      ...result,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const { insertedId } = await db
      .collection('ai_crisis_detection')
      .insertOne(documentToInsert)
    return insertedId.toHexString()
  }

  /**
   * Store a response generation result
   */
  async storeResponseGeneration(
    result: Omit<ResponseGenerationResult, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<string> {
    const db = await this.getDatabase()
    const documentToInsert = {
      ...result,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const { insertedId } = await db
      .collection('ai_response_generation')
      .insertOne(documentToInsert)
    return insertedId.toHexString()
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

    const db = await this.getDatabase()
    const documentToInsert = {
      ...result,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const { insertedId } = await db
      .collection('ai_intervention_analysis')
      .insertOne(documentToInsert)
    return insertedId.toHexString()
  }

  /**
   * Update or create AI usage statistics
   */
  async updateUsageStats(stats: Omit<AIUsageStats, 'id'>): Promise<void> {
    const db = await this.getDatabase()
    await db.collection('ai_usage_stats').updateOne(
      {
        userId: stats.userId,
        period: stats.period,
        date: stats.date,
      },
      { $set: stats },
      { upsert: true },
    )
  }

  /**
   * Get sentiment analysis results for a user
   */
  async getSentimentAnalysisByUser(
    userId: string,
    limit = 10,
    offset = 0,
  ): Promise<SentimentAnalysisResult[]> {
    const db = await this.getDatabase()
    const results = await db
      .collection('ai_sentiment_analysis')
      .find({ userId })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray()

    return results.map((doc) => ({
      ...doc,
      id: doc._id.toHexString(),
    })) as unknown as SentimentAnalysisResult[]
  }

  /**
   * Get crisis detection results for a user
   */
  async getCrisisDetectionByUser(
    userId: string,
    limit = 10,
    offset = 0,
  ): Promise<CrisisDetectionResult[]> {
    const db = await this.getDatabase()
    const results = await db
      .collection('ai_crisis_detection')
      .find({ userId })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray()

    return results.map((doc) => ({
      ...doc,
      id: doc._id.toHexString(),
    })) as unknown as CrisisDetectionResult[]
  }

  /**
   * Get response generation results for a user
   */
  async getResponseGenerationByUser(
    userId: string,
    limit = 10,
    offset = 0,
  ): Promise<ResponseGenerationResult[]> {
    const db = await this.getDatabase()
    const results = await db
      .collection('ai_response_generation')
      .find({ userId })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray()

    return results.map((doc) => ({
      ...doc,
      id: doc._id.toHexString(),
    })) as unknown as ResponseGenerationResult[]
  }

  /**
   * Get intervention analysis results for a user
   */
  async getInterventionAnalysisByUser(
    userId: string,
    limit = 10,
    offset = 0,
  ): Promise<InterventionAnalysisResult[]> {
    const db = await this.getDatabase()
    const results = await db
      .collection('ai_intervention_analysis')
      .find({ userId })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray()

    return results.map((doc) => ({
      ...doc,
      id: doc._id.toHexString(),
    })) as unknown as InterventionAnalysisResult[]
  }

  /**
   * Get AI usage statistics for a user
   */
  async getUsageStatsByUser(
    userId: string,
    period: 'daily' | 'weekly' | 'monthly',
    limit = 30,
  ): Promise<AIUsageStats[]> {
    const db = await this.getDatabase()
    const results = await db
      .collection('ai_usage_stats')
      .find({ userId, period })
      .sort({ date: -1 })
      .limit(limit)
      .toArray()

    return results.map((doc) => ({
      ...doc,
      id: doc._id?.toHexString(),
    })) as unknown as AIUsageStats[]
  }

  /**
   * Get AI usage statistics for all users (admin only)
   */
  async getAllUsageStats(
    period: 'daily' | 'weekly' | 'monthly',
    limit = 30,
  ): Promise<AIUsageStats[]> {
    const db = await this.getDatabase()
    const results = await db
      .collection('ai_usage_stats')
      .find({ period })
      .sort({ date: -1 })
      .limit(limit)
      .toArray()

    return results.map((doc) => ({
      ...doc,
      id: doc._id?.toHexString(),
    })) as unknown as AIUsageStats[]
  }

  /**
   * Get crisis detections with high risk level (admin only)
   */
  async getHighRiskCrisisDetections(
    limit = 20,
    offset = 0,
  ): Promise<CrisisDetectionResult[]> {
    const db = await this.getDatabase()
    const results = await db
      .collection('ai_crisis_detection')
      .find({
        riskLevel: { $in: ['high', 'critical'] },
        crisisDetected: true,
      })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray()

    return results.map((doc) => ({
      ...doc,
      id: doc._id.toHexString(),
    })) as unknown as CrisisDetectionResult[]
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
    const db = await this.getDatabase()
    const query: Record<string, unknown> = {}

    if (filter?.clientId) {
      query.clientId = filter.clientId
    }
    if (filter?.therapistId) {
      query.therapistId = filter.therapistId
    }
    if (filter?.startDate) {
      query.startTime = { $gte: filter.startDate }
    }
    if (filter?.endDate) {
      query.endTime = { $lte: filter.endDate }
    }
    if (filter?.status) {
      query.status = filter.status
    }

    const results = await db
      .collection('therapy_sessions')
      .find(query)
      .sort({ startTime: -1 })
      .toArray()

    return results.map((doc) => ({
      ...doc,
      id: doc._id?.toHexString(),
    })) as unknown as TherapySession[]
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

    const db = await this.getDatabase()
    const objectIds = sessionIds
      .map((id) => {
        try {
          return new ObjectId(id)
        } catch {
          // If not a valid ObjectId, search by string ID
          return null
        }
      })
      .filter(Boolean) as ObjectId[]

    const results = await db
      .collection('therapy_sessions')
      .find({ _id: { $in: objectIds } })
      .toArray()

    return results.map((doc) => ({
      ...doc,
      id: doc._id?.toHexString(),
    })) as unknown as TherapySession[]
  }

  /**
   * Get emotion analysis data for a specific session
   *
   * @param sessionId The session ID to get emotions for
   * @returns Array of emotion analysis data for the session
   */
  async getEmotionsForSession(sessionId: string): Promise<EmotionAnalysis[]> {
    const db = await this.getDatabase()
    const results = await db
      .collection('ai_emotion_analyses')
      .find({ sessionId })
      .sort({ timestamp: 1 })
      .toArray()

    return results.map((doc) => ({
      ...doc,
      id: doc._id?.toHexString(),
    })) as unknown as EmotionAnalysis[]
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
    const db = await this.getDatabase()
    const relationship = await db
      .collection('therapy_client_relationships')
      .findOne({ therapistId, clientId })
    return !!relationship
  }

  /**
   * Store efficacy feedback for a recommendation
   */
  async storeEfficacyFeedback(feedback: EfficacyFeedback): Promise<void> {
    const db = await this.getDatabase()
    await db.collection('ai_efficacy_feedback').insertOne(feedback)
  }

  /**
   * Get technique by ID
   */
  async getTechniqueById(techniqueId: string): Promise<Technique | null> {
    const db = await this.getDatabase()
    let query: Record<string, unknown>

    try {
      // Try to use as ObjectId first
      query = { _id: new ObjectId(techniqueId) }
    } catch {
      // If not a valid ObjectId, use as string
      query = { _id: techniqueId }
    }

    const result = await db
      .collection('ai_therapeutic_techniques')
      .findOne(query)

    if (!result) {
      return null
    }

    return {
      ...result,
      id: result._id?.toHexString() || result._id,
    } as unknown as Technique
  }

  /**
   * Get efficacy feedback for a technique
   */
  async getEfficacyFeedbackForTechnique(
    techniqueId: string,
  ): Promise<EfficacyFeedback[]> {
    const db = await this.getDatabase()
    const results = await db
      .collection('ai_efficacy_feedback')
      .find({ techniqueId })
      .toArray()

    return results.map((doc) => ({
      ...doc,
      id: doc._id?.toHexString(),
    })) as unknown as EfficacyFeedback[]
  }

  /**
   * Get efficacy feedback for a client
   */
  async getEfficacyFeedbackForClient(
    clientId: string,
  ): Promise<EfficacyFeedback[]> {
    const db = await this.getDatabase()
    const results = await db
      .collection('ai_efficacy_feedback')
      .find({ clientId })
      .toArray()

    return results.map((doc) => ({
      ...doc,
      id: doc._id?.toHexString(),
    })) as unknown as EfficacyFeedback[]
  }

  /**
   * Get techniques for a specific indication
   */
  async getTechniquesForIndication(indication: string): Promise<Technique[]> {
    const db = await this.getDatabase()
    const results = await db
      .collection('techniques')
      .find({ indications: indication })
      .toArray()

    return results.map((doc) => ({
      ...doc,
      id: doc._id?.toHexString(),
    })) as unknown as Technique[]
  }

  /**
   * Get a client's profile, including preferences, characteristics, and technique history.
   * Assumes existence of 'client_profiles' and 'client_technique_history' tables.
   */
  async getClientProfile(clientId: string): Promise<ClientProfile | null> {
    const db = await this.getDatabase()
    const profile = await db.collection('client_profiles').findOne({ clientId })

    if (!profile) {
      return null
    }

    const techniqueHistory = await db
      .collection('client_technique_history')
      .find({ clientId })
      .sort({ lastUsedAt: -1 })
      .toArray()

    return {
      ...profile,
      history: {
        pastTechniques: techniqueHistory.map((doc) => ({
          ...doc,
          id: doc._id?.toHexString(),
        })),
      },
    } as unknown as ClientProfile
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
    const db = await this.getDatabase()
    const documentToInsert = {
      ...result,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const { insertedId } = await db
      .collection('ai_bias_analysis')
      .insertOne(documentToInsert)
    return insertedId.toHexString()
  }

  /**
   * Get bias analysis result by session ID
   */
  async getBiasAnalysisBySession(
    sessionId: string,
  ): Promise<BiasAnalysisResult | null> {
    const db = await this.getDatabase()
    const result = await db
      .collection('ai_bias_analysis')
      .findOne({ sessionId }, { sort: { createdAt: -1 } })

    if (!result) {
      return null
    }

    return {
      ...result,
      id: result._id.toHexString(),
    } as unknown as BiasAnalysisResult
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
    const db = await this.getDatabase()
    const query: Record<string, unknown> = { userId }

    if (options?.alertLevel) {
      query.alertLevel = { $in: options.alertLevel }
    }
    if (options?.timeRange) {
      query.createdAt = {
        $gte: options.timeRange.start,
        $lte: options.timeRange.end,
      }
    }

    const results = await db
      .collection('ai_bias_analysis')
      .find(query)
      .sort({ createdAt: -1 })
      .skip(options?.offset || 0)
      .limit(options?.limit || 10)
      .toArray()

    return results.map((doc) => ({
      ...doc,
      id: doc._id.toHexString(),
    })) as unknown as BiasAnalysisResult[]
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
    const db = await this.getDatabase()
    const documentToInsert = {
      ...metric,
      createdAt: new Date(),
    }
    const { insertedId } = await db
      .collection('ai_bias_metrics')
      .insertOne(documentToInsert)
    return insertedId.toHexString()
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
    const db = await this.getDatabase()
    const query: Record<string, unknown> = {}

    if (options?.metricType) {
      query.metricType = { $in: options.metricType }
    }
    if (options?.metricName) {
      query.metricName = { $in: options.metricName }
    }
    if (options?.aggregationPeriod) {
      query.aggregationPeriod = options.aggregationPeriod
    }
    if (options?.userId) {
      query.userId = options.userId
    }
    if (options?.timeRange) {
      query.timestamp = {
        $gte: options.timeRange.start,
        $lte: options.timeRange.end,
      }
    }

    const results = await db
      .collection('ai_bias_metrics')
      .find(query)
      .sort({ timestamp: -1 })
      .limit(options?.limit || 10)
      .toArray()

    return results.map((doc) => ({
      ...doc,
      id: doc._id.toHexString(),
    })) as unknown as BiasMetric[]
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
    const db = await this.getDatabase()
    const documentToInsert = {
      ...alert,
      createdAt: new Date(),
      updatedAt: new Date(),
      acknowledged: false,
      resolved: false,
      escalated: false,
      actions: [],
    }
    const { insertedId } = await db
      .collection('ai_bias_alerts')
      .insertOne(documentToInsert)
    return insertedId.toHexString()
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
    const db = await this.getDatabase()
    const query: Record<string, unknown> = {}

    if (options?.alertLevel) {
      query.alertLevel = { $in: options.alertLevel }
    }
    if (options?.alertType) {
      query.alertType = { $in: options.alertType }
    }
    if (options?.acknowledgedOnly) {
      query.acknowledged = true
    }
    if (options?.unresolvedOnly) {
      query.resolved = false
    }
    if (options?.userId) {
      query.userId = options.userId
    }
    if (options?.timeRange) {
      query.createdAt = {
        $gte: options.timeRange.start,
        $lte: options.timeRange.end,
      }
    }

    const results = await db
      .collection('ai_bias_alerts')
      .find(query)
      .sort({ createdAt: -1 })
      .skip(options?.offset || 0)
      .limit(options?.limit || 10)
      .toArray()

    return results.map((doc) => ({
      ...doc,
      id: doc._id.toHexString(),
    })) as unknown as BiasAlert[]
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
    const db = await this.getDatabase()
    const updateData: Record<string, unknown> = { updatedAt: new Date() }

    if (updates['acknowledged'] !== undefined) {
      updateData.acknowledged = updates['acknowledged']
      updateData.acknowledgedAt = updates['acknowledged'] ? new Date() : null
      if (updates['acknowledgedBy']) {
        updateData.acknowledgedBy = updates['acknowledgedBy']
      }
    }

    if (updates['resolved'] !== undefined) {
      updateData.resolved = updates['resolved']
      updateData.resolvedAt = updates['resolved'] ? new Date() : null
      if (updates['resolvedBy']) {
        updateData.resolvedBy = updates['resolvedBy']
      }
    }

    if (updates['escalated'] !== undefined) {
      updateData.escalated = updates['escalated']
      updateData.escalatedAt = updates['escalated'] ? new Date() : null
    }

    if (updates['actions']) {
      updateData.actions = updates['actions']
    }

    const result = await db
      .collection('ai_bias_alerts')
      .updateOne({ alertId }, { $set: updateData })

    return result.modifiedCount > 0
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
    const db = await this.getDatabase()
    const documentToInsert = {
      ...report,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const { insertedId } = await db
      .collection('ai_bias_reports')
      .insertOne(documentToInsert)
    return insertedId.toHexString()
  }

  /**
   * Get bias report by report ID
   */
  async getBiasReport(reportId: string): Promise<BiasReport | null> {
    const db = await this.getDatabase()
    const result = await db.collection('ai_bias_reports').findOne({ reportId })

    if (!result) {
      return null
    }

    return {
      ...result,
      id: result._id.toHexString(),
    } as unknown as BiasReport
  }

  /**
   * Get bias reports for a user
   */
  async getBiasReportsByUser(
    userId: string,
    limit = 10,
    offset = 0,
  ): Promise<BiasReport[]> {
    const db = await this.getDatabase()
    const results = await db
      .collection('ai_bias_reports')
      .find({ userId })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray()

    return results.map((doc) => ({
      ...doc,
      id: doc._id.toHexString(),
    })) as unknown as BiasReport[]
  }

  /**
   * Get bias analysis summary statistics
   */
  async getBiasAnalysisSummary(): Promise<{
    totalAnalyses: number
    averageBiasScore: number
    alertDistribution: Record<string, number>
    dailyTrends: Array<{ date: string; count: number; avgBias: number }>
  }> {
    // Use the materialized view for better performance
    // TODO: Implement MongoDB aggregation for bias analysis summary
    return {
      totalAnalyses: 0,
      averageBiasScore: 0,
      alertDistribution: {},
      dailyTrends: [],
    }
  }
}
