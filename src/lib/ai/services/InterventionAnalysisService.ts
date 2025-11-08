/**
 * InterventionAnalysisService - Analyze effectiveness of therapeutic interventions
 *
 * This service evaluates the effectiveness of interventions and provides
 * recommendations for treatment optimization.
 */

import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import type { EmotionAnalysis, EmotionDimensions } from '../emotions/types'

const logger = createBuildSafeLogger('InterventionAnalysisService')

// Export the main interface for external use
export interface InterventionEffectivenessResult {
  interventionId: string
  effectivenessScore: number // 0-1 scale
  confidence: number // 0-1 scale
  metrics: {
    emotionalImprovement: number
    engagementLevel: number
    responseQuality: number
    stabilityIndicator: number
  }
  trends: {
    valenceChange: number
    arousalChange: number
    dominanceChange: number
  }
  recommendations: string[]
  riskFactors: string[]
  timestamp: string
}

export interface InterventionContext {
  interventionId: string
  type:
    | 'cognitive'
    | 'behavioral'
    | 'mindfulness'
    | 'exposure'
    | 'acceptance'
    | 'other'
  description: string
  startTime: string
  duration: number // minutes
  techniques: string[]
}

export interface PatientResponse {
  emotionBefore: EmotionAnalysis
  emotionAfter: EmotionAnalysis
  verbalFeedback?: string
  engagementMetrics?: {
    participationLevel: number // 0-1
    responseLatency: number // milliseconds
    coherenceScore: number // 0-1
  }
}

/**
 * Service for analyzing intervention effectiveness
 */
export class InterventionAnalysisService {
  private static instance: InterventionAnalysisService
  private analysisHistory: Map<string, InterventionEffectivenessResult[]> =
    new Map()

  private constructor() {
    logger.info('InterventionAnalysisService initialized')
  }

  public static getInstance(): InterventionAnalysisService {
    if (!InterventionAnalysisService.instance) {
      InterventionAnalysisService.instance = new InterventionAnalysisService()
    }
    return InterventionAnalysisService.instance
  }

  /**
   * Analyze the effectiveness of an intervention
   */
  async analyzeEffectiveness(
    context: InterventionContext,
    response: PatientResponse,
    sessionHistory?: EmotionAnalysis[],
  ): Promise<InterventionEffectivenessResult> {
    try {
      logger.info('Analyzing intervention effectiveness', {
        interventionId: context.interventionId,
        type: context.type,
      })

      // Calculate emotional improvement
      const emotionalImprovement = this.calculateEmotionalImprovement(
        response.emotionBefore,
        response.emotionAfter,
      )

      // Calculate engagement level
      const engagementLevel = this.calculateEngagementLevel(
        response.engagementMetrics,
        response.verbalFeedback,
      )

      // Calculate response quality
      const responseQuality = this.calculateResponseQuality(response)

      // Calculate stability indicator
      const stabilityIndicator = this.calculateStabilityIndicator(
        response.emotionAfter,
        sessionHistory,
      )

      // Calculate dimensional trends
      const trends = this.calculateDimensionalTrends(
        response.emotionBefore.dimensions,
        response.emotionAfter.dimensions,
      )

      // Calculate overall effectiveness score
      const effectivenessScore = this.calculateOverallEffectiveness({
        emotionalImprovement,
        engagementLevel,
        responseQuality,
        stabilityIndicator,
      })

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        context,
        {
          emotionalImprovement,
          engagementLevel,
          responseQuality,
          stabilityIndicator,
        },
        trends,
      )

      // Identify risk factors
      const riskFactors = this.identifyRiskFactors(response, trends)

      // Calculate confidence based on data quality
      const confidence = this.calculateAnalysisConfidence(
        response,
        sessionHistory,
      )

      const result: InterventionEffectivenessResult = {
        interventionId: context.interventionId,
        effectivenessScore,
        confidence,
        metrics: {
          emotionalImprovement,
          engagementLevel,
          responseQuality,
          stabilityIndicator,
        },
        trends,
        recommendations,
        riskFactors,
        timestamp: new Date().toISOString(),
      }

      // Store in analysis history
      this.storeAnalysisResult(context.interventionId, result)

      return result
    } catch (error: unknown) {
      logger.error('Error analyzing intervention effectiveness', { error })
      throw new Error(`Failed to analyze intervention effectiveness: ${error}`, { cause: error })
    }
  }

  /**
   * Calculate emotional improvement score
   */
  private calculateEmotionalImprovement(
    before: EmotionAnalysis,
    after: EmotionAnalysis,
  ): number {
    // Calculate improvement in valence (positive emotions)
    const valenceImprovement =
      after.dimensions.valence - before.dimensions.valence

    // Calculate reduction in negative emotions
    const negativeEmotionsBefore =
      before.emotions.sadness + before.emotions.anger + before.emotions.fear
    const negativeEmotionsAfter =
      after.emotions.sadness + after.emotions.anger + after.emotions.fear
    const negativeReduction = negativeEmotionsBefore - negativeEmotionsAfter

    // Calculate increase in positive emotions
    const positiveEmotionsBefore =
      before.emotions.joy + before.emotions.trust + before.emotions.anticipation
    const positiveEmotionsAfter =
      after.emotions.joy + after.emotions.trust + after.emotions.anticipation
    const positiveIncrease = positiveEmotionsAfter - positiveEmotionsBefore

    // Weighted combination
    const improvementScore =
      valenceImprovement * 0.4 +
      negativeReduction * 0.3 +
      positiveIncrease * 0.3

    // Normalize to 0-1 scale
    return Math.max(0, Math.min(1, (improvementScore + 1) / 2))
  }

  /**
   * Calculate engagement level
   */
  private calculateEngagementLevel(
    metrics?: {
      participationLevel: number
      responseLatency: number
      coherenceScore: number
    },
    verbalFeedback?: string,
  ): number {
    if (!metrics) {
      // Fallback to verbal feedback analysis
      if (verbalFeedback) {
        return this.analyzeVerbalEngagement(verbalFeedback)
      }
      return 0.5 // Default neutral engagement
    }

    // Calculate engagement from metrics
    const participationScore = metrics.participationLevel

    // Lower latency indicates better engagement (normalize to 0-1)
    const latencyScore = Math.max(0, 1 - metrics.responseLatency / 10000) // 10s max

    const coherenceScore = metrics.coherenceScore

    // Weighted combination
    return participationScore * 0.4 + latencyScore * 0.3 + coherenceScore * 0.3
  }

  /**
   * Analyze verbal feedback for engagement indicators
   */
  private analyzeVerbalEngagement(feedback: string): number {
    const engagementIndicators = [
      'understand',
      'helpful',
      'better',
      'clearer',
      'makes sense',
      'thank you',
      'appreciate',
      'good',
      'yes',
      'right',
    ]

    const disengagementIndicators = [
      'confused',
      "don't understand",
      'no',
      'wrong',
      'unhelpful',
      'worse',
      'difficult',
      'hard',
      "can't",
      "won't",
    ]

    const text = feedback.toLowerCase()
    let engagementScore = 0.5 // Start neutral

    engagementIndicators.forEach((indicator) => {
      if (text.includes(indicator)) {
        engagementScore += 0.1
      }
    })

    disengagementIndicators.forEach((indicator) => {
      if (text.includes(indicator)) {
        engagementScore -= 0.1
      }
    })

    return Math.max(0, Math.min(1, engagementScore))
  }

  /**
   * Calculate response quality
   */
  private calculateResponseQuality(response: PatientResponse): number {
    // Based on emotional coherence and stability
    const afterEmotion = response.emotionAfter

    // Check for emotional coherence (not conflicting high emotions)
    const _totalEmotionIntensity = Object.values(afterEmotion.emotions).reduce(
      (sum, val) => sum + val,
      0,
    )
    const emotionCount = Object.values(afterEmotion.emotions).filter(
      (val) => val > 0.3,
    ).length

    const coherenceScore = emotionCount > 0 ? 1 - (emotionCount - 1) * 0.2 : 0.8

    // Check confidence level
    const confidenceScore = afterEmotion.confidence

    // Check dimensional balance
    const dimensionalBalance =
      1 - Math.abs(afterEmotion.dimensions.valence) * 0.3 // Prefer moderate valence

    return Math.max(
      0,
      Math.min(1, (coherenceScore + confidenceScore + dimensionalBalance) / 3),
    )
  }

  /**
   * Calculate stability indicator
   */
  private calculateStabilityIndicator(
    currentEmotion: EmotionAnalysis,
    sessionHistory?: EmotionAnalysis[],
  ): number {
    if (!sessionHistory || sessionHistory.length < 2) {
      return 0.5 // Default when insufficient history
    }

    // Calculate variance in recent emotions
    const recentEmotions = sessionHistory.slice(-5) // Last 5 entries

    // Calculate valence stability
    const valences = recentEmotions.map((e) => e.dimensions.valence)
    const valenceVariance = this.calculateVariance(valences)

    // Calculate arousal stability
    const arousals = recentEmotions.map((e) => e.dimensions.arousal)
    const arousalVariance = this.calculateVariance(arousals)

    // Lower variance indicates higher stability
    const stabilityScore = 1 - (valenceVariance + arousalVariance) / 2

    return Math.max(0, Math.min(1, stabilityScore))
  }

  /**
   * Calculate variance for an array of numbers
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2))
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length
  }

  /**
   * Calculate dimensional trends
   */
  private calculateDimensionalTrends(
    before: EmotionDimensions,
    after: EmotionDimensions,
  ): { valenceChange: number; arousalChange: number; dominanceChange: number } {
    return {
      valenceChange: after.valence - before.valence,
      arousalChange: after.arousal - before.arousal,
      dominanceChange: after.dominance - before.dominance,
    }
  }

  /**
   * Calculate overall effectiveness score
   */
  private calculateOverallEffectiveness(metrics: {
    emotionalImprovement: number
    engagementLevel: number
    responseQuality: number
    stabilityIndicator: number
  }): number {
    // Weighted combination of all metrics
    return (
      metrics.emotionalImprovement * 0.35 +
      metrics.engagementLevel * 0.25 +
      metrics.responseQuality * 0.25 +
      metrics.stabilityIndicator * 0.15
    )
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    context: InterventionContext,
    metrics: {
      emotionalImprovement: number
      engagementLevel: number
      responseQuality: number
      stabilityIndicator: number
    },
    trends: {
      valenceChange: number
      arousalChange: number
      dominanceChange: number
    },
  ): string[] {
    const recommendations: string[] = []

    // Emotional improvement recommendations
    if (metrics.emotionalImprovement < 0.3) {
      recommendations.push(
        'Consider alternative intervention approaches - current method showing limited emotional benefit',
      )
      recommendations.push(
        'Assess for underlying factors that may be impeding progress',
      )
    } else if (metrics.emotionalImprovement > 0.7) {
      recommendations.push(
        'Continue current intervention approach - showing strong positive results',
      )
    }

    // Engagement recommendations
    if (metrics.engagementLevel < 0.4) {
      recommendations.push(
        'Focus on increasing patient engagement through more interactive techniques',
      )
      recommendations.push(
        'Consider shorter, more frequent sessions to maintain attention',
      )
    }

    // Valence trend recommendations
    if (trends.valenceChange < -0.2) {
      recommendations.push(
        'Monitor for signs of emotional deterioration - consider crisis protocols if needed',
      )
    } else if (trends.valenceChange > 0.3) {
      recommendations.push(
        'Positive emotional trajectory - consider gradual increase in intervention intensity',
      )
    }

    // Arousal trend recommendations
    if (trends.arousalChange > 0.4) {
      recommendations.push(
        'High arousal increase detected - implement calming techniques',
      )
    } else if (trends.arousalChange < -0.3) {
      recommendations.push(
        'Low arousal may indicate disengagement - consider more stimulating approaches',
      )
    }

    // Stability recommendations
    if (metrics.stabilityIndicator < 0.3) {
      recommendations.push(
        'Focus on emotional regulation techniques to improve stability',
      )
    }

    // Technique-specific recommendations
    if (context.type === 'cognitive' && metrics.emotionalImprovement < 0.4) {
      recommendations.push(
        'Consider supplementing cognitive techniques with behavioral interventions',
      )
    }

    return recommendations
  }

  /**
   * Identify risk factors
   */
  private identifyRiskFactors(
    response: PatientResponse,
    trends: {
      valenceChange: number
      arousalChange: number
      dominanceChange: number
    },
  ): string[] {
    const riskFactors: string[] = []

    // High negative emotions
    const negativeEmotions =
      response.emotionAfter.emotions.sadness +
      response.emotionAfter.emotions.anger +
      response.emotionAfter.emotions.fear

    if (negativeEmotions > 1.5) {
      riskFactors.push('Elevated negative emotional state')
    }

    // Significant valence decrease
    if (trends.valenceChange < -0.4) {
      riskFactors.push('Significant decrease in emotional positivity')
    }

    // Extreme arousal changes
    if (Math.abs(trends.arousalChange) > 0.5) {
      riskFactors.push('Extreme changes in emotional activation')
    }

    // Low dominance with high negative emotions
    if (
      response.emotionAfter.dimensions.dominance < -0.5 &&
      negativeEmotions > 1.0
    ) {
      riskFactors.push('Low sense of control combined with negative emotions')
    }

    // Low confidence in analysis
    if (response.emotionAfter.confidence < 0.3) {
      riskFactors.push('Low confidence in emotional state assessment')
    }

    return riskFactors
  }

  /**
   * Calculate confidence in analysis
   */
  private calculateAnalysisConfidence(
    response: PatientResponse,
    sessionHistory?: EmotionAnalysis[],
  ): number {
    let confidence = 0.5 // Base confidence

    // Factor in emotion analysis confidence
    confidence += response.emotionBefore.confidence * 0.25
    confidence += response.emotionAfter.confidence * 0.25

    // Factor in engagement metrics availability
    if (response.engagementMetrics) {
      confidence += 0.2
    }

    // Factor in verbal feedback availability
    if (response.verbalFeedback && response.verbalFeedback.length > 10) {
      confidence += 0.15
    }

    // Factor in historical data availability
    if (sessionHistory && sessionHistory.length > 2) {
      confidence += 0.15
    }

    return Math.min(1, confidence)
  }

  /**
   * Store analysis result in history
   */
  private storeAnalysisResult(
    interventionId: string,
    result: InterventionEffectivenessResult,
  ): void {
    if (!this.analysisHistory.has(interventionId)) {
      this.analysisHistory.set(interventionId, [])
    }

    const history = this.analysisHistory.get(interventionId)!
    history.push(result)

    // Keep only last 50 results to prevent memory issues
    if (history.length > 50) {
      history.splice(0, history.length - 50)
    }
  }

  /**
   * Get analysis history for an intervention
   */
  getAnalysisHistory(
    interventionId: string,
  ): InterventionEffectivenessResult[] {
    return this.analysisHistory.get(interventionId) || []
  }

  /**
   * Get effectiveness trends over time
   */
  getEffectivenessTrends(interventionId: string): {
    timestamps: string[]
    effectivenessScores: number[]
    emotionalImprovements: number[]
    engagementLevels: number[]
  } {
    const history = this.getAnalysisHistory(interventionId)

    return {
      timestamps: history.map((r) => r.timestamp),
      effectivenessScores: history.map((r) => r.effectivenessScore),
      emotionalImprovements: history.map((r) => r.metrics.emotionalImprovement),
      engagementLevels: history.map((r) => r.metrics.engagementLevel),
    }
  }
}

// Export singleton instance
export const interventionAnalysisService =
  InterventionAnalysisService.getInstance()
