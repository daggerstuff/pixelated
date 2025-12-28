import { MentalHealthAnalyzer } from './analyzer'
import { TherapeuticResponseGenerator } from './therapist'
import type {
  ChatMessage,
  MentalHealthAnalysis,
  AnalysisConfig,
  TherapeuticResponse,
} from './types'

export class MentalHealthService {
  private analyzer: MentalHealthAnalyzer
  private therapist: TherapeuticResponseGenerator
  private config: AnalysisConfig
  private conversationHistory: Map<string, ChatMessage[]> = new Map()
  private analysisHistory: Map<string, MentalHealthAnalysis[]> = new Map()

  constructor(config: Partial<AnalysisConfig> = {}) {
    this.analyzer = new MentalHealthAnalyzer()
    this.therapist = new TherapeuticResponseGenerator()
    this.config = {
      enableAnalysis: true,
      confidenceThreshold: 0.6,
      interventionThreshold: 0.7,
      analysisMinLength: 10,
      enableCrisisDetection: true,
      ...config,
    }
  }

  async processMessage(
    conversationId: string,
    message: Omit<ChatMessage, 'analysis'>,
  ): Promise<ChatMessage> {
    // Store message in conversation history
    const history = this.conversationHistory.get(conversationId) || []

    let processedMessage: ChatMessage = { ...message }

    // Analyze user messages if analysis is enabled
    if (
      this.config.enableAnalysis &&
      message.role === 'user' &&
      message.content.length >= this.config.analysisMinLength
    ) {
      try {
        const analysis = await this.analyzer.analyze(message.content)

        // Only include analysis if confidence meets threshold
        if (analysis.confidence >= this.config.confidenceThreshold) {
          processedMessage.analysis = analysis

          // Store analysis in history
          const analysisHistory = this.analysisHistory.get(conversationId) || []
          analysisHistory.push(analysis)
          this.analysisHistory.set(conversationId, analysisHistory.slice(-20)) // Keep last 20
        }
      } catch (error: unknown) {
        console.error('Analysis failed:', error)
      }
    }

    // Update conversation history
    history.push(processedMessage)
    this.conversationHistory.set(conversationId, history.slice(-50)) // Keep last 50 messages

    return processedMessage
  }

  async generateTherapeuticResponse(
    conversationId: string,
    analysis?: MentalHealthAnalysis,
  ): Promise<TherapeuticResponse> {
    // Use provided analysis or get the most recent one
    const targetAnalysis = analysis || this.getLatestAnalysis(conversationId)

    if (!targetAnalysis) {
      // Generate a default supportive response
      return {
        content:
          "I'm here to listen and support you. How are you feeling today?",
        approach: 'supportive',
        techniques: ['Active listening', 'Empathic responding'],
        followUp: [
          'What would be most helpful for you right now?',
          'How long have you been feeling this way?',
        ],
      }
    }

    return await this.therapist.generateResponse(targetAnalysis)
  }

  needsIntervention(conversationId: string): boolean {
    const analysisHistory = this.analysisHistory.get(conversationId) || []
    if (analysisHistory.length === 0) {
      return false
    }

    // Check recent analyses for intervention triggers
    const recentAnalyses = analysisHistory.slice(-3) // Last 3 analyses

    return recentAnalyses.some(
      (analysis) =>
        analysis.requiresIntervention ||
        analysis.riskLevel === 'critical' ||
        (analysis.riskLevel === 'high' &&
          analysis.confidence >= this.config.interventionThreshold),
    )
  }

  getAnalysisHistory(conversationId: string): MentalHealthAnalysis[] {
    return this.analysisHistory.get(conversationId) || []
  }

  getConversationHistory(conversationId: string): ChatMessage[] {
    return this.conversationHistory.get(conversationId) || []
  }

  getLatestAnalysis(conversationId: string): MentalHealthAnalysis | undefined {
    const history = this.analysisHistory.get(conversationId) || []
    return history[history.length - 1]
  }

  getRiskTrend(
    conversationId: string,
  ): 'improving' | 'stable' | 'worsening' | 'insufficient_data' {
    const history = this.analysisHistory.get(conversationId) || []
    if (history.length < 2) {
      return 'insufficient_data'
    }

    const recent = history.slice(-3)
    const riskScores = recent.map((a) => this.riskLevelToScore(a.riskLevel))

    if (riskScores.length < 2) {
      return 'insufficient_data'
    }

    const lastScore = riskScores[riskScores.length - 1]
    const firstScore = riskScores[0]
    if (lastScore === undefined || firstScore === undefined) {
      return 'insufficient_data'
    }
    const trend = lastScore - firstScore

    if (trend > 0.1) {
      return 'worsening'
    }
    if (trend < -0.1) {
      return 'improving'
    }
    return 'stable'
  }

  private riskLevelToScore(riskLevel: string): number {
    switch (riskLevel) {
      case 'low':
        return 0.25
      case 'medium':
        return 0.5
      case 'high':
        return 0.75
      case 'critical':
        return 1.0
      default:
        return 0
    }
  }

  updateConfig(newConfig: Partial<AnalysisConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  clearHistory(conversationId: string): void {
    this.conversationHistory.delete(conversationId)
    this.analysisHistory.delete(conversationId)
  }

  getStats(conversationId: string) {
    const messages = this.conversationHistory.get(conversationId) || []
    const analyses = this.analysisHistory.get(conversationId) || []

    const userMessages = messages.filter((m) => m.role === 'user')
    const analyzedMessages = userMessages.filter((m) => m.analysis)

    const riskLevels = analyses.map((a) => a.riskLevel)
    const avgConfidence =
      analyses.length > 0
        ? analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length
        : 0

    return {
      totalMessages: messages.length,
      userMessages: userMessages.length,
      analyzedMessages: analyzedMessages.length,
      analysisRate:
        userMessages.length > 0
          ? analyzedMessages.length / userMessages.length
          : 0,
      avgConfidence,
      riskDistribution: {
        low: riskLevels.filter((r) => r === 'low').length,
        medium: riskLevels.filter((r) => r === 'medium').length,
        high: riskLevels.filter((r) => r === 'high').length,
        critical: riskLevels.filter((r) => r === 'critical').length,
      },
      currentRiskTrend: this.getRiskTrend(conversationId),
    }
  }
}
