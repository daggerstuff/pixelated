import type { EmotionAnalysis } from '@/hooks/useEmotionDetection'
import type { RiskAssessment } from '@/hooks/useRiskAssessment'

export interface CrisisRiskFactors {
  emotional: {
    intensityTrend: number[]
    volatilityScore: number
    negativeEmotionDuration: number
    emotionalRegulationCapacity: number
  }
  behavioral: {
    sessionEngagement: number
    communicationPatterns: string[]
    isolationIndicators: number
    activityChanges: number
  }
  historical: {
    previousCrises: number
    timesSinceLastCrisis: number
    treatmentCompliance: number
    supportSystemStrength: number
  }
  temporal: {
    daysSinceLastSession: number
    timeOfDay: number
    seasonalFactors: number
    anniversaryDates: string[]
  }
}

export interface CrisisPrediction {
  riskLevel: 'minimal' | 'low' | 'moderate' | 'high' | 'imminent'
  timeframe: 'within_hour' | 'within_day' | 'within_week' | 'within_month'
  confidence: number
  primaryRiskFactors: string[]
  protectiveFactors: string[]
  interventionWindow: {
    optimal: string
    critical: string
  }
  escalationTriggers: string[]
}

export interface TemporalRiskModel {
  shortTerm: {
    nextHour: number
    next6Hours: number
    next24Hours: number
  }
  mediumTerm: {
    next3Days: number
    nextWeek: number
    next2Weeks: number
  }
  longTerm: {
    nextMonth: number
    next3Months: number
    next6Months: number
  }
}

export class PredictiveCrisisModelingService {
  private readonly modelWeights = {
    emotional: 0.35,
    behavioral: 0.25,
    historical: 0.25,
    temporal: 0.15,
  }

  private readonly severityThresholds = {
    minimal: 0.1,
    low: 0.25,
    moderate: 0.5,
    high: 0.75,
    imminent: 0.9,
  }

  /**
   * Generate crisis prediction based on multiple risk factors
   */
  async predictCrisisRisk(
    currentAssessment: RiskAssessment,
    emotionHistory: EmotionAnalysis[],
    riskFactors: CrisisRiskFactors,
    _userId?: string,
  ): Promise<CrisisPrediction> {
    try {
      // Calculate weighted risk scores
      const emotionalRisk = this.calculateEmotionalRisk(
        emotionHistory,
        riskFactors.emotional,
      )
      const behavioralRisk = this.calculateBehavioralRisk(
        riskFactors.behavioral,
      )
      const historicalRisk = this.calculateHistoricalRisk(
        riskFactors.historical,
      )
      const temporalRisk = this.calculateTemporalRisk(riskFactors.temporal)

      // Compute composite risk score
      const compositeRisk =
        emotionalRisk * this.modelWeights.emotional +
        behavioralRisk * this.modelWeights.behavioral +
        historicalRisk * this.modelWeights.historical +
        temporalRisk * this.modelWeights.temporal

      // Determine risk level and timeframe
      const riskLevel = this.determineRiskLevel(compositeRisk)
      const timeframe = this.predictTimeframe(compositeRisk, riskFactors)

      // Calculate confidence with uncertainty quantification
      const confidence = this.calculateConfidence(
        emotionalRisk,
        behavioralRisk,
        historicalRisk,
        temporalRisk,
        emotionHistory.length,
      )

      // Identify primary risk and protective factors
      const primaryRiskFactors = this.identifyPrimaryRiskFactors(
        riskFactors,
        compositeRisk,
      )
      const protectiveFactors = this.identifyProtectiveFactors(riskFactors)

      // Determine intervention windows
      const interventionWindow = this.calculateInterventionWindow(
        riskLevel,
        timeframe,
      )

      // Generate escalation triggers
      const escalationTriggers = this.generateEscalationTriggers(
        riskLevel,
        riskFactors,
      )

      return {
        riskLevel,
        timeframe,
        confidence,
        primaryRiskFactors,
        protectiveFactors,
        interventionWindow,
        escalationTriggers,
      }
    } catch (error) {
      console.error('Error in predictive crisis modeling:', error)

      // Fallback to conservative prediction
      return {
        riskLevel: currentAssessment.category === 'high' ? 'high' : 'moderate',
        timeframe: 'within_week',
        confidence: 0.3,
        primaryRiskFactors: currentAssessment.factors,
        protectiveFactors: [],
        interventionWindow: {
          optimal: 'Next 24 hours',
          critical: 'Next 72 hours',
        },
        escalationTriggers: ['Manual review required due to prediction error'],
      }
    }
  }

  /**
   * Generate temporal risk model for different time horizons
   */
  generateTemporalRiskModel(
    prediction: CrisisPrediction,
    riskFactors: CrisisRiskFactors,
  ): TemporalRiskModel {
    const baseRisk = this.severityThresholds[prediction.riskLevel] || 0.5

    // Short-term predictions (hours to day)
    const shortTerm = {
      nextHour: this.calculateHourlyRisk(baseRisk, riskFactors.temporal),
      next6Hours:
        this.calculateHourlyRisk(baseRisk, riskFactors.temporal) * 1.2,
      next24Hours:
        this.calculateHourlyRisk(baseRisk, riskFactors.temporal) * 1.5,
    }

    // Medium-term predictions (days to weeks)
    const mediumTerm = {
      next3Days: baseRisk * 0.9,
      nextWeek: baseRisk * 0.8,
      next2Weeks: baseRisk * 0.7,
    }

    // Long-term predictions (months)
    const longTerm = {
      nextMonth: baseRisk * 0.6,
      next3Months: baseRisk * 0.4,
      next6Months: baseRisk * 0.3,
    }

    return { shortTerm, mediumTerm, longTerm }
  }

  private calculateEmotionalRisk(
    emotionHistory: EmotionAnalysis[],
    emotionalFactors: CrisisRiskFactors['emotional'],
  ): number {
    if (emotionHistory.length === 0) return 0.5

    // Calculate trend volatility
    const intensityVariance = this.calculateVariance(
      emotionalFactors.intensityTrend,
    )
    const volatilityScore = Math.min(intensityVariance / 100, 1)

    // Factor in negative emotion persistence
    const negativeEmotionWeight = Math.min(
      emotionalFactors.negativeEmotionDuration / 7,
      1,
    )

    // Consider emotional regulation capacity
    const regulationDeficit = Math.max(
      0,
      1 - emotionalFactors.emotionalRegulationCapacity,
    )

    // Recent high-intensity emotions
    const recentIntensity =
      emotionHistory
        .slice(-3)
        .reduce((sum, emotion) => sum + emotion.intensity, 0) /
      Math.min(3, emotionHistory.length)

    return (
      volatilityScore * 0.3 +
      negativeEmotionWeight * 0.3 +
      regulationDeficit * 0.25 +
      recentIntensity * 0.15
    )
  }

  private calculateBehavioralRisk(
    behavioralFactors: CrisisRiskFactors['behavioral'],
  ): number {
    // Session engagement decline
    const engagementRisk = Math.max(0, 1 - behavioralFactors.sessionEngagement)

    // Communication pattern changes
    const communicationRisk = behavioralFactors.communicationPatterns.includes(
      'withdrawal',
    )
      ? 0.8
      : behavioralFactors.communicationPatterns.includes('agitation')
        ? 0.7
        : 0.3

    // Social isolation indicators
    const isolationRisk = Math.min(
      behavioralFactors.isolationIndicators / 10,
      1,
    )

    // Activity level changes
    const activityRisk = Math.abs(behavioralFactors.activityChanges - 1) * 0.5

    return (
      engagementRisk * 0.4 +
      communicationRisk * 0.3 +
      isolationRisk * 0.2 +
      activityRisk * 0.1
    )
  }

  private calculateHistoricalRisk(
    historicalFactors: CrisisRiskFactors['historical'],
  ): number {
    // Previous crisis frequency
    const crisisFrequency = Math.min(historicalFactors.previousCrises / 5, 1)

    // Time since last crisis (inverse relationship)
    const timeFactor =
      historicalFactors.timesSinceLastCrisis > 90
        ? 0.2
        : historicalFactors.timesSinceLastCrisis > 30
          ? 0.5
          : 0.8

    // Treatment compliance
    const complianceRisk = Math.max(
      0,
      1 - historicalFactors.treatmentCompliance,
    )

    // Support system strength (inverse)
    const supportRisk = Math.max(0, 1 - historicalFactors.supportSystemStrength)

    return (
      crisisFrequency * 0.4 +
      timeFactor * 0.25 +
      complianceRisk * 0.2 +
      supportRisk * 0.15
    )
  }

  private calculateTemporalRisk(
    temporalFactors: CrisisRiskFactors['temporal'],
  ): number {
    // Days since last session
    const sessionGapRisk = Math.min(
      temporalFactors.daysSinceLastSession / 14,
      1,
    )

    // Time of day risk (higher at night/early morning)
    const timeRisk =
      temporalFactors.timeOfDay >= 22 || temporalFactors.timeOfDay <= 6
        ? 0.7
        : 0.3

    // Seasonal factors
    const seasonalRisk = temporalFactors.seasonalFactors

    // Anniversary dates proximity
    const anniversaryRisk =
      temporalFactors.anniversaryDates.length > 0 ? 0.6 : 0.1

    return (
      sessionGapRisk * 0.4 +
      timeRisk * 0.3 +
      seasonalRisk * 0.2 +
      anniversaryRisk * 0.1
    )
  }

  private determineRiskLevel(
    compositeRisk: number,
  ): CrisisPrediction['riskLevel'] {
    if (compositeRisk >= this.severityThresholds.imminent) return 'imminent'
    if (compositeRisk >= this.severityThresholds.high) return 'high'
    if (compositeRisk >= this.severityThresholds.moderate) return 'moderate'
    if (compositeRisk >= this.severityThresholds.low) return 'low'
    return 'minimal'
  }

  private predictTimeframe(
    compositeRisk: number,
    riskFactors: CrisisRiskFactors,
  ): CrisisPrediction['timeframe'] {
    const urgencyScore =
      (riskFactors.emotional.intensityTrend
        .slice(-2)
        .reduce((a, b) => a + b, 0) /
        2) *
        0.4 +
      (1 - riskFactors.behavioral.sessionEngagement) * 0.3 +
      (riskFactors.temporal.daysSinceLastSession > 7 ? 0.8 : 0.2) * 0.3

    if (compositeRisk >= 0.9 && urgencyScore >= 0.8) return 'within_hour'
    if (compositeRisk >= 0.75 && urgencyScore >= 0.6) return 'within_day'
    if (compositeRisk >= 0.5) return 'within_week'
    return 'within_month'
  }

  private calculateConfidence(...riskScores: number[]): number {
    const dataQuality = riskScores.length / 4 // Expecting 4 risk dimensions
    const consistency = 1 - this.calculateVariance(riskScores)
    const baseConfidence = 0.7

    return Math.min(
      0.95,
      Math.max(0.3, baseConfidence * dataQuality * consistency),
    )
  }

  private identifyPrimaryRiskFactors(
    _riskFactors: CrisisRiskFactors,
    _compositeRisk: number,
  ): string[] {
    const factors: string[] = []

    if (riskFactors.emotional.volatilityScore > 0.7) {
      factors.push('Emotional volatility and dysregulation')
    }
    if (riskFactors.behavioral.isolationIndicators > 5) {
      factors.push('Social isolation and withdrawal')
    }
    if (riskFactors.historical.previousCrises > 2) {
      factors.push('History of crisis episodes')
    }
    if (riskFactors.temporal.daysSinceLastSession > 14) {
      factors.push('Extended treatment gap')
    }

    return factors.slice(0, 3) // Return top 3 factors
  }

  private identifyProtectiveFactors(riskFactors: CrisisRiskFactors): string[] {
    const factors: string[] = []

    if (riskFactors.historical.supportSystemStrength > 0.7) {
      factors.push('Strong support system')
    }
    if (riskFactors.historical.treatmentCompliance > 0.8) {
      factors.push('Good treatment engagement')
    }
    if (riskFactors.behavioral.sessionEngagement > 0.7) {
      factors.push('Active therapy participation')
    }

    return factors
  }

  private calculateInterventionWindow(
    riskLevel: CrisisPrediction['riskLevel'],
    _timeframe: CrisisPrediction['timeframe'],
  ): CrisisPrediction['interventionWindow'] {
    const windows = {
      imminent: { optimal: 'Immediate', critical: 'Within 1 hour' },
      high: { optimal: 'Within 2 hours', critical: 'Within 6 hours' },
      moderate: { optimal: 'Within 24 hours', critical: 'Within 3 days' },
      low: { optimal: 'Within 3 days', critical: 'Within 1 week' },
      minimal: { optimal: 'Within 1 week', critical: 'Within 2 weeks' },
    }

    return windows[riskLevel] || windows.moderate
  }

  private generateEscalationTriggers(
    riskLevel: CrisisPrediction['riskLevel'],
    riskFactors: CrisisRiskFactors,
  ): string[] {
    const triggers: string[] = []

    if (riskLevel === 'imminent' || riskLevel === 'high') {
      triggers.push('Immediate clinical review required')
      triggers.push('Consider emergency intervention')
    }

    if (riskFactors.behavioral.isolationIndicators > 7) {
      triggers.push('Social isolation increasing - outreach needed')
    }

    if (riskFactors.temporal.daysSinceLastSession > 21) {
      triggers.push(
        'Extended absence from treatment - contact attempt required',
      )
    }

    return triggers
  }

  private calculateVariance(values: number[]): number {
    if (values.length <= 1) return 0

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2))
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length
  }

  private calculateHourlyRisk(
    baseRisk: number,
    temporalFactors: CrisisRiskFactors['temporal'],
  ): number {
    // Adjust for time of day
    const timeMultiplier =
      temporalFactors.timeOfDay >= 22 || temporalFactors.timeOfDay <= 6
        ? 1.3
        : 0.8
    return Math.min(1, baseRisk * timeMultiplier)
  }
}

export const predictiveCrisisModelingService =
  new PredictiveCrisisModelingService()
