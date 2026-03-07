import { getClinicalAnalysisLogger } from '@/lib/logging/standardized-logger'
import type {
  MentalHealthAnalysisResult,
  ExpertGuidedAnalysisResult,
  ExpertGuidance,
} from '../mental-llama/types/mentalLLaMATypes'
import type { TherapySession } from '../models/ai-types'
import type { MentalHealthAnalysis } from '@/lib/chat'
import { ClinicalKnowledgeBase } from '../mental-llama/ClinicalKnowledgeBase'

const logger = getClinicalAnalysisLogger('general')

// Local type definitions
interface ChatMessage {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: number
}
/**
 * Treatment Recommendation Service Types
 * Types and interfaces for treatment recommendation system
 */

export interface TreatmentTechnique {
  id: string
  name: string
  description: string
  category:
    | 'cognitive'
    | 'behavioral'
    | 'somatic'
    | 'mindfulness'
    | 'exposure'
    | 'interpersonal'
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced'
  timeCommitment: string
  evidenceLevel: 'low' | 'medium' | 'high' | 'strong'
  contraindications?: string[]
  prerequisites?: string[]
}

export interface SupportingPattern {
  type:
    | 'symptom'
    | 'behavior'
    | 'cognition'
    | 'emotion'
    | 'risk_factor'
    | 'protective_factor'
  category: string
  description: string
  severity?: 'low' | 'moderate' | 'high' | 'critical'
  frequency?: 'rare' | 'occasional' | 'frequent' | 'persistent'
  confidence: number
}

export interface TreatmentRecommendation {
  id: string
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  techniques: TreatmentTechnique[]
  evidenceStrength: number
  supportingPatterns: SupportingPattern[]
  personalizedDescription: string
  validUntil: string
  timeframe: string
  rationale: string
  expectedOutcomes: string[]
  riskConsiderations: string[]
  adaptations?: {
    culturalFactors: string[]
    individualNeeds: string[]
    contraindications: string[]
  }
  progressMetrics: {
    measurementTools: string[]
    checkpointIntervals: string[]
    successCriteria: string[]
  }
  metadata: {
    generatedAt: string
    basedOnSessions: string[]
    clinicalContext: string
    reviewRequired: boolean
    lastUpdated: string
  }
}

export interface ClientProfile {
  id: string
  demographics: {
    age?: number
    gender?: string
    culturalBackground?: string[]
    primaryLanguage?: string
  }
  clinicalHistory: {
    primaryDiagnosis?: string
    secondaryDiagnoses?: string[]
    currentMedications?: string[]
    allergies?: string[]
    traumaHistory?: boolean
    substanceUse?: string
  }
  treatmentHistory: {
    previousTherapies: string[]
    effectiveInterventions: string[]
    ineffectiveInterventions: string[]
    dropoutReasons?: string[]
  }
  currentStatus: {
    riskLevel: 'low' | 'moderate' | 'high' | 'critical'
    functionalStatus: string
    supportSystem: 'strong' | 'moderate' | 'limited' | 'absent'
    treatmentMotivation: 'low' | 'moderate' | 'high'
  }
  preferences: {
    preferredModalities: string[]
    sessionFrequency?: string
    therapistGender?: string
    religiousConsiderations?: string[]
  }
}

export interface ClientState {
  primaryConcerns: string[]
  riskLevel: 'low' | 'moderate' | 'high' | 'critical'
  functionalImpairment: string
  readinessForChange: 'low' | 'moderate' | 'high'
  supportSystemStrength: 'strong' | 'moderate' | 'limited' | 'absent'
  riskIndicators: string[]
  emergentIssues: string[]
}

export interface InterventionSuggestion {
  intervention: string
  urgency: 'immediate' | 'urgent' | 'routine'
  rationale: string
}

export interface RecommendationContext {
  clientProfile: ClientProfile
  recentSessions: TherapySession[]
  mentalHealthAnalyses: MentalHealthAnalysis[]
  conversationHistory: ChatMessage[]
  expertGuidance?: ExpertGuidance
  emergentIssues?: string[]
  treatmentGoals: string[]
  timeConstraints?: {
    urgency: 'immediate' | 'urgent' | 'standard' | 'maintenance'
    sessionAvailability: string
    duration: string
  }
}

export interface RecommendationOptions {
  maxRecommendations?: number
  priorityFilter?: ('low' | 'medium' | 'high' | 'critical')[]
  techniqueFilter?: (
    | 'cognitive'
    | 'behavioral'
    | 'somatic'
    | 'mindfulness'
    | 'exposure'
    | 'interpersonal'
  )[]
  evidenceThreshold?: number
  includeExperimental?: boolean
  culturalAdaptation?: boolean
  personalizedNarratives?: boolean
}

/**
 * Production-grade Treatment Recommendation Service
 * Provides evidence-based, personalized treatment recommendations using AI-driven analysis
 */
export class RecommendationService {
  private knowledgeBase: ClinicalKnowledgeBase
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
        await this.generateBaseRecommendations(currentState)

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
        const crisisRecommendations = await this.generateCrisisRecommendations(
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
        ? await this.extractRiskIndicators(context.recentSessions)
        : []

    return {
      primaryConcerns: this.identifyPrimaryConcerns(context),
      riskLevel:
        latestAnalysis?.riskLevel ||
        context.clientProfile.currentStatus.riskLevel ||
        'moderate',
      functionalImpairment: this.assessFunctionalImpairment(context),
      readinessForChange:
        context.clientProfile.currentStatus.treatmentMotivation,
      supportSystemStrength: context.clientProfile.currentStatus.supportSystem,
      riskIndicators,
      emergentIssues: context.emergentIssues || [],
    }
  }

  /**
   * Generate base recommendations from clinical knowledge
   */
  private async generateBaseRecommendations(currentState: ClientState): void {
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
          priority: this.mapUrgencyToPriority(intervention.urgency),
          rationale: intervention.rationale,
          timeframe: this.mapUrgencyToTimeframe(intervention.urgency),
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
        title: base.title || 'Therapeutic Intervention',
        description: await this.generatePersonalizedDescription(
          base,
          context,
          currentState,
        ),
        priority: base.priority || 'medium',
        techniques: await this.selectAppropriateTechniques(base, context),
        evidenceStrength: this.calculateEvidenceStrength(base, context),
        supportingPatterns: this.identifySupportingPatterns(
          context,
          currentState,
        ),
        personalizedDescription: await this.generatePersonalizedNarrative(
          base,
          context,
        ),
        validUntil: new Date(
          Date.now() + this.DEFAULT_VALID_DURATION,
        ).toISOString(),
        timeframe: base.timeframe || 'Within 2-4 weeks',
        rationale:
          base.rationale ||
          'Evidence-based intervention for presenting concerns',
        expectedOutcomes: this.generateExpectedOutcomes(base, context),
        riskConsiderations: this.identifyRiskConsiderations(base, context),
        progressMetrics: this.generateProgressMetrics(base, context),
        metadata: {
          generatedAt: new Date().toISOString(),
          basedOnSessions: context.recentSessions.map((s) => s.sessionId || ''),
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
    const maxRecs = options.maxRecommendations || 10
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
        culturalFactors: this.identifyCulturalAdaptations(
          context.clientProfile,
        ),
        individualNeeds: this.identifyIndividualAdaptations(context),
        contraindications: this.identifyContraindications(rec, context),
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
        measurementTools: this.selectMeasurementTools(rec, context),
        checkpointIntervals: this.determineCheckpointIntervals(rec),
        successCriteria: this.defineSuccessCriteria(rec, context),
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
      demographics: partialProfile?.demographics || {},
      clinicalHistory: partialProfile?.clinicalHistory || {},
      treatmentHistory: partialProfile?.treatmentHistory || {
        previousTherapies: [],
        effectiveInterventions: [],
        ineffectiveInterventions: [],
      },
      currentStatus: partialProfile?.currentStatus || {
        riskLevel: 'moderate',
        functionalStatus: 'unknown',
        supportSystem: 'moderate',
        treatmentMotivation: 'moderate',
      },
      preferences: partialProfile?.preferences || {
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
      priority: this.mapUrgencyToPriority(intervention.urgency),
      techniques: await this.selectTechniquesForIntervention(intervention),
      evidenceStrength:
        this.calculateInterventionEvidenceStrength(intervention),
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
      timeframe: this.mapUrgencyToTimeframe(intervention.urgency),
      rationale: intervention.rationale,
      expectedOutcomes: this.generateOutcomesForCategory(
        analysis.mentalHealthCategory,
      ),
      riskConsiderations: this.getRiskConsiderationsForCategory(
        analysis.mentalHealthCategory,
      ),
      progressMetrics: {
        measurementTools: this.getAssessmentToolsForCategory(
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

  // Additional helper methods (implementation continues...)
  private mapUrgencyToPriority(
    urgency: string,
  ): 'low' | 'medium' | 'high' | 'critical' {
    switch (urgency) {
      case 'immediate':
        return 'critical'
      case 'urgent':
        return 'high'
      case 'routine':
        return 'medium'
      default:
        return 'medium'
    }
  }

  private mapUrgencyToTimeframe(urgency: string): string {
    switch (urgency) {
      case 'immediate':
        return 'Within 24 hours'
      case 'urgent':
        return 'Within 1 week'
      case 'routine':
        return 'Within 2-4 weeks'
      default:
        return 'Within 2-4 weeks'
    }
  }

  private identifyPrimaryConcerns(context: RecommendationContext): string[] {
    const concerns: string[] = []

    // Extract from recent analyses
    if (context.mentalHealthAnalyses.length > 0) {
      context.mentalHealthAnalyses.forEach((analysis) => {
        if (analysis.category && !concerns.includes(analysis.category)) {
          concerns.push(analysis.category)
        }
      })
    }

    // Extract from clinical history
    if (context.clientProfile.clinicalHistory.primaryDiagnosis) {
      const diagnosis =
        context.clientProfile.clinicalHistory.primaryDiagnosis.toLowerCase()
      if (!concerns.some((c) => diagnosis.includes(c))) {
        concerns.push(diagnosis)
      }
    }

    return concerns.length > 0 ? concerns : ['general_mental_health']
  }

  private async extractRiskIndicators(
    sessions: TherapySession[],
  ): Promise<string[]> {
    // Analyze sessions for risk indicators
    const indicators: string[] = []

    sessions.forEach((session) => {
      if (session.aiAnalysis?.riskAssessment === 'high') {
        indicators.push('high_risk_session')
      }

      if (session.notes?.toLowerCase().includes('crisis')) {
        indicators.push('crisis_mention')
      }
    })

    return indicators
  }

  private assessFunctionalImpairment(context: RecommendationContext): string {
    // Assess functional impairment based on available data
    return context.clientProfile.currentStatus.functionalStatus || 'moderate'
  }

  private async generatePersonalizedDescription(
    _base: Partial<TreatmentRecommendation>,
    _context: RecommendationContext,
    currentState: ClientState,
  ): Promise<string> {
    const concerns = currentState.primaryConcerns.join(' and ')
    return `This intervention addresses your ${concerns} and is tailored to your current situation and treatment goals.`
  }

  private async selectAppropriateTechniques(
    _base: Partial<TreatmentRecommendation>,
    _context: RecommendationContext,
  ): Promise<TreatmentTechnique[]> {
    // Select appropriate techniques based on client profile and preferences
    const techniques: TreatmentTechnique[] = []

    // Default cognitive technique
    techniques.push({
      id: 'cognitive-restructuring',
      name: 'Cognitive Restructuring',
      description: 'Identifying and changing negative thought patterns',
      category: 'cognitive',
      difficultyLevel: 'intermediate',
      timeCommitment: '15-30 minutes daily',
      evidenceLevel: 'strong',
    })

    return techniques
  }

  private calculateEvidenceStrength(
    _base: Partial<TreatmentRecommendation>,
    context: RecommendationContext,
  ): number {
    // Calculate evidence strength based on various factors
    let strength = 0.7 // Base strength

    // Adjust based on client factors
    if (
      context.clientProfile.treatmentHistory.effectiveInterventions.length > 0
    ) {
      strength += 0.1
    }

    return Math.min(strength, 1.0)
  }

  private identifySupportingPatterns(
    _context: RecommendationContext,
    currentState: ClientState,
  ): SupportingPattern[] {
    const patterns: SupportingPattern[] = []

    // Add patterns from primary concerns
    currentState.primaryConcerns.forEach((concern: string) => {
      patterns.push({
        type: 'symptom',
        category: concern,
        description: `${concern} symptoms identified`,
        confidence: 0.8,
      })
    })

    return patterns
  }

  private async generatePersonalizedNarrative(
    _base: Partial<TreatmentRecommendation>,
    _context: RecommendationContext,
  ): Promise<string> {
    return `Based on your individual profile and current needs, this recommendation has been specifically tailored for you.`
  }

  private generateExpectedOutcomes(
    _base: Partial<TreatmentRecommendation>,
    _context: RecommendationContext,
  ): string[] {
    return [
      'Reduction in symptoms',
      'Improved daily functioning',
      'Enhanced coping skills',
      'Better emotional regulation',
    ]
  }

  private identifyRiskConsiderations(
    _base: Partial<TreatmentRecommendation>,
    context: RecommendationContext,
  ): string[] {
    const considerations: string[] = []

    if (context.clientProfile.currentStatus.riskLevel === 'high') {
      considerations.push(
        'Requires careful monitoring due to elevated risk level',
      )
    }

    return considerations
  }

  private generateProgressMetrics(
    _base: Partial<TreatmentRecommendation>,
    _context: RecommendationContext,
  ) {
    return {
      measurementTools: ['Standardized assessment scales', 'Session ratings'],
      checkpointIntervals: ['Weekly', 'Bi-weekly', 'Monthly'],
      successCriteria: [
        'Symptom improvement',
        'Functional gains',
        'Goal achievement',
      ],
    }
  }

  private identifyCulturalAdaptations(profile: ClientProfile): string[] {
    return profile.demographics.culturalBackground || []
  }

  private identifyIndividualAdaptations(
    context: RecommendationContext,
  ): string[] {
    return context.clientProfile.preferences.preferredModalities || []
  }

  private identifyContraindications(
    _recommendation: TreatmentRecommendation,
    context: RecommendationContext,
  ): string[] {
    const contraindications: string[] = []

    // Check against ineffective previous interventions
    context.clientProfile.treatmentHistory.ineffectiveInterventions.forEach(
      (intervention) => {
        contraindications.push(`Previously ineffective: ${intervention}`)
      },
    )

    return contraindications
  }

  private selectMeasurementTools(
    _recommendation: TreatmentRecommendation,
    _context: RecommendationContext,
  ): string[] {
    return ['PHQ-9', 'GAD-7', 'Session rating scales', 'Functional assessment']
  }

  private determineCheckpointIntervals(
    recommendation: TreatmentRecommendation,
  ): string[] {
    switch (recommendation.priority) {
      case 'critical':
        return ['24 hours', '1 week', '2 weeks']
      case 'high':
        return ['1 week', '2 weeks', '4 weeks']
      case 'medium':
        return ['2 weeks', '4 weeks', '8 weeks']
      default:
        return ['4 weeks', '8 weeks', '12 weeks']
    }
  }

  private defineSuccessCriteria(
    _recommendation: TreatmentRecommendation,
    _context: RecommendationContext,
  ): string[] {
    return [
      'Measurable symptom reduction',
      'Improved functioning in daily activities',
      'Achievement of identified treatment goals',
      'Enhanced quality of life measures',
    ]
  }

  private async generateCrisisRecommendations(
    _analysis: MentalHealthAnalysisResult,
    _context: RecommendationContext,
  ): Promise<TreatmentRecommendation[]> {
    return [
      {
        id: `crisis-${Date.now()}`,
        title: 'Immediate Crisis Intervention',
        description: 'Emergency intervention for crisis situation',
        priority: 'critical',
        techniques: [
          {
            id: 'crisis-intervention',
            name: 'Crisis Intervention',
            description: 'Immediate crisis support and safety planning',
            category: 'behavioral',
            difficultyLevel: 'advanced',
            timeCommitment: 'Immediate',
            evidenceLevel: 'strong',
          },
        ],
        evidenceStrength: 0.95,
        supportingPatterns: [
          {
            type: 'risk_factor',
            category: 'crisis',
            description: 'Crisis indicators detected',
            severity: 'critical',
            confidence: 0.9,
          },
        ],
        personalizedDescription:
          'Immediate professional intervention is recommended due to crisis indicators.',
        validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        timeframe: 'Immediate',
        rationale: 'Crisis situation requires immediate professional attention',
        expectedOutcomes: ['Immediate safety', 'Crisis stabilization'],
        riskConsiderations: ['Requires immediate professional oversight'],
        progressMetrics: {
          measurementTools: ['Safety assessment', 'Risk evaluation'],
          checkpointIntervals: ['Immediate', '2 hours', '24 hours'],
          successCriteria: ['Safety established', 'Crisis resolved'],
        },
        metadata: {
          generatedAt: new Date().toISOString(),
          basedOnSessions: [],
          clinicalContext: 'Crisis intervention',
          reviewRequired: true,
          lastUpdated: new Date().toISOString(),
        },
      },
    ]
  }

  private async selectTechniquesForIntervention(
    intervention: InterventionSuggestion,
  ): Promise<TreatmentTechnique[]> {
    // Default technique mapping
    return [
      {
        id: 'intervention-technique',
        name: intervention.intervention,
        description: 'Evidence-based therapeutic technique',
        category: 'cognitive',
        difficultyLevel: 'intermediate',
        timeCommitment: '30-60 minutes',
        evidenceLevel: 'high',
      },
    ]
  }

  private calculateInterventionEvidenceStrength(
    intervention: InterventionSuggestion,
  ): number {
    // Base evidence strength calculation
    switch (intervention.urgency) {
      case 'immediate':
        return 0.95
      case 'urgent':
        return 0.85
      case 'routine':
        return 0.75
      default:
        return 0.7
    }
  }

  private generateOutcomesForCategory(category: string): string[] {
    const outcomeMap: Record<string, string[]> = {
      depression: [
        'Improved mood',
        'Increased energy',
        'Better sleep',
        'Enhanced motivation',
      ],
      anxiety: [
        'Reduced worry',
        'Improved relaxation',
        'Better stress management',
        'Increased confidence',
      ],
      trauma: [
        'Reduced flashbacks',
        'Improved emotional regulation',
        'Better relationships',
        'Increased safety',
      ],
    }

    return (
      outcomeMap[category] || [
        'Symptom improvement',
        'Better functioning',
        'Enhanced well-being',
      ]
    )
  }

  private getRiskConsiderationsForCategory(category: string): string[] {
    const riskMap: Record<string, string[]> = {
      depression: [
        'Monitor for suicidal ideation',
        'Watch for worsening symptoms',
      ],
      anxiety: ['Monitor for panic attacks', 'Avoid overexposure'],
      trauma: [
        'Risk of re-traumatization',
        'Requires trauma-informed approach',
      ],
    }

    return riskMap[category] || ['Requires professional monitoring']
  }

  private getAssessmentToolsForCategory(category: string): string[] {
    const toolMap: Record<string, string[]> = {
      depression: [
        'PHQ-9',
        'Beck Depression Inventory',
        'Hamilton Depression Rating Scale',
      ],
      anxiety: [
        'GAD-7',
        'Beck Anxiety Inventory',
        'State-Trait Anxiety Inventory',
      ],
      trauma: ['PCL-5', 'CAPS-5', 'Trauma Symptom Inventory'],
    }

    return (
      toolMap[category] || [
        'Standardized assessment scales',
        'Clinical interview',
      ]
    )
  }
}
