
import { getClinicalAnalysisLogger } from '@/lib/logging/standardized-logger'

import { ClinicalKnowledgeBase } from '../mental-llama/ClinicalKnowledgeBase'
import type {
  MentalHealthAnalysisResult,
  ExpertGuidedAnalysisResult,
} from '../mental-llama/types/mentalLLaMATypes'


const logger = getClinicalAnalysisLogger('general')

import type {
  TreatmentTechnique,
  SupportingPattern,
  TreatmentRecommendation,
  ClientProfile,
  ClientState,
  InterventionSuggestion,
  RecommendationContext,
  RecommendationOptions,
} from './recommendation-service.types'
import {
  mapUrgencyToPriority,
  mapUrgencyToTimeframe,
  identifyPrimaryConcerns,
  assessFunctionalImpairment,
  calculateEvidenceStrength,
  identifySupportingPatterns,
  generateExpectedOutcomes,
  identifyRiskConsiderations,
  generateProgressMetrics,
  identifyCulturalAdaptations,
  identifyIndividualAdaptations,
  identifyContraindications,
  selectMeasurementTools,
  determineCheckpointIntervals,
  defineSuccessCriteria,
  calculateInterventionEvidenceStrength,
  generateOutcomesForCategory,
  getRiskConsiderationsForCategory,
  getAssessmentToolsForCategory,
  extractRiskIndicators,
  generatePersonalizedDescription,
  selectAppropriateTechniques,
  generatePersonalizedNarrative,
  generateCrisisRecommendations,
  selectTechniquesForIntervention,
} from './recommendation-service.utils'

// Local type definitions

/**
 * Production-grade Treatment Recommendation Service
 * Provides evidence-based, personalized treatment recommendations using AI-driven analysis
 */
export class RecommendationService {
  private readonly knowledgeBase: ClinicalKnowledgeBase
  private readonly DEFAULT_VALID_DURATION = 14 * 24 * 60 * 60 * 1000 // 14 days in milliseconds

  constructor() {
    this.knowledgeBase = new ClinicalKnowledgeBase()

    logger.info('RecommendationService initialized')
  }

  /**
   * Main method to get comprehensive treatment recommendations for a client
   */
  async getRecommendations(
    clientId: string,
    context: RecommendationContext,
    options: RecommendationOptions = {},
  ): Promise<TreatmentRecommendation[]> {
    logger.info('Generating treatment recommendations', {
      clientId,
      contextKeys: Object.keys(context),
      options,
    })

    try {
      // Validate input
      this.validateRecommendationRequest(clientId, context)

      // Analyze current client state
      const currentState = await this.analyzeClientState(context)

      // Generate base recommendations from clinical knowledge
      const baseRecommendations =
        this.generateBaseRecommendations(currentState)

      // Personalize recommendations based on client profile and history
      const personalizedRecommendations = await this.personalizeRecommendations(
        baseRecommendations,
        context,
        currentState,
      )

      // Apply evidence-based filtering and prioritization
      const prioritizedRecommendations = this.prioritizeRecommendations(
        personalizedRecommendations,
        options,
      )

      // Add cultural and individual adaptations
      const adaptedRecommendations = await this.addAdaptations(
        prioritizedRecommendations,
        context,
      )

      // Generate progress metrics and tracking
      const finalRecommendations = this.addProgressMetrics(
        adaptedRecommendations,
        context,
      )

      // Apply final filtering based on options
      const filteredRecommendations = this.applyFilters(
        finalRecommendations,
        options,
      )

      logger.info('Recommendations generated successfully', {
        clientId,
        recommendationCount: filteredRecommendations.length,
        priorities: filteredRecommendations.map((r) => r.priority),
      })

      return filteredRecommendations
    } catch (error: unknown) {
      logger.error('Error generating recommendations', { clientId, error })
      return this.getFallbackRecommendations(context)
    }
  }

  /**
   * Get recommendations based on specific mental health analysis result
   */
  async getRecommendationsFromAnalysis(
    clientId: string,
    analysis: MentalHealthAnalysisResult | ExpertGuidedAnalysisResult,
    clientProfile?: Partial<ClientProfile>,
  ): Promise<TreatmentRecommendation[]> {
    logger.info('Generating recommendations from analysis', {
      clientId,
      category: analysis.mentalHealthCategory,
      isCrisis: analysis.isCrisis,
    })

    try {
      // Create minimal context from analysis
      const context: RecommendationContext = {
        clientProfile: this.createMinimalProfile(clientId, clientProfile),
        recentSessions: [],
        mentalHealthAnalyses: [],
        conversationHistory: [],
        treatmentGoals: ['symptom reduction', 'functional improvement'],
        ...('expertGuided' in analysis && analysis.expertGuidance
          ? { expertGuidance: analysis.expertGuidance }
          : {}),
      }

      // Generate category-specific recommendations
      const categoryRecommendations =
        this.knowledgeBase.getInterventionSuggestions(
          analysis.mentalHealthCategory,
          analysis,
        )

      // Convert to treatment recommendations
      const recommendations: TreatmentRecommendation[] = []

      for (const intervention of categoryRecommendations) {
        const recommendation = await this.createRecommendationFromIntervention(
          intervention,
          analysis,
        )
        recommendations.push(recommendation)
      }

      // Add crisis-specific recommendations if needed
      if (analysis.isCrisis) {
        const crisisRecommendations = await generateCrisisRecommendations(
          analysis,
          context,
        )
        recommendations.unshift(...crisisRecommendations)
      }

      return recommendations.slice(0, 5) // Limit to top 5 recommendations
    } catch (error: unknown) {
      logger.error('Error generating recommendations from analysis', {
        clientId,
        error,
      })
      return this.getFallbackRecommendations({
        clientProfile: this.createMinimalProfile(clientId, clientProfile),
        recentSessions: [],
        mentalHealthAnalyses: [],
        conversationHistory: [],
        treatmentGoals: [],
      })
    }
  }

  /**
   * Get quick recommendations for crisis situations
   */
  async getCrisisRecommendations(
    clientId: string,
    crisisContext: {
      riskLevel: 'high' | 'critical'
      crisisType: string
      immediateSupport: boolean
    },
  ): Promise<TreatmentRecommendation[]> {
    logger.warn('Generating crisis recommendations', {
      clientId,
      crisisContext,
    })

    const recommendations: TreatmentRecommendation[] = []
    const now = new Date()
    const validUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 hours

    // Immediate safety recommendation
    recommendations.push({
      id: `crisis-safety-${Date.now()}`,
      title: 'Immediate Safety Assessment and Planning',
      description:
        'Comprehensive safety evaluation and intervention to address immediate risk factors',
      priority: 'critical',
      techniques: [
        {
          id: 'safety-planning',
          name: 'Safety Planning',
          description:
            'Collaborative development of a personalized safety plan',
          category: 'behavioral',
          difficultyLevel: 'beginner',
          timeCommitment: '30-60 minutes',
          evidenceLevel: 'strong',
        },
      ],
      evidenceStrength: 0.95,
      supportingPatterns: [
        {
          type: 'risk_factor',
          category: 'crisis',
          description: 'Immediate risk indicators detected',
          severity: crisisContext.riskLevel,
          confidence: 0.9,
        },
      ],
      personalizedDescription:
        'Given the current crisis situation, immediate safety planning and professional intervention are essential.',
      validUntil: validUntil.toISOString(),
      timeframe: 'Immediate (within 1 hour)',
      rationale:
        'Crisis situations require immediate professional intervention to ensure safety and prevent harm',
      expectedOutcomes: [
        'Immediate safety',
        'Risk reduction',
        'Professional support connection',
      ],
      riskConsiderations: [
        'Requires immediate professional oversight',
        'May need emergency services',
      ],
      progressMetrics: {
        measurementTools: ['Safety plan completion', 'Risk assessment scores'],
        checkpointIntervals: ['Immediate', '2 hours', '24 hours'],
        successCriteria: [
          'Safety plan in place',
          'Professional support engaged',
          'Risk level reduced',
        ],
      },
      metadata: {
        generatedAt: now.toISOString(),
        basedOnSessions: [],
        clinicalContext: 'Crisis intervention',
        reviewRequired: true,
        lastUpdated: now.toISOString(),
      },
    })

    // Add professional support recommendation
    if (crisisContext.immediateSupport) {
      recommendations.push({
        id: `crisis-support-${Date.now()}`,
        title: 'Emergency Professional Support',
        description:
          'Immediate connection with qualified mental health crisis professionals',
        priority: 'critical',
        techniques: [
          {
            id: 'crisis-intervention',
            name: 'Crisis Intervention',
            description: 'Professional crisis intervention and support',
            category: 'interpersonal',
            difficultyLevel: 'advanced',
            timeCommitment: 'As needed',
            evidenceLevel: 'strong',
          },
        ],
        evidenceStrength: 0.98,
        supportingPatterns: [
          {
            type: 'risk_factor',
            category: 'crisis',
            description:
              'High-risk crisis situation requiring professional intervention',
            severity: 'critical',
            confidence: 0.95,
          },
        ],
        personalizedDescription:
          'Professional crisis support is recommended to address the immediate situation and ensure safety.',
        validUntil: validUntil.toISOString(),
        timeframe: 'Immediate',
        rationale:
          'Professional crisis intervention provides essential expertise and resources for high-risk situations',
        expectedOutcomes: [
          'Immediate professional support',
          'Crisis de-escalation',
          'Safety planning',
        ],
        riskConsiderations: [
          'Requires qualified professional',
          'May involve emergency services',
        ],
        progressMetrics: {
          measurementTools: [
            'Professional contact established',
            'Crisis resolution status',
          ],
          checkpointIntervals: ['Immediate', '1 hour', '4 hours'],
          successCriteria: [
            'Professional support engaged',
            'Crisis stabilized',
            'Follow-up planned',
          ],
        },
        metadata: {
          generatedAt: now.toISOString(),
          basedOnSessions: [],
          clinicalContext: 'Crisis intervention - professional support',
          reviewRequired: true,
          lastUpdated: now.toISOString(),
        },
      })
    }

    return recommendations
  }

  /**
   * Validate recommendation request
   */
  private validateRecommendationRequest(
    clientId: string,
    context: RecommendationContext,
  ): void {
    if (!clientId || typeof clientId !== 'string') {
      throw new Error('Valid clientId is required')
    }

    if (!context || typeof context !== 'object') {
      throw new Error('Valid context is required')
    }

    if (!context.clientProfile) {
      throw new Error('Client profile is required in context')
    }

    if (!Array.isArray(context.treatmentGoals)) {
      throw new Error('Treatment goals must be provided as an array')
    }
  }

  /**
   * Analyze current client state based on context
   */
  private async analyzeClientState(
    context: RecommendationContext,
  ): Promise<ClientState> {
    // Combine recent analyses to understand current state
    const latestAnalysis = context.mentalHealthAnalyses?.[0]
    const riskIndicators =
      context.recentSessions.length > 0
        ? await extractRiskIndicators(context.recentSessions)
        : []

    return {
      primaryConcerns: identifyPrimaryConcerns(context),
      riskLevel:
        (latestAnalysis?.riskLevel ??
        context.clientProfile.currentStatus.riskLevel) ||
        'moderate',
      functionalImpairment: assessFunctionalImpairment(context),
      readinessForChange:
        context.clientProfile.currentStatus.treatmentMotivation,
      supportSystemStrength: context.clientProfile.currentStatus.supportSystem,
      riskIndicators,
      emergentIssues: context.emergentIssues ?? [],
    }
  }

  /**
   * Generate base recommendations from clinical knowledge
   */
  private generateBaseRecommendations(currentState: ClientState): Partial<TreatmentRecommendation>[] {
    const recommendations: Partial<TreatmentRecommendation>[] = []

    // Get recommendations for each primary concern
    for (const concern of currentState.primaryConcerns) {
      const categoryRecommendations =
        this.knowledgeBase.getInterventionSuggestions(concern, {
          hasMentalHealthIssue: true,
          mentalHealthCategory: concern,
          confidence: 0.8,
          explanation: '',
          isCrisis: currentState.riskLevel === 'critical',
          timestamp: new Date().toISOString(),
        })

      for (const intervention of categoryRecommendations) {
        recommendations.push({
          title: intervention.intervention,
          priority: mapUrgencyToPriority(intervention.urgency),
          rationale: intervention.rationale,
          timeframe: mapUrgencyToTimeframe(intervention.urgency),
        })
      }
    }

    return recommendations
  }

  /**
   * Personalize recommendations based on client profile and history
   */
  private async personalizeRecommendations(
    baseRecommendations: Partial<TreatmentRecommendation>[],
    context: RecommendationContext,
    currentState: ClientState,
  ) {
    const personalized: TreatmentRecommendation[] = []

    for (let i = 0; i < baseRecommendations.length; i++) {
      const base = baseRecommendations[i]
      if (!base) {
        continue
      }

      const id = `rec-${context.clientProfile.id}-${Date.now()}-${i}`

      // Create full recommendation with personalization
      const recommendation: TreatmentRecommendation = {
        id,
        title: base.title ?? 'Therapeutic Intervention',
        description: await generatePersonalizedDescription(
          base,
          context,
          currentState,
        ),
        priority: base.priority ?? 'medium',
        techniques: await selectAppropriateTechniques(base, context),
        evidenceStrength: calculateEvidenceStrength(base, context),
        supportingPatterns: identifySupportingPatterns(
          context,
          currentState,
        ),
        personalizedDescription: await generatePersonalizedNarrative(
          base,
          context,
        ),
        validUntil: new Date(
          Date.now() + this.DEFAULT_VALID_DURATION,
        ).toISOString(),
        timeframe: base.timeframe ?? 'Within 2-4 weeks',
        rationale:
          base.rationale ??
          'Evidence-based intervention for presenting concerns',
        expectedOutcomes: generateExpectedOutcomes(base, context),
        riskConsiderations: identifyRiskConsiderations(base, context),
        progressMetrics: generateProgressMetrics(base, context),
        metadata: {
          generatedAt: new Date().toISOString(),
          basedOnSessions: context.recentSessions.map((s) => s.sessionId ?? ''),
          clinicalContext: currentState.primaryConcerns.join(', '),
          reviewRequired:
            currentState.riskLevel === 'critical' ||
            currentState.riskLevel === 'high',
          lastUpdated: new Date().toISOString(),
        },
      }

      personalized.push(recommendation)
    }

    return personalized
  }

  /**
   * Prioritize recommendations based on clinical urgency and client needs
   */
  private prioritizeRecommendations(
    recommendations: TreatmentRecommendation[],
    options: RecommendationOptions,
  ): TreatmentRecommendation[] {
    // Sort by priority and evidence strength
    const prioritized = recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]

      if (priorityDiff !== 0) {
        return priorityDiff
      }

      // If same priority, sort by evidence strength
      return b.evidenceStrength - a.evidenceStrength
    })

    // Limit to max recommendations if specified
    const maxRecs = options.maxRecommendations ?? 10
    return prioritized.slice(0, maxRecs)
  }

  /**
   * Add cultural and individual adaptations
   */
  private async addAdaptations(
    recommendations: TreatmentRecommendation[],
    context: RecommendationContext,
  ): Promise<TreatmentRecommendation[]> {
    return recommendations.map((rec) => ({
      ...rec,
      adaptations: {
        culturalFactors: identifyCulturalAdaptations(
          context.clientProfile,
        ),
        individualNeeds: identifyIndividualAdaptations(context),
        contraindications: identifyContraindications(rec, context),
      },
    }))
  }

  /**
   * Add progress metrics and tracking
   */
  private addProgressMetrics(
    recommendations: TreatmentRecommendation[],
    context: RecommendationContext,
  ): TreatmentRecommendation[] {
    return recommendations.map((rec) => ({
      ...rec,
      progressMetrics: {
        measurementTools: selectMeasurementTools(rec, context),
        checkpointIntervals: determineCheckpointIntervals(rec),
        successCriteria: defineSuccessCriteria(rec, context),
      },
    }))
  }

  /**
   * Apply final filters based on options
   */
  private applyFilters(
    recommendations: TreatmentRecommendation[],
    options: RecommendationOptions,
  ): TreatmentRecommendation[] {
    let filtered = recommendations

    // Filter by priority if specified
    if (options.priorityFilter) {
      filtered = filtered.filter(
        (rec) => options.priorityFilter?.includes(rec.priority) ?? false,
      )
    }

    // Filter by technique category if specified
    if (options.techniqueFilter) {
      filtered = filtered.filter((rec) =>
        rec.techniques.some(
          (tech) => options.techniqueFilter?.includes(tech.category) ?? false,
        ),
      )
    }

    // Filter by evidence threshold if specified
    if (options.evidenceThreshold) {
      filtered = filtered.filter(
        (rec) => rec.evidenceStrength >= (options.evidenceThreshold ?? 0),
      )
    }

    return filtered
  }

  /**
   * Generate fallback recommendations for error cases
   */
  private getFallbackRecommendations(
    _context: Partial<RecommendationContext>,
  ): TreatmentRecommendation[] {
    logger.warn('Generating fallback recommendations')

    const now = new Date()
    return [
      {
        id: `fallback-${Date.now()}`,
        title: 'Comprehensive Assessment',
        description:
          'Initial comprehensive mental health assessment to establish treatment direction',
        priority: 'high' as const,
        techniques: [
          {
            id: 'assessment',
            name: 'Clinical Assessment',
            description: 'Structured clinical interview and assessment',
            category: 'interpersonal',
            difficultyLevel: 'beginner',
            timeCommitment: '60-90 minutes',
            evidenceLevel: 'strong',
          },
        ],
        evidenceStrength: 0.9,
        supportingPatterns: [
          {
            type: 'behavior',
            category: 'assessment_needed',
            description:
              'Comprehensive assessment required for treatment planning',
            confidence: 0.8,
          },
        ],
        personalizedDescription:
          'A comprehensive assessment will help establish the best treatment approach for your specific needs.',
        validUntil: new Date(
          now.getTime() + this.DEFAULT_VALID_DURATION,
        ).toISOString(),
        timeframe: 'Within 1-2 weeks',
        rationale:
          'Comprehensive assessment provides foundation for evidence-based treatment planning',
        expectedOutcomes: [
          'Clear treatment plan',
          'Identified goals',
          'Appropriate interventions',
        ],
        riskConsiderations: ['Requires professional evaluation'],
        progressMetrics: {
          measurementTools: ['Clinical interview', 'Standardized assessments'],
          checkpointIntervals: ['Initial assessment', '2 weeks'],
          successCriteria: ['Assessment completed', 'Treatment plan developed'],
        },
        metadata: {
          generatedAt: now.toISOString(),
          basedOnSessions: [],
          clinicalContext: 'Fallback recommendation',
          reviewRequired: true,
          lastUpdated: now.toISOString(),
        },
      },
    ]
  }

  // Helper methods for recommendation generation
  private createMinimalProfile(
    clientId: string,
    partialProfile?: Partial<ClientProfile>,
  ): ClientProfile {
    return {
      id: clientId,
      demographics: partialProfile?.demographics ?? {},
      clinicalHistory: partialProfile?.clinicalHistory ?? {},
      treatmentHistory: partialProfile?.treatmentHistory ?? {
        previousTherapies: [],
        effectiveInterventions: [],
        ineffectiveInterventions: [],
      },
      currentStatus: partialProfile?.currentStatus ?? {
        riskLevel: 'moderate',
        functionalStatus: 'unknown',
        supportSystem: 'moderate',
        treatmentMotivation: 'moderate',
      },
      preferences: partialProfile?.preferences ?? {
        preferredModalities: [],
      },
    }
  }

  private async createRecommendationFromIntervention(
    intervention: InterventionSuggestion,
    analysis: MentalHealthAnalysisResult,
  ): Promise<TreatmentRecommendation> {
    const now = new Date()

    return {
      id: `rec-${analysis.mentalHealthCategory}-${Date.now()}`,
      title: intervention.intervention,
      description: `Evidence-based intervention for ${analysis.mentalHealthCategory}`,
      priority: mapUrgencyToPriority(intervention.urgency),
      techniques: await selectTechniquesForIntervention(intervention),
      evidenceStrength:
        calculateInterventionEvidenceStrength(intervention),
      supportingPatterns: [
        {
          type: 'symptom',
          category: analysis.mentalHealthCategory,
          description: analysis.explanation,
          confidence: analysis.confidence,
        },
      ],
      personalizedDescription: `Based on your ${analysis.mentalHealthCategory} symptoms, ${intervention.intervention.toLowerCase()} is recommended.`,
      validUntil: new Date(
        now.getTime() + this.DEFAULT_VALID_DURATION,
      ).toISOString(),
      timeframe: mapUrgencyToTimeframe(intervention.urgency),
      rationale: intervention.rationale,
      expectedOutcomes: generateOutcomesForCategory(
        analysis.mentalHealthCategory,
      ),
      riskConsiderations: getRiskConsiderationsForCategory(
        analysis.mentalHealthCategory,
      ),
      progressMetrics: {
        measurementTools: getAssessmentToolsForCategory(
          analysis.mentalHealthCategory,
        ),
        checkpointIntervals: ['1 week', '2 weeks', '4 weeks'],
        successCriteria: [
          'Symptom reduction',
          'Improved functioning',
          'Goal achievement',
        ],
      },
      metadata: {
        generatedAt: now.toISOString(),
        basedOnSessions: [],
        clinicalContext: analysis.mentalHealthCategory,
        reviewRequired: analysis.isCrisis,
        lastUpdated: now.toISOString(),
      },
    }
  }

}
