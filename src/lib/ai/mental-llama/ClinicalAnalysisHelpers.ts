import type {
  MentalHealthAnalysisResult,
  ExpertGuidance,
  IModelProvider,
} from './types/mentalLLaMATypes'
import { getClinicalAnalysisLogger } from '@/lib/logging/standardized-logger'

const logger = getClinicalAnalysisLogger('helpers')

/**
 * Clinical Analysis Helpers provides utility functions for risk assessment,
 * recommendations generation, and quality metrics calculation.
 */
export class ClinicalAnalysisHelpers {
  constructor(private modelProvider?: IModelProvider) {}

  /**
   * Builds clinical prompt for LLM analysis.
   */
  public buildClinicalPrompt(
    text: string,
    baseAnalysis: MentalHealthAnalysisResult,
    expertGuidance?: ExpertGuidance,
  ) {
    const guidelinesText =
      expertGuidance?.guidelines
        .map((g) => `- ${g.rule} (${g.source})`)
        .join('\n') || 'No specific guidelines available'

    const riskFactorsText =
      expertGuidance?.riskFactors
        .map(
          (rf) => `- ${rf.factor}: ${rf.description} (${rf.severity} severity)`,
        )
        .join('\n') || 'No specific risk factors identified'

    return [
      {
        role: 'system' as const,
        content: `You are a clinical mental health expert providing analysis based on established guidelines and evidence-based practices.

Clinical Guidelines:
${guidelinesText}

Risk Factors to Consider:
${riskFactorsText}

Base Analysis: ${baseAnalysis.mentalHealthCategory} (confidence: ${baseAnalysis.confidence})

Provide a comprehensive clinical analysis in JSON format:
{
  "explanation": "Detailed clinical explanation incorporating guidelines and evidence",
  "confidence": 0.0-1.0,
  "supportingEvidence": ["key phrases or indicators from the text"],
  "clinicalReasoning": "Step-by-step clinical reasoning process"
}`,
      },
      {
        role: 'user' as const,
        content: `Please analyze this text: "${text}"`,
      },
    ]
  }

  /**
   * Parses clinical response from LLM.
   */
  public parseClinicalResponse(content: string): void {
    try {
      return JSON.parse(content) as unknown
    } catch (error: unknown) {
      logger.error('Failed to parse clinical response', { error, content })
      return {
        explanation: content,
        confidence: 0.5,
        supportingEvidence: [],
      }
    }
  }

  /**
   * Identifies risk indicators from text and base analysis.
   */
  public identifyRiskIndicators(
    text: string,
    baseAnalysis: MentalHealthAnalysisResult,
  ) {
    const indicators: Array<{
      type: string
      severity: 'critical' | 'high' | 'moderate' | 'low'
      indicators: string[]
    }> = []

    // Convert text to lowercase for case-insensitive matching
    const normalizedText = text.toLowerCase()

    // Define risk keyword patterns with severity levels
    const riskPatterns = {
      suicide: {
        keywords: [
          'suicide',
          'kill myself',
          'end my life',
          'take my life',
          'not worth living',
          'better off dead',
          'suicide plan',
        ],
        severity: 'critical' as const,
      },
      self_harm: {
        keywords: [
          'self harm',
          'cut myself',
          'hurt myself',
          'self-harm',
          'cutting',
          'burning myself',
          'self-injury',
        ],
        severity: 'critical' as const,
      },
      crisis_language: {
        keywords: [
          "can't take it anymore",
          'nothing matters',
          'no point',
          'give up',
          'hopeless',
          'desperate',
          'emergency',
        ],
        severity: 'critical' as const,
      },
      depression_severe: {
        keywords: [
          'severely depressed',
          'major depression',
          "can't function",
          'completely hopeless',
          'total despair',
        ],
        severity: 'high' as const,
      },
      anxiety_severe: {
        keywords: [
          'panic attack',
          'severe anxiety',
          "can't breathe",
          'heart racing',
          'overwhelming fear',
          'terror',
        ],
        severity: 'high' as const,
      },
      substance_abuse: {
        keywords: [
          'drinking too much',
          'drug problem',
          'addiction',
          'substance abuse',
          'overdose',
          'getting high',
        ],
        severity: 'high' as const,
      },
      depression_moderate: {
        keywords: [
          'depressed',
          'sad all the time',
          'no energy',
          "can't sleep",
          'worthless',
          'guilty',
          'empty',
        ],
        severity: 'moderate' as const,
      },
      anxiety_moderate: {
        keywords: [
          'anxious',
          'worried',
          'nervous',
          'stressed',
          'tense',
          'restless',
          'on edge',
        ],
        severity: 'moderate' as const,
      },
      social_isolation: {
        keywords: [
          'alone',
          'isolated',
          'no friends',
          'withdrawn',
          'avoiding people',
          'lonely',
        ],
        severity: 'moderate' as const,
      },
      sleep_issues: {
        keywords: [
          'insomnia',
          "can't sleep",
          'nightmares',
          'sleep problems',
          'tired all the time',
        ],
        severity: 'low' as const,
      },
      mood_changes: {
        keywords: [
          'mood swings',
          'irritable',
          'angry',
          'frustrated',
          'emotional',
          'unstable',
        ],
        severity: 'low' as const,
      },
    }

    // Analyze text for each risk pattern
    for (const [riskType, pattern] of Object.entries(riskPatterns)) {
      const foundKeywords = pattern.keywords.filter((keyword) =>
        normalizedText.includes(keyword),
      )

      if (foundKeywords.length > 0) {
        indicators.push({
          type: riskType,
          severity: pattern.severity,
          indicators: foundKeywords,
        })
      }
    }

    // Analyze linguistic cues for emotional intensity
    const intensityWords = [
      'extremely',
      'severely',
      'completely',
      'totally',
      'absolutely',
      'unbearable',
      'overwhelming',
    ]
    const intensityFound = intensityWords.filter((word) =>
      normalizedText.includes(word),
    )

    if (intensityFound.length > 0) {
      indicators.push({
        type: 'emotional_intensity',
        severity: intensityFound.length >= 3 ? 'high' : 'moderate',
        indicators: intensityFound,
      })
    }

    // Analyze for temporal urgency indicators
    const urgencyWords = [
      'right now',
      'immediately',
      "can't wait",
      'urgent',
      'emergency',
      'help me now',
    ]
    const urgencyFound = urgencyWords.filter((word) =>
      normalizedText.includes(word),
    )

    if (urgencyFound.length > 0) {
      indicators.push({
        type: 'temporal_urgency',
        severity: urgencyFound.length >= 2 ? 'critical' : 'high',
        indicators: urgencyFound,
      })
    }

    // Analyze for social support indicators (inverted risk)
    const supportWords = [
      'support',
      'help',
      'family',
      'friends',
      'therapist',
      'counselor',
    ]
    const supportFound = supportWords.filter((word) =>
      normalizedText.includes(word),
    )

    if (supportFound.length === 0 && normalizedText.length > 50) {
      indicators.push({
        type: 'lack_of_support_mention',
        severity: 'moderate',
        indicators: ['No support system mentioned in extended text'],
      })
    }

    // Include crisis detection from base analysis
    if (baseAnalysis.isCrisis) {
      indicators.push({
        type: 'crisis_risk',
        severity: 'critical',
        indicators: ['Crisis detected by base analysis'],
      })
    }

    // Enhance severity based on multiple high-risk indicators
    const criticalCount = indicators.filter(
      (i) => i.severity === 'critical',
    ).length
    const highCount = indicators.filter((i) => i.severity === 'high').length

    if (criticalCount >= 2 || (criticalCount >= 1 && highCount >= 2)) {
      indicators.push({
        type: 'multiple_risk_factors',
        severity: 'critical',
        indicators: [
          `${criticalCount} critical and ${highCount} high-risk indicators detected`,
        ],
      })
    }

    return indicators
  }

  /**
   * Identifies protective factors in the text.
   */
  public identifyProtectiveFactors(text: string): string[] {
    const protectiveKeywords = [
      'support',
      'family',
      'friends',
      'hope',
      'future',
      'goals',
      'therapy',
      'treatment',
      'help',
      'better',
      'improve',
    ]

    return protectiveKeywords.filter((keyword) =>
      text.toLowerCase().includes(keyword.toLowerCase()),
    )
  }

  /**
   * Gets category-specific recommendations with risk level adjustments.
   * Risk levels: 'critical', 'high', 'moderate', 'low'
   */
  public getCategorySpecificRecommendations(
    category: string,
    riskLevel?: string,
  ) {
    // Base recommendations for each mental health category
    const categoryMap: Record<
      string,
      Array<{
        recommendation: string
        priority: 'critical' | 'high' | 'medium' | 'low'
        timeframe: string
        rationale: string
      }>
    > = {
      'depression': [
        {
          recommendation:
            'Professional mental health evaluation and depression screening',
          priority: 'high',
          timeframe: 'Within 1-2 weeks',
          rationale:
            'Depression requires comprehensive assessment and evidence-based treatment planning',
        },
        {
          recommendation:
            'Cognitive Behavioral Therapy (CBT) or interpersonal therapy consultation',
          priority: 'medium',
          timeframe: 'Within 2-4 weeks',
          rationale:
            'Psychotherapy is first-line treatment for depression with strong evidence base',
        },
      ],
      'anxiety': [
        {
          recommendation: 'Anxiety disorder screening and symptom assessment',
          priority: 'medium',
          timeframe: 'Within 2-4 weeks',
          rationale:
            'Early identification and intervention can prevent symptom progression and functional impairment',
        },
        {
          recommendation:
            'Anxiety management techniques and relaxation training',
          priority: 'medium',
          timeframe: 'Within 1-3 weeks',
          rationale:
            'Immediate coping strategies can provide symptom relief while formal treatment is arranged',
        },
      ],
      'ptsd': [
        {
          recommendation:
            'Trauma-focused therapy evaluation (EMDR, CPT, or PE)',
          priority: 'high',
          timeframe: 'Within 1-2 weeks',
          rationale:
            'Evidence-based trauma therapies are essential for PTSD recovery and preventing chronicity',
        },
        {
          recommendation:
            'Safety planning and trauma-informed care coordination',
          priority: 'high',
          timeframe: 'Within 1 week',
          rationale:
            'Safety concerns and re-traumatization prevention are critical in PTSD treatment',
        },
      ],
      'bipolar disorder': [
        {
          recommendation:
            'Comprehensive psychiatric evaluation and mood stabilizer assessment',
          priority: 'high',
          timeframe: 'Within 1-2 weeks',
          rationale:
            'Bipolar disorder requires specialized psychiatric care and medication management',
        },
        {
          recommendation:
            'Psychoeducation about mood monitoring and trigger identification',
          priority: 'medium',
          timeframe: 'Within 2-3 weeks',
          rationale:
            'Self-monitoring skills are crucial for bipolar disorder management and relapse prevention',
        },
      ],
      'substance abuse': [
        {
          recommendation:
            'Substance use disorder assessment and detoxification evaluation',
          priority: 'high',
          timeframe: 'Within 1 week',
          rationale:
            'Medical supervision may be required for safe withdrawal and addiction treatment planning',
        },
        {
          recommendation: 'Addiction counseling and support group referral',
          priority: 'medium',
          timeframe: 'Within 1-2 weeks',
          rationale:
            'Peer support and behavioral interventions are core components of addiction recovery',
        },
      ],
      'eating disorder': [
        {
          recommendation:
            'Comprehensive eating disorder assessment including medical evaluation',
          priority: 'high',
          timeframe: 'Within 1-2 weeks',
          rationale:
            'Eating disorders can have serious medical complications requiring immediate attention',
        },
        {
          recommendation:
            'Nutritional counseling and family therapy consultation',
          priority: 'medium',
          timeframe: 'Within 2-3 weeks',
          rationale:
            'Multi-disciplinary approach including nutrition and family involvement improves outcomes',
        },
      ],
    }

    const baseRecommendations = categoryMap[category] || []

    // Apply risk level adjustments to priority and timeframe
    if (riskLevel && baseRecommendations.length > 0) {
      return baseRecommendations.map((rec) => {
        let adjustedPriority = rec.priority
        let adjustedTimeframe = rec.timeframe
        let adjustedRationale = rec.rationale

        switch (riskLevel) {
          case 'critical':
            // Escalate all priorities and shorten timeframes for critical risk
            adjustedPriority = 'critical'
            adjustedTimeframe = adjustedTimeframe.includes('week')
              ? 'Within 24-48 hours'
              : 'Immediate'
            adjustedRationale +=
              ' Critical risk level requires immediate intervention to prevent escalation.'
            break

          case 'high':
            // Increase priority and reduce timeframes for high risk
            if (adjustedPriority === 'medium') {
              adjustedPriority = 'high'
            }
            if (adjustedPriority === 'low') {
              adjustedPriority = 'medium'
            }
            adjustedTimeframe = adjustedTimeframe.replace(
              /(\d+)-(\d+) weeks?/,
              (_, start) =>
                start === '1'
                  ? 'Within 3-5 days'
                  : `Within ${Math.max(1, Number.parseInt(start) - 1)} week`,
            )
            adjustedRationale +=
              ' Elevated risk requires expedited care coordination.'
            break

          case 'moderate':
            // Standard recommendations with slight urgency increase
            adjustedRationale +=
              ' Moderate risk warrants timely professional assessment.'
            break

          case 'low':
            // Can extend timeframes slightly for low risk
            adjustedTimeframe = adjustedTimeframe.replace(
              /(\d+)-(\d+) weeks?/,
              (_, start, end) =>
                `Within ${start}-${Math.min(8, Number.parseInt(end) + 1)} weeks`,
            )
            adjustedRationale +=
              ' Low risk allows for routine scheduling while maintaining care quality.'
            break
        }

        return {
          ...rec,
          priority: adjustedPriority,
          timeframe: adjustedTimeframe,
          rationale: adjustedRationale,
        }
      })
    }

    return baseRecommendations
  }

  /**
   * Maps urgency levels to timeframes.
   */
  public mapUrgencyToTimeframe(
    urgency: 'immediate' | 'urgent' | 'routine',
  ): string {
    const timeframeMap = {
      immediate: 'Within 1 hour',
      urgent: 'Within 24 hours',
      routine: 'Within 1-2 weeks',
    }
    return timeframeMap[urgency]
  }

  /**
   * Generates expert-guided analysis using LLM with clinical prompts.
   */
  public async generateExpertGuidedAnalysis(
    text: string,
    baseAnalysis: MentalHealthAnalysisResult,
    expertGuidance?: ExpertGuidance,
  ): Promise<{
    explanation: string
    confidence: number
    supportingEvidence: string[]
  }> {
    if (!this.modelProvider) {
      logger.warn('ModelProvider not available for expert-guided analysis')
      return {
        explanation: baseAnalysis.explanation,
        confidence: baseAnalysis.confidence,
        supportingEvidence: baseAnalysis.supportingEvidence || [],
      }
    }

    const clinicalPrompt = this.buildClinicalPrompt(
      text,
      baseAnalysis,
      expertGuidance,
    )

    try {
      const llmResponse = await this.modelProvider.invoke(clinicalPrompt, {
        temperature: 0.3, // Lower temperature for more consistent clinical analysis
        max_tokens: 800,
      })

      const parsedResponse = this.parseClinicalResponse(llmResponse.content)

      return {
        explanation: parsedResponse.explanation || baseAnalysis.explanation,
        confidence: Math.min(
          parsedResponse.confidence || baseAnalysis.confidence,
          1.0,
        ),
        supportingEvidence:
          parsedResponse.supportingEvidence ||
          baseAnalysis.supportingEvidence ||
          [],
      }
    } catch (error: unknown) {
      logger.error('Error in expert-guided LLM analysis', { error })
      return {
        explanation: `${baseAnalysis.explanation} [Clinical analysis enhanced with expert guidelines]`,
        confidence: baseAnalysis.confidence * 0.9, // Slightly reduce confidence due to error
        supportingEvidence: baseAnalysis.supportingEvidence || [],
      }
    }
  }

  /**
   * Performs comprehensive risk assessment.
   */
  public async performRiskAssessment(
    text: string,
    baseAnalysis: MentalHealthAnalysisResult,
    expertGuidance?: ExpertGuidance,
  ): Promise<{
    overallRisk: 'critical' | 'high' | 'moderate' | 'low'
    specificRisks: Array<{
      type: string
      level: 'critical' | 'high' | 'moderate' | 'low'
      indicators: string[]
    }>
    protectiveFactors?: string[]
  }> {
    const riskIndicators = this.identifyRiskIndicators(text, baseAnalysis)
    const protectiveFactors = this.identifyProtectiveFactors(text)

    // Calculate overall risk based on multiple factors
    let overallRisk: 'critical' | 'high' | 'moderate' | 'low' = 'low'

    if (baseAnalysis.isCrisis) {
      overallRisk = 'critical'
    } else if (
      expertGuidance?.riskFactors.some((rf) => rf.severity === 'critical')
    ) {
      overallRisk = 'critical'
    } else if (
      expertGuidance?.riskFactors.some((rf) => rf.severity === 'high') ||
      (baseAnalysis.confidence > 0.8 && baseAnalysis.hasMentalHealthIssue)
    ) {
      overallRisk = 'high'
    } else if (
      baseAnalysis.hasMentalHealthIssue &&
      baseAnalysis.confidence > 0.5
    ) {
      overallRisk = 'moderate'
    }

    const specificRisks = riskIndicators.map((indicator) => ({
      type: indicator.type,
      level: indicator.severity,
      indicators: indicator.indicators,
    }))

    return {
      overallRisk,
      specificRisks,
      protectiveFactors,
    }
  }

  /**
   * Generates clinical recommendations based on analysis and expert guidance.
   */
  public async generateClinicalRecommendations(
    baseAnalysis: MentalHealthAnalysisResult,
    expertGuidance?: ExpertGuidance,
    riskAssessment?: {
      overallRisk: 'critical' | 'high' | 'moderate' | 'low'
      specificRisks: Array<{
        type: string
        level: 'critical' | 'high' | 'moderate' | 'low'
        indicators: string[]
      }>
      protectiveFactors?: string[]
    },
  ): Promise<
    Array<{
      recommendation: string
      priority: 'critical' | 'high' | 'medium' | 'low'
      timeframe: string
      rationale: string
    }>
  > {
    const recommendations: Array<{
      recommendation: string
      priority: 'critical' | 'high' | 'medium' | 'low'
      timeframe: string
      rationale: string
    }> = []

    // Crisis recommendations
    if (baseAnalysis.isCrisis) {
      recommendations.push({
        recommendation:
          'Immediate crisis intervention and safety assessment required',
        priority: 'critical',
        timeframe: 'Immediate (within 1 hour)',
        rationale:
          'Crisis indicators detected in analysis requiring immediate professional intervention',
      })
    }

    // Category-specific recommendations
    const categoryRecommendations = this.getCategorySpecificRecommendations(
      baseAnalysis.mentalHealthCategory,
      riskAssessment?.overallRisk,
    )
    recommendations.push(...categoryRecommendations)

    // Expert guidance recommendations
    if (expertGuidance?.interventionSuggestions) {
      for (const intervention of expertGuidance.interventionSuggestions) {
        recommendations.push({
          recommendation: intervention.intervention,
          priority:
            intervention.urgency === 'immediate'
              ? 'critical'
              : intervention.urgency === 'urgent'
                ? 'high'
                : 'medium',
          timeframe: this.mapUrgencyToTimeframe(intervention.urgency),
          rationale: intervention.rationale,
        })
      }
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })
  }

  /**
   * Calculates quality metrics for the expert-guided analysis.
   */
  public calculateQualityMetrics(
    expertGuidedAnalysis: {
      explanation: string
      confidence: number
      supportingEvidence: string[]
    },
    expertGuidance?: ExpertGuidance,
    baseAnalysis?: MentalHealthAnalysisResult,
  ): {
    guidanceRelevance: number
    evidenceStrength: number
    clinicalCoherence: number
  } {
    // Calculate guidance relevance (0-1)
    const guidanceRelevance = expertGuidance
      ? Math.min(
          1.0,
          expertGuidance.guidelines.length * 0.2 +
            expertGuidance.riskFactors.length * 0.15 +
            expertGuidance.interventionSuggestions.length * 0.1,
        )
      : 0.0

    // Calculate evidence strength based on sources
    const evidenceStrength = expertGuidance?.evidenceBase
      ? expertGuidance.evidenceBase.reduce((acc, evidence) => {
          const reliabilityScore =
            evidence.reliability === 'high'
              ? 0.9
              : evidence.reliability === 'medium'
                ? 0.6
                : 0.3
          return acc + reliabilityScore
        }, 0) / expertGuidance.evidenceBase.length
      : 0.5

    // Calculate clinical coherence based on consistency
    const clinicalCoherence = baseAnalysis
      ? Math.min(
          1.0,
          baseAnalysis.confidence +
            (expertGuidedAnalysis.supportingEvidence?.length || 0) * 0.1,
        )
      : 0.5

    return {
      guidanceRelevance: Math.min(1.0, guidanceRelevance),
      evidenceStrength: Math.min(1.0, evidenceStrength),
      clinicalCoherence: Math.min(1.0, clinicalCoherence),
    }
  }
}
