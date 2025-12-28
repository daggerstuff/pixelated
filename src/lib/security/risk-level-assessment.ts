/**
 * Risk Level Assessment Service
 *
 * Provides risk assessment capabilities for security and mental health monitoring.
 * This service evaluates various risk factors and determines appropriate risk levels
 * based on configurable thresholds.
 */

import { createBuildSafeLogger } from '../logging/build-safe-logger'

const logger = createBuildSafeLogger('risk-assessment')

/**
 * Risk level type
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

/**
 * Risk factor interface
 */
export interface RiskFactor {
  type: string
  severity: number
  confidence: number
  description?: string
}

/**
 * Risk assessment result
 */
export interface RiskAssessmentResult {
  level: RiskLevel
  score: number
  factors: RiskFactor[]
  requiresIntervention: boolean
  confidence: number
  timestamp: number
}

/**
 * Risk assessment options
 */
export interface RiskAssessmentOptions {
  sensitivityLevel?: 'low' | 'medium' | 'high'
  thresholds?: {
    low: number
    medium: number
    high: number
    critical: number
  }
  minConfidence?: number
}

/**
 * Default options for risk assessment
 */
const DEFAULT_OPTIONS: Required<RiskAssessmentOptions> = {
  sensitivityLevel: 'medium',
  thresholds: {
    low: 0.25,
    medium: 0.5,
    high: 0.7,
    critical: 0.85,
  },
  minConfidence: 0.6,
}

/**
 * Risk Level Assessment Service
 *
 * This service determines risk levels based on a variety of inputs and factors.
 * It includes configurable thresholds and sensitivity levels to adapt to different contexts.
 */
export class RiskLevelAssessmentService {
  private static instance: RiskLevelAssessmentService
  private options: Required<RiskAssessmentOptions>

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor(options: RiskAssessmentOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(
    options?: RiskAssessmentOptions,
  ): RiskLevelAssessmentService {
    if (!RiskLevelAssessmentService.instance) {
      RiskLevelAssessmentService.instance = new RiskLevelAssessmentService(
        options,
      )
    }
    return RiskLevelAssessmentService.instance
  }

  /**
   * Reconfigure the service with new options
   */
  public configure(options: RiskAssessmentOptions): void {
    this.options = { ...this.options, ...options }
    logger.info('Risk level assessment service reconfigured', {
      sensitivityLevel: this.options.sensitivityLevel,
      thresholds: this.options.thresholds,
    })
  }

  /**
   * Assess risk level based on risk factors
   *
   * @param factors Risk factors to evaluate
   * @returns Risk assessment result
   */
  public assessRiskLevel(factors: RiskFactor[]): RiskAssessmentResult {
    // Filter out factors with low confidence
    const validFactors = factors.filter(
      (f) => f.confidence >= this.options.minConfidence,
    )

    if (validFactors.length === 0) {
      return this.createDefaultAssessment('low')
    }

    // Calculate weighted risk score
    const totalScore = this.calculateWeightedRiskScore(validFactors)

    // Determine risk level based on thresholds adjusted by sensitivity
    const level = this.determineRiskLevel(totalScore)

    // Determine if intervention is required
    const requiresIntervention = level === 'high' || level === 'critical'

    // Calculate overall confidence
    const avgConfidence =
      validFactors.reduce((sum, f) => sum + f.confidence, 0) /
      validFactors.length

    return {
      level,
      score: totalScore,
      factors: validFactors,
      requiresIntervention,
      confidence: avgConfidence,
      timestamp: Date.now(),
    }
  }

  /**
   * Assess risk level from text analysis results
   *
   * @param analysisResults Analysis results containing text and detected patterns
   * @param detectedRiskFactors Directly detected risk factors
   * @returns Risk assessment result
   */
  public assessFromTextAnalysis(
    analysisResults: {
      text: string
      patterns?: { type: string; intensity: number; confidence: number }[]
    },
    detectedRiskFactors: RiskFactor[] = [],
  ): RiskAssessmentResult {
    // Combine directly detected factors with any derived from patterns
    const combinedFactors = [
      ...detectedRiskFactors,
      ...this.extractRiskFactorsFromPatterns(analysisResults.patterns || []),
    ]

    return this.assessRiskLevel(combinedFactors)
  }

  /**
   * Extract risk factors from detected patterns
   */
  private extractRiskFactorsFromPatterns(
    patterns: { type: string; intensity: number; confidence: number }[],
  ): RiskFactor[] {
    // Define high-risk pattern types
    const highRiskPatterns = [
      'suicidal_ideation',
      'self_harm',
      'violence',
      'abuse',
      'severe_depression',
      'psychosis',
      'substance_abuse',
      'critical_anxiety',
    ]

    // Define medium-risk pattern types
    const mediumRiskPatterns = [
      'moderate_depression',
      'anxiety',
      'social_isolation',
      'significant_stress',
      'grief',
      'sleep_disturbance',
      'eating_disorder',
    ]

    return patterns.map((pattern) => {
      let baseSeverity = pattern.intensity

      // Amplify severity for high-risk patterns
      if (highRiskPatterns.some((p) => pattern.type.includes(p))) {
        baseSeverity = Math.min(1, baseSeverity * 1.5)
      }

      // Slightly amplify severity for medium-risk patterns
      if (mediumRiskPatterns.some((p) => pattern.type.includes(p))) {
        baseSeverity = Math.min(1, baseSeverity * 1.2)
      }

      return {
        type: pattern.type,
        severity: baseSeverity,
        confidence: pattern.confidence,
      }
    })
  }

  /**
   * Calculate weighted risk score from factors
   */
  private calculateWeightedRiskScore(factors: RiskFactor[]): number {
    if (factors.length === 0) {
      return 0
    }

    // Get total weighted score
    let totalWeightedScore = 0
    let totalWeight = 0

    // Calculate weights based on factor types
    for (const factor of factors) {
      // Base weight is confidence * severity
      let weight = factor.confidence * factor.severity

      // Increase weight for critical factors
      if (this.isCriticalFactor(factor.type)) {
        weight *= 1.5
      }

      totalWeightedScore += factor.severity * weight
      totalWeight += weight
    }

    // Return normalized score (0-1)
    return totalWeight > 0 ? Math.min(1, totalWeightedScore / totalWeight) : 0
  }

  /**
   * Determine if a factor type is considered critical
   */
  private isCriticalFactor(type: string): boolean {
    const criticalTypes = [
      'suicidal',
      'self_harm',
      'violence',
      'abuse',
      'severe_depression',
      'psychosis',
    ]

    return criticalTypes.some((t) => type.toLowerCase().includes(t))
  }

  /**
   * Determine risk level based on score and thresholds
   */
  private determineRiskLevel(score: number): RiskLevel {
    const { thresholds, sensitivityLevel } = this.options

    // Adjust thresholds based on sensitivity
    const sensitivityFactor =
      sensitivityLevel === 'high' ? 0.8 : sensitivityLevel === 'low' ? 1.2 : 1

    const adjustedThresholds = {
      low: thresholds.low * sensitivityFactor,
      medium: thresholds.medium * sensitivityFactor,
      high: thresholds.high * sensitivityFactor,
      critical: thresholds.critical * sensitivityFactor,
    }

    // Determine level based on adjusted thresholds
    if (score >= adjustedThresholds.critical) {
      return 'critical'
    }
    if (score >= adjustedThresholds.high) {
      return 'high'
    }
    if (score >= adjustedThresholds.medium) {
      return 'medium'
    }
    return 'low'
  }

  /**
   * Create a default assessment when no valid factors are present
   */
  private createDefaultAssessment(level: RiskLevel): RiskAssessmentResult {
    return {
      level,
      score:
        level === 'low'
          ? 0.1
          : level === 'medium'
            ? 0.4
            : level === 'high'
              ? 0.65
              : 0.85,
      factors: [],
      requiresIntervention: level === 'high' || level === 'critical',
      confidence: 0.5,
      timestamp: Date.now(),
    }
  }
}

// Export singleton instance
export const riskLevelAssessment = RiskLevelAssessmentService.getInstance()
