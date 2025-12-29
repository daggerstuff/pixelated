import { SessionContext } from '../types/context'

export interface ValidationResult {
  isValid: boolean
  confidence: number
  clinicalNotes: string[]
  recommendations: string[]
  riskAssessment: {
    level: 'low' | 'medium' | 'high' | 'critical'
    factors: string[]
    immediateActions: string[]
  }
}

export interface TherapistFeedback {
  sessionId: string
  therapistId: string
  accuracyRating: number // 1-5 scale
  helpfulnessRating: number // 1-5 scale
  clinicalNotes: string
  suggestedImprovements: string[]
  timestamp: Date
}

export class ClinicalValidator {
  private feedbackHistory: Map<string, TherapistFeedback[]> = new Map()
  private validationMetrics: Map<string, ValidationResult> = new Map()

  /**
   * Validate clinical accuracy of AI recommendations
   */
  async validateClinicalAccuracy(
    sessionId: string,
    context: SessionContext,
    aiRecommendations: string[],
    actualOutcome: string,
  ): Promise<ValidationResult> {
    const validation = await this.performValidation(
      context,
      aiRecommendations,
      actualOutcome,
    )
    this.validationMetrics.set(sessionId, validation)
    return validation
  }

  /**
   * Collect therapist feedback
   */
  async collectTherapistFeedback(
    sessionId: string,
    feedback: TherapistFeedback,
  ): Promise<void> {
    const sessionFeedback = this.feedbackHistory.get(sessionId) || []
    sessionFeedback.push(feedback)
    this.feedbackHistory.set(sessionId, sessionFeedback)
  }

  /**
   * Generate clinical validation report
   */
  async generateValidationReport(): Promise<{
    overallAccuracy: number
    therapistSatisfaction: number
    commonIssues: string[]
    improvementAreas: string[]
    recommendations: string[]
  }> {
    const allFeedback = Array.from(this.feedbackHistory.values()).flat()
    const allValidations = Array.from(this.validationMetrics.values())

    const overallAccuracy = this.calculateOverallAccuracy(allValidations)
    const therapistSatisfaction =
      this.calculateTherapistSatisfaction(allFeedback)
    const commonIssues = this.identifyCommonIssues(allFeedback)
    const improvementAreas = this.identifyImprovementAreas(
      allValidations,
      allFeedback,
    )
    const recommendations = this.generateRecommendations(
      allValidations,
      allFeedback,
    )

    return {
      overallAccuracy,
      therapistSatisfaction,
      commonIssues,
      improvementAreas,
      recommendations,
    }
  }

  /**
   * Perform detailed validation
   */
  private async performValidation(
    context: SessionContext,
    aiRecommendations: string[],
    actualOutcome: string,
  ): Promise<ValidationResult> {
    const clinicalNotes: string[] = []
    const recommendations: string[] = []

    // Validate against clinical guidelines
    const guidelineCompliance = this.checkClinicalGuidelines(
      context,
      aiRecommendations,
    )

    // Validate risk assessment accuracy
    const riskValidation = this.validateRiskAssessment(context, actualOutcome)

    // Validate therapeutic approach appropriateness
    const approachValidation = this.validateTherapeuticApproach(
      context,
      aiRecommendations,
    )

    // Calculate confidence score
    const confidence = this.calculateConfidence(
      guidelineCompliance,
      riskValidation,
      approachValidation,
    )

    // Generate clinical notes
    if (!guidelineCompliance.isCompliant) {
      clinicalNotes.push(
        `Guideline deviation: ${guidelineCompliance.deviation}`,
      )
    }

    if (riskValidation.missedRiskFactors.length > 0) {
      clinicalNotes.push(
        `Missed risk factors: ${riskValidation.missedRiskFactors.join(', ')}`,
      )
    }

    // Generate recommendations
    if (approachValidation.improvements.length > 0) {
      recommendations.push(...approachValidation.improvements)
    }

    return {
      isValid: confidence > 0.8,
      confidence,
      clinicalNotes,
      recommendations,
      riskAssessment: {
        level: riskValidation.assessedLevel,
        factors: riskValidation.riskFactors,
        immediateActions: riskValidation.immediateActions,
      },
    }
  }

  /**
   * Check compliance with clinical guidelines
   */
  private checkClinicalGuidelines(
    context: SessionContext,
    recommendations: string[],
  ): { isCompliant: boolean; deviation?: string } {
    const crisisLevel = this.assessCrisisLevel(context)

    // Check if crisis intervention is recommended when needed
    if (
      crisisLevel >= 4 &&
      !recommendations.some((r) => r.toLowerCase().includes('crisis'))
    ) {
      return {
        isCompliant: false,
        deviation: 'Crisis intervention not recommended for high-risk patient',
      }
    }

    // Check if therapeutic alliance is addressed
    if (
      context.therapeuticAlliance < 0.5 &&
      !recommendations.some((r) => r.toLowerCase().includes('alliance'))
    ) {
      return {
        isCompliant: false,
        deviation: 'Therapeutic alliance issues not addressed',
      }
    }

    return { isCompliant: true }
  }

  /**
   * Validate risk assessment
   */
  private validateRiskAssessment(
    context: SessionContext,
    actualOutcome: string,
  ): {
    assessedLevel: 'low' | 'medium' | 'high' | 'critical'
    riskFactors: string[]
    missedRiskFactors: string[]
    immediateActions: string[]
  } {
    const assessedLevel = this.assessCrisisLevel(context)
    const riskFactors = this.identifyRiskFactors(context)
    const missedRiskFactors: string[] = []

    // Analyze actual outcome vs predicted
    if (actualOutcome.toLowerCase().includes('crisis') && assessedLevel < 4) {
      missedRiskFactors.push('Crisis escalation')
    }

    const immediateActions = this.determineImmediateActions(
      assessedLevel,
      riskFactors,
    )

    return {
      assessedLevel,
      riskFactors,
      missedRiskFactors,
      immediateActions,
    }
  }

  /**
   * Validate therapeutic approach
   */
  private validateTherapeuticApproach(
    context: SessionContext,
    recommendations: string[],
  ): { isAppropriate: boolean; improvements: string[] } {
    const improvements: string[] = []

    // Check cultural sensitivity
    if (
      context.culturalContext &&
      !recommendations.some((r) => r.toLowerCase().includes('cultural'))
    ) {
      improvements.push('Consider cultural factors in therapeutic approach')
    }

    // Check patient communication style
    const style = context.patientProfile.communicationStyle.primary
    if (
      style === 'anxious' &&
      !recommendations.some((r) => r.toLowerCase().includes('validation'))
    ) {
      improvements.push(
        'Add validation techniques for anxious communication style',
      )
    }

    // Check for evidence-based interventions
    if (!recommendations.some((r) => this.isEvidenceBased(r))) {
      improvements.push('Include evidence-based therapeutic interventions')
    }

    return {
      isAppropriate: improvements.length === 0,
      improvements,
    }
  }

  /**
   * Assess crisis level
   */
  private assessCrisisLevel(
    context: SessionContext,
  ): 'low' | 'medium' | 'high' | 'critical' {
    const { currentState, crisisIndicators } = context

    let score = 0

    // Emotional intensity
    if (currentState.intensity > 0.8) score += 2
    else if (currentState.intensity > 0.6) score += 1

    // Valence (negative emotions)
    if (currentState.valence < -0.7) score += 2
    else if (currentState.valence < -0.5) score += 1

    // Crisis indicators
    score += crisisIndicators.length

    if (score >= 4) return 'critical'
    if (score >= 3) return 'high'
    if (score >= 2) return 'medium'
    return 'low'
  }

  /**
   * Identify risk factors
   */
  private identifyRiskFactors(context: SessionContext): string[] {
    const factors: string[] = []

    const { patientProfile, currentState } = context

    // Check patient risk factors
    if (patientProfile.riskFactors.suicideRisk > 0.7) {
      factors.push('High suicide risk')
    }

    if (patientProfile.riskFactors.selfHarm > 0.5) {
      factors.push('Self-harm history')
    }

    // Check emotional state
    if (currentState.intensity > 0.8 && currentState.valence < -0.7) {
      factors.push('Severe emotional distress')
    }

    return factors
  }

  /**
   * Determine immediate actions
   */
  private determineImmediateActions(
    level: 'low' | 'medium' | 'high' | 'critical',
    riskFactors: string[],
  ): string[] {
    const actions: string[] = []

    switch (level) {
      case 'critical':
        actions.push('Immediate crisis intervention')
        actions.push('Contact emergency services if needed')
        actions.push('Ensure patient safety')
        break
      case 'high':
        actions.push('Enhanced monitoring')
        actions.push('Crisis resources provided')
        actions.push('Safety planning')
        break
      case 'medium':
        actions.push('Risk assessment update')
        actions.push('Therapeutic intervention')
        break
      case 'low':
        actions.push('Continue routine monitoring')
        break
    }

    return actions
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    guidelineCompliance: { isCompliant: boolean; deviation?: string },
    riskValidation: any,
    approachValidation: { isAppropriate: boolean; improvements: string[] },
  ): number {
    let score = 1.0

    if (!guidelineCompliance.isCompliant) score -= 0.3
    if (riskValidation.missedRiskFactors.length > 0) score -= 0.2
    if (!approachValidation.isAppropriate) score -= 0.2

    return Math.max(0, score)
  }

  /**
   * Check if recommendation is evidence-based
   */
  private isEvidenceBased(recommendation: string): boolean {
    const evidenceBasedTerms = [
      'cognitive behavioral therapy',
      'cbt',
      'dialectical behavior therapy',
      'dbt',
      'mindfulness',
      'exposure therapy',
      'emotional regulation',
      'coping skills',
      'problem-solving therapy',
    ]

    return evidenceBasedTerms.some((term) =>
      recommendation.toLowerCase().includes(term),
    )
  }

  /**
   * Calculate overall accuracy
   */
  private calculateOverallAccuracy(validations: ValidationResult[]): number {
    if (validations.length === 0) return 0

    const validCount = validations.filter((v) => v.isValid).length
    return validCount / validations.length
  }

  /**
   * Calculate therapist satisfaction
   */
  private calculateTherapistSatisfaction(
    feedback: TherapistFeedback[],
  ): number {
    if (feedback.length === 0) return 0

    const avgAccuracy =
      feedback.reduce((sum, f) => sum + f.accuracyRating, 0) / feedback.length
    const avgHelpfulness =
      feedback.reduce((sum, f) => sum + f.helpfulnessRating, 0) /
      feedback.length

    return (avgAccuracy + avgHelpfulness) / 10 // Normalize to 0-1
  }

  /**
   * Identify common issues
   */
  private identifyCommonIssues(feedback: TherapistFeedback[]): string[] {
    const issues: string[] = []

    feedback.forEach((f) => {
      if (f.clinicalNotes.toLowerCase().includes('missed')) {
        issues.push('Risk factor detection')
      }
      if (f.clinicalNotes.toLowerCase().includes('inappropriate')) {
        issues.push('Therapeutic approach')
      }
      if (f.suggestedImprovements.length > 0) {
        issues.push('Recommendation refinement')
      }
    })

    return [...new Set(issues)] // Remove duplicates
  }

  /**
   * Identify improvement areas
   */
  private identifyImprovementAreas(
    validations: ValidationResult[],
    feedback: TherapistFeedback[],
  ): string[] {
    const areas: string[] = []

    // Analyze validation patterns
    const lowConfidenceValidations = validations.filter(
      (v) => v.confidence < 0.8,
    )
    if (lowConfidenceValidations.length > validations.length * 0.2) {
      areas.push('Confidence calibration')
    }

    // Analyze feedback patterns
    const commonSuggestions = this.analyzeCommonSuggestions(feedback)
    areas.push(...commonSuggestions)

    return [...new Set(areas)]
  }

  /**
   * Analyze common suggestions
   */
  private analyzeCommonSuggestions(feedback: TherapistFeedback[]): string[] {
    const suggestionCounts = new Map<string, number>()

    feedback.forEach((f) => {
      f.suggestedImprovements.forEach((suggestion) => {
        suggestionCounts.set(
          suggestion,
          (suggestionCounts.get(suggestion) || 0) + 1,
        )
      })
    })

    const sortedSuggestions = Array.from(suggestionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([suggestion]) => suggestion)

    return sortedSuggestions
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    validations: ValidationResult[],
    feedback: TherapistFeedback[],
  ): string[] {
    const recommendations: string[] = []

    // Based on validation patterns
    if (validations.some((v) => !v.isValid)) {
      recommendations.push('Review clinical guideline compliance')
    }

    // Based on feedback
    const commonIssues = this.identifyCommonIssues(feedback)
    if (commonIssues.includes('Risk factor detection')) {
      recommendations.push('Enhance risk factor identification algorithms')
    }

    if (commonIssues.includes('Therapeutic approach')) {
      recommendations.push('Refine therapeutic approach selection')
    }

    return recommendations
  }
}
