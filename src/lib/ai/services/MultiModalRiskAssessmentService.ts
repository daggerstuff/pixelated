import type { EmotionAnalysis } from '@/hooks/useEmotionDetection'

export interface BiometricData {
  heartRate?: number[]
  heartRateVariability?: number
  respiratoryRate?: number
  skinConductance?: number
  voiceStress?: number
  facialExpressions?: {
    happiness: number
    sadness: number
    anger: number
    fear: number
    surprise: number
    disgust: number
    neutral: number
  }
}

export interface BehavioralPatterns {
  sessionEngagement: {
    attentionSpan: number // minutes
    responseLatency: number // seconds
    interactionQuality: number // 0-1 scale
    verbalFluency: number // words per minute
  }
  communicationChanges: {
    wordCount: number
    sentimentScore: number
    emotionalIntensity: number
    topicCoherence: number
    selfDisclosureLevel: number
  }
  digitalFootprint: {
    appUsagePatterns: Record<string, number>
    sessionFrequency: number
    timeOfDayPreferences: number[]
    missedAppointments: number
  }
  socialIndicators: {
    socialWithdrawal: number // 0-1 scale
    supportSystemEngagement: number // 0-1 scale
    isolationBehaviors: string[]
    communicationFrequency: number
  }
}

export interface ClinicalData {
  assessmentScores: {
    phq9?: number
    gad7?: number
    pcl5?: number
    customScales?: Record<string, number>
  }
  medicationCompliance: {
    adherenceRate: number // 0-1 scale
    missedDoses: number
    sideEffects: string[]
    efficacyRating: number // 0-1 scale
  }
  therapeuticProgress: {
    goalAttainment: number // 0-1 scale
    skillUtilization: number // 0-1 scale
    insightDevelopment: number // 0-1 scale
    behavioralChanges: string[]
  }
  riskHistory: {
    previousCrises: Array<{
      date: string
      severity: string
      triggers: string[]
      interventions: string[]
      outcome: string
    }>
    protectiveFactorsHistory: string[]
    resilientFactors: string[]
  }
}

export interface ContextualFactors {
  environmental: {
    seasonalFactors: number // seasonal depression risk
    weatherImpact: number
    holidayProximity: number
    anniversaryDates: string[]
  }
  social: {
    familyStressors: number // 0-1 scale
    workStressors: number // 0-1 scale
    financialPressure: number // 0-1 scale
    relationshipChanges: string[]
  }
  life_events: {
    recentLosses: string[]
    majorTransitions: string[]
    traumaticEvents: string[]
    positiveEvents: string[]
  }
  temporal: {
    timeOfDay: number // 0-23 hours
    dayOfWeek: number // 0-6
    timeZone: string
    circadianPattern: number // deviation from normal pattern
  }
}

export interface IntegratedRiskProfile {
  compositeRiskScore: number // 0-1 scale
  riskLevel: 'minimal' | 'low' | 'moderate' | 'high' | 'imminent'
  confidence: number // 0-1 scale
  primaryContributors: Array<{
    source: 'emotional' | 'biometric' | 'behavioral' | 'clinical' | 'contextual'
    factor: string
    weight: number
    trend: 'improving' | 'stable' | 'deteriorating'
  }>
  recommendations: {
    immediate: string[]
    shortTerm: string[]
    longTerm: string[]
  }
  interventionPriority: Array<{
    intervention: string
    urgency: 'low' | 'medium' | 'high' | 'critical'
    efficacyPrediction: number
  }>
  monitoringFocus: string[]
}

export class MultiModalRiskAssessmentService {
  private readonly modalityWeights = {
    emotional: 0.25,
    biometric: 0.15,
    behavioral: 0.25,
    clinical: 0.25,
    contextual: 0.1,
  }

  private readonly riskThresholds = {
    minimal: 0.1,
    low: 0.25,
    moderate: 0.5,
    high: 0.75,
    imminent: 0.9,
  }

  /**
   * Integrate multiple modalities for comprehensive risk assessment
   */
  async assessIntegratedRisk(
    emotionalData: EmotionAnalysis[],
    biometricData?: BiometricData,
    behavioralData?: BehavioralPatterns,
    clinicalData?: ClinicalData,
    contextualData?: ContextualFactors,
    options?: {
      prioritizeRecent?: boolean
      includeHistoricalTrends?: boolean
      adjustForPersonalization?: boolean
    },
  ): Promise<IntegratedRiskProfile> {
    try {
      // Calculate individual modality scores
      const emotionalRisk = this.assessEmotionalRisk(emotionalData)
      const biometricRisk = biometricData
        ? this.assessBiometricRisk(biometricData)
        : 0.5
      const behavioralRisk = behavioralData
        ? this.assessBehavioralRisk(behavioralData)
        : 0.5
      const clinicalRisk = clinicalData
        ? this.assessClinicalRisk(clinicalData)
        : 0.5
      const contextualRisk = contextualData
        ? this.assessContextualRisk(contextualData)
        : 0.5

      // Apply temporal weighting if recent data should be prioritized
      const temporalWeights = options?.prioritizeRecent
        ? this.calculateTemporalWeights(emotionalData)
        : { recent: 1.0, historical: 1.0 }

      // Calculate composite risk score
      const compositeRiskScore = this.calculateCompositeRisk(
        emotionalRisk,
        biometricRisk,
        behavioralRisk,
        clinicalRisk,
        contextualRisk,
        temporalWeights,
      )

      // Determine risk level
      const riskLevel = this.determineRiskLevel(compositeRiskScore)

      // Calculate confidence based on data quality and consistency
      const confidence = this.calculateConfidence(
        emotionalRisk,
        biometricRisk,
        behavioralRisk,
        clinicalRisk,
        contextualRisk,
        {
          hasEmotional: emotionalData.length > 0,
          hasBiometric: !!biometricData,
          hasBehavioral: !!behavioralData,
          hasClinical: !!clinicalData,
          hasContextual: !!contextualData,
        },
      )

      // Identify primary contributors
      const primaryContributors = this.identifyPrimaryContributors(
        {
          emotional: emotionalRisk,
          biometric: biometricRisk,
          behavioral: behavioralRisk,
          clinical: clinicalRisk,
          contextual: contextualRisk,
        },
        {
          emotionalData,
          biometricData,
          behavioralData,
          clinicalData,
          contextualData,
        },
      )

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        riskLevel,
        primaryContributors,
        {
          emotionalData,
          biometricData,
          behavioralData,
          clinicalData,
          contextualData,
        },
      )

      // Determine intervention priorities
      const interventionPriority = this.prioritizeInterventions(
        riskLevel,
        primaryContributors,
        clinicalData,
      )

      // Define monitoring focus areas
      const monitoringFocus = this.defineMonitoringFocus(
        primaryContributors,
        riskLevel,
      )

      return {
        compositeRiskScore,
        riskLevel,
        confidence,
        primaryContributors,
        recommendations,
        interventionPriority,
        monitoringFocus,
      }
    } catch (error) {
      console.error('Error in multi-modal risk assessment:', error)

      // Fallback assessment
      return this.generateFallbackAssessment(emotionalData)
    }
  }

  /**
   * Assess emotional risk from emotion analysis data
   */
  private assessEmotionalRisk(emotionalData: EmotionAnalysis[]): number {
    if (emotionalData.length === 0) return 0.5

    // Recent emotional state (last 3 analyses)
    const recentEmotions = emotionalData.slice(-3)
    const avgIntensity =
      recentEmotions.reduce((sum, e) => sum + e.intensity, 0) /
      recentEmotions.length

    // High-risk emotions weight
    const highRiskEmotions = [
      'sadness',
      'anger',
      'fear',
      'despair',
      'hopelessness',
    ]
    const riskEmotionCount = recentEmotions.reduce((count, e) => {
      return (
        count +
        (highRiskEmotions.includes(e.primaryEmotion.toLowerCase()) ? 1 : 0)
      )
    }, 0)

    // Emotional volatility (variance in intensity)
    const intensities = emotionalData.slice(-10).map((e) => e.intensity)
    const volatility = this.calculateVariance(intensities)

    // Trend analysis (improving vs deteriorating)
    const trend = this.calculateEmotionalTrend(emotionalData.slice(-7))

    // Combine factors
    const intensityRisk = Math.min(avgIntensity / 100, 1.0) * 0.4
    const volatilityRisk = Math.min(volatility / 50, 1.0) * 0.3
    const riskEmotionRisk = (riskEmotionCount / recentEmotions.length) * 0.2
    const trendRisk = trend < 0 ? Math.abs(trend) * 0.1 : 0

    return Math.min(
      1.0,
      intensityRisk + volatilityRisk + riskEmotionRisk + trendRisk,
    )
  }

  /**
   * Assess biometric risk indicators
   */
  private assessBiometricRisk(biometricData: BiometricData): number {
    let riskScore = 0
    let factorCount = 0

    // Heart rate variability (lower HRV indicates higher stress)
    if (biometricData.heartRateVariability !== undefined) {
      const hrvRisk = Math.max(
        0,
        (50 - biometricData.heartRateVariability) / 50,
      )
      riskScore += hrvRisk * 0.25
      factorCount++
    }

    // Elevated resting heart rate
    if (biometricData.heartRate && biometricData.heartRate.length > 0) {
      const avgHeartRate =
        biometricData.heartRate.reduce((a, b) => a + b, 0) /
        biometricData.heartRate.length
      const hrRisk =
        avgHeartRate > 90 ? Math.min((avgHeartRate - 70) / 50, 1.0) : 0
      riskScore += hrRisk * 0.2
      factorCount++
    }

    // Skin conductance (higher values indicate stress/arousal)
    if (biometricData.skinConductance !== undefined) {
      const scRisk = Math.min(biometricData.skinConductance / 10, 1.0)
      riskScore += scRisk * 0.15
      factorCount++
    }

    // Voice stress analysis
    if (biometricData.voiceStress !== undefined) {
      riskScore += Math.min(biometricData.voiceStress, 1.0) * 0.2
      factorCount++
    }

    // Facial expression analysis
    if (biometricData.facialExpressions) {
      const negativeEmotions =
        biometricData.facialExpressions.sadness +
        biometricData.facialExpressions.anger +
        biometricData.facialExpressions.fear
      const faceRisk = Math.min(negativeEmotions / 3, 1.0)
      riskScore += faceRisk * 0.2
      factorCount++
    }

    return factorCount > 0 ? riskScore : 0.5
  }

  /**
   * Assess behavioral risk patterns
   */
  private assessBehavioralRisk(behavioralData: BehavioralPatterns): number {
    // Session engagement decline
    const engagementRisk =
      Math.max(0, 1 - behavioralData.sessionEngagement.interactionQuality) *
      0.25

    // Communication pattern changes
    const communicationRisk =
      (Math.max(0, 1 - behavioralData.communicationChanges.sentimentScore) *
        0.4 +
        Math.max(0, 1 - behavioralData.communicationChanges.topicCoherence) *
        0.3 +
        (behavioralData.communicationChanges.wordCount < 50 ? 0.3 : 0)) *
      0.25

    // Social withdrawal indicators
    const socialRisk =
      (behavioralData.socialIndicators.socialWithdrawal * 0.5 +
        Math.max(
          0,
          1 - behavioralData.socialIndicators.supportSystemEngagement,
        ) *
        0.3 +
        Math.min(behavioralData.digitalFootprint.missedAppointments / 5, 1.0) *
        0.2) *
      0.25

    // App usage pattern disruption
    const digitalRisk =
      (Math.max(0, 1 - behavioralData.digitalFootprint.sessionFrequency / 7) *
        0.6 +
        (behavioralData.digitalFootprint.missedAppointments > 2 ? 0.4 : 0)) *
      0.25

    return Math.min(
      1.0,
      engagementRisk + communicationRisk + socialRisk + digitalRisk,
    )
  }

  /**
   * Assess clinical risk factors
   */
  private assessClinicalRisk(clinicalData: ClinicalData): number {
    let riskScore = 0
    let factorCount = 0

    // Assessment scores (higher scores indicate higher risk)
    if (clinicalData.assessmentScores.phq9 !== undefined) {
      riskScore += Math.min(clinicalData.assessmentScores.phq9 / 27, 1.0) * 0.3
      factorCount++
    }

    if (clinicalData.assessmentScores.gad7 !== undefined) {
      riskScore += Math.min(clinicalData.assessmentScores.gad7 / 21, 1.0) * 0.2
      factorCount++
    }

    if (clinicalData.assessmentScores.pcl5 !== undefined) {
      riskScore += Math.min(clinicalData.assessmentScores.pcl5 / 80, 1.0) * 0.2
      factorCount++
    }

    // Medication compliance
    const medicationRisk =
      Math.max(0, 1 - clinicalData.medicationCompliance.adherenceRate) * 0.15
    riskScore += medicationRisk
    factorCount++

    // Therapeutic progress (lack of progress indicates risk)
    const progressRisk =
      Math.max(0, 1 - clinicalData.therapeuticProgress.goalAttainment) * 0.1
    riskScore += progressRisk
    factorCount++

    // Historical crisis patterns
    const recentCrises = clinicalData.riskHistory.previousCrises.filter(
      (crisis) =>
        new Date(crisis.date) >
        new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
    )
    const historyRisk = Math.min(recentCrises.length / 3, 1.0) * 0.05
    riskScore += historyRisk
    factorCount++

    return factorCount > 0 ? riskScore : 0.5
  }

  /**
   * Assess contextual risk factors
   */
  private assessContextualRisk(contextualData: ContextualFactors): number {
    // Environmental factors
    const environmentalRisk =
      (contextualData.environmental.seasonalFactors * 0.4 +
        contextualData.environmental.holidayProximity * 0.3 +
        (contextualData.environmental.anniversaryDates.length > 0 ? 0.3 : 0)) *
      0.3

    // Social stressors
    const socialRisk =
      (contextualData.social.familyStressors * 0.4 +
        contextualData.social.workStressors * 0.3 +
        contextualData.social.financialPressure * 0.3) *
      0.4

    // Life events impact
    const lifeEventsRisk =
      (Math.min(contextualData.life_events.recentLosses.length / 3, 1.0) * 0.4 +
        Math.min(contextualData.life_events.traumaticEvents.length / 2, 1.0) *
        0.6) *
      0.2

    // Temporal factors (higher risk during vulnerable times)
    const temporalRisk =
      ((contextualData.temporal.timeOfDay >= 22 ||
        contextualData.temporal.timeOfDay <= 6
        ? 0.3
        : 0) +
        contextualData.temporal.circadianPattern * 0.2) *
      0.1

    return Math.min(
      1.0,
      environmentalRisk + socialRisk + lifeEventsRisk + temporalRisk,
    )
  }

  /**
   * Calculate composite risk score from all modalities
   */
  private calculateCompositeRisk(
    emotional: number,
    biometric: number,
    behavioral: number,
    clinical: number,
    contextual: number,
    temporalWeights: { recent: number; historical: number },
  ): number {
    const weightedScore =
      emotional * this.modalityWeights.emotional * temporalWeights.recent +
      biometric * this.modalityWeights.biometric * temporalWeights.recent +
      behavioral * this.modalityWeights.behavioral * temporalWeights.recent +
      clinical * this.modalityWeights.clinical * temporalWeights.historical +
      contextual * this.modalityWeights.contextual * temporalWeights.recent

    return Math.min(1.0, Math.max(0.0, weightedScore))
  }

  /**
   * Determine risk level from composite score
   */
  private determineRiskLevel(
    score: number,
  ): IntegratedRiskProfile['riskLevel'] {
    if (score >= this.riskThresholds.imminent) return 'imminent'
    if (score >= this.riskThresholds.high) return 'high'
    if (score >= this.riskThresholds.moderate) return 'moderate'
    if (score >= this.riskThresholds.low) return 'low'
    return 'minimal'
  }

  /**
   * Calculate confidence based on data availability and consistency
   */
  private calculateConfidence(...scores: number[]): number {
    const consistency =
      1 - this.calculateVariance(scores.filter((s) => s !== 0.5))
    const dataCompleteness =
      scores.filter((s) => s !== 0.5).length / scores.length

    return Math.min(0.95, Math.max(0.3, 0.7 * consistency * dataCompleteness))
  }

  /**
   * Identify primary contributors to risk
   */
  private identifyPrimaryContributors(
    scores: Record<string, number>,
    data: unknown,
  ): IntegratedRiskProfile['primaryContributors'] {
    const contributors = Object.entries(scores)
      .filter(([_, score]) => score > 0.4)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 3)
      .map(([source, weight]) => ({
        source: source as 'emotional' | 'biometric' | 'behavioral' | 'clinical' | 'contextual',
        factor: this.getTopFactorForSource(source, data),
        weight,
        trend: this.calculateTrendForSource(source, data),
      }))

    return contributors
  }

  /**
   * Generate tailored recommendations
   */
  private generateRecommendations(
    riskLevel: string,
    contributors: IntegratedRiskProfile['primaryContributors'],
    _data: unknown,
  ): IntegratedRiskProfile['recommendations'] {
    const recommendations = {
      immediate: [] as string[],
      shortTerm: [] as string[],
      longTerm: [] as string[],
    }

    if (riskLevel === 'imminent' || riskLevel === 'high') {
      recommendations.immediate.push('Immediate clinical evaluation required')
      recommendations.immediate.push('Activate crisis intervention protocol')
      recommendations.immediate.push('Ensure patient safety and supervision')
    }

    contributors.forEach((contributor) => {
      switch (contributor.source) {
        case 'emotional':
          recommendations.shortTerm.push(
            'Implement emotion regulation techniques',
          )
          recommendations.longTerm.push('Develop emotional coping strategies')
          break
        case 'behavioral':
          recommendations.shortTerm.push('Address social withdrawal patterns')
          recommendations.longTerm.push('Strengthen social support network')
          break
        case 'clinical':
          recommendations.immediate.push('Review medication regimen')
          recommendations.shortTerm.push('Intensify therapeutic interventions')
          break
      }
    })

    return recommendations
  }

  /**
   * Prioritize interventions based on risk profile
   */
  private prioritizeInterventions(
    riskLevel: string,
    contributors: IntegratedRiskProfile['primaryContributors'],
    _clinicalData: ClinicalData | undefined,
  ): IntegratedRiskProfile['interventionPriority'] {
    const interventions: IntegratedRiskProfile['interventionPriority'] = []

    if (riskLevel === 'imminent') {
      interventions.push({
        intervention: 'Emergency psychiatric evaluation',
        urgency: 'critical',
        efficacyPrediction: 0.9,
      })
    }

    if (riskLevel === 'high' || riskLevel === 'imminent') {
      interventions.push({
        intervention: 'Crisis stabilization',
        urgency: 'critical',
        efficacyPrediction: 0.85,
      })
    }

    contributors.forEach((contributor) => {
      if (contributor.source === 'clinical' && contributor.weight > 0.6) {
        interventions.push({
          intervention: 'Medication adjustment',
          urgency: 'high',
          efficacyPrediction: 0.7,
        })
      }
    })

    return interventions.slice(0, 5) // Top 5 priorities
  }

  /**
   * Define monitoring focus areas
   */
  private defineMonitoringFocus(
    contributors: IntegratedRiskProfile['primaryContributors'],
    riskLevel: string,
  ): string[] {
    const focus = ['Risk level changes', 'Crisis indicators']

    contributors.forEach((contributor) => {
      switch (contributor.source) {
        case 'emotional':
          focus.push('Emotional regulation patterns')
          break
        case 'behavioral':
          focus.push('Social engagement levels')
          break
        case 'clinical':
          focus.push('Treatment compliance')
          break
        case 'biometric':
          focus.push('Physiological stress indicators')
          break
      }
    })

    if (riskLevel === 'high' || riskLevel === 'imminent') {
      focus.push('Safety planning adherence')
      focus.push('Support system activation')
    }

    return [...new Set(focus)].slice(0, 6) // Remove duplicates, max 6 items
  }

  // Helper methods
  private calculateVariance(values: number[]): number {
    if (values.length <= 1) return 0
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2))
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length
  }

  private calculateTemporalWeights(emotionalData: EmotionAnalysis[]): {
    recent: number
    historical: number
  } {
    // More weight to recent data if there's enough historical context
    return emotionalData.length > 10
      ? { recent: 1.2, historical: 0.8 }
      : { recent: 1.0, historical: 1.0 }
  }

  private calculateEmotionalTrend(recentEmotions: EmotionAnalysis[]): number {
    if (recentEmotions.length < 2) return 0

    const intensities = recentEmotions.map((e) => e.intensity)
    const firstHalf = intensities.slice(0, Math.floor(intensities.length / 2))
    const secondHalf = intensities.slice(Math.floor(intensities.length / 2))

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length

    return (secondAvg - firstAvg) / 100 // Normalized change
  }

  private getTopFactorForSource(source: string, _data: unknown): string {
    // Simplified factor identification - would be more sophisticated in practice
    const factors = {
      emotional: 'High emotional intensity',
      biometric: 'Elevated stress indicators',
      behavioral: 'Social withdrawal patterns',
      clinical: 'Assessment score elevation',
      contextual: 'Environmental stressors',
    }
    return factors[source as keyof typeof factors] || 'Unknown factor'
  }

  private calculateTrendForSource(
    _source: string,
    _data: unknown,
  ): 'improving' | 'stable' | 'deteriorating' {
    // Simplified trend calculation - would analyze historical data in practice
    return Math.random() > 0.5 ? 'stable' : 'deteriorating'
  }

  private generateFallbackAssessment(
    emotionalData: EmotionAnalysis[],
  ): IntegratedRiskProfile {
    const fallbackRisk =
      emotionalData.length > 0
        ? Math.min(emotionalData.slice(-1)[0].intensity / 100, 0.8)
        : 0.5

    return {
      compositeRiskScore: fallbackRisk,
      riskLevel: fallbackRisk > 0.5 ? 'moderate' : 'low',
      confidence: 0.3,
      primaryContributors: [
        {
          source: 'emotional',
          factor: 'Limited data available',
          weight: fallbackRisk,
          trend: 'stable',
        },
      ],
      recommendations: {
        immediate: ['Gather more assessment data'],
        shortTerm: ['Complete comprehensive evaluation'],
        longTerm: ['Establish baseline monitoring'],
      },
      interventionPriority: [
        {
          intervention: 'Comprehensive assessment',
          urgency: 'medium',
          efficacyPrediction: 0.6,
        },
      ],
      monitoringFocus: ['Data collection', 'Baseline establishment'],
    }
  }
}

export const multiModalRiskAssessmentService =
  new MultiModalRiskAssessmentService()
