/**
 * Treatment recommendation helper functions — pure logic extracted from
 * RecommendationService.ts (no instance state).
 */

import type { TherapySession } from '../models/ai-types'
import type { MentalHealthAnalysisResult } from '../mental-llama/types/mentalLLaMATypes'
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

// Additional helper methods (implementation continues...)
export function mapUrgencyToPriority(
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

export function mapUrgencyToTimeframe(urgency: string): string {
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

export function identifyPrimaryConcerns(context: RecommendationContext): string[] {
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

export async function extractRiskIndicators(
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

export function assessFunctionalImpairment(context: RecommendationContext): string {
  // Assess functional impairment based on available data
  return context.clientProfile.currentStatus.functionalStatus || 'moderate'
}

export async function generatePersonalizedDescription(
  _base: Partial<TreatmentRecommendation>,
  _context: RecommendationContext,
  currentState: ClientState,
): Promise<string> {
  const concerns = currentState.primaryConcerns.join(' and ')
  return `This intervention addresses your ${concerns} and is tailored to your current situation and treatment goals.`
}

export async function selectAppropriateTechniques(
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

export function calculateEvidenceStrength(
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

export function identifySupportingPatterns(
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

export async function generatePersonalizedNarrative(
  _base: Partial<TreatmentRecommendation>,
  _context: RecommendationContext,
): Promise<string> {
  return `Based on your individual profile and current needs, this recommendation has been specifically tailored for you.`
}

export function generateExpectedOutcomes(
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

export function identifyRiskConsiderations(
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

export function generateProgressMetrics(
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

export function identifyCulturalAdaptations(profile: ClientProfile): string[] {
  return profile.demographics.culturalBackground ?? []
}

export function identifyIndividualAdaptations(
  context: RecommendationContext,
): string[] {
  return context.clientProfile.preferences.preferredModalities || []
}

export function identifyContraindications(
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

export function selectMeasurementTools(
  _recommendation: TreatmentRecommendation,
  _context: RecommendationContext,
): string[] {
  return ['PHQ-9', 'GAD-7', 'Session rating scales', 'Functional assessment']
}

export function determineCheckpointIntervals(
  recommendation: TreatmentRecommendation,
): string[] {
  switch (recommendation.priority) {
    case 'critical':
      return ['24 hours', '1 week', '2 weeks']
    case 'high':
      return ['1 week', '2 weeks', '4 weeks']
    case 'medium':
      return ['2 weeks', '4 weeks', '8 weeks']
    case "low": { throw new Error('Not implemented yet: "low" case') }
    default:
      return ['4 weeks', '8 weeks', '12 weeks']
  }
}

export function defineSuccessCriteria(
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

export async function generateCrisisRecommendations(
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

export async function selectTechniquesForIntervention(
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

export function calculateInterventionEvidenceStrength(
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

export function generateOutcomesForCategory(category: string): string[] {
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
    outcomeMap[category] ?? [
      'Symptom improvement',
      'Better functioning',
      'Enhanced well-being',
    ]
  )
}

export function getRiskConsiderationsForCategory(category: string): string[] {
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

  return riskMap[category] ?? ['Requires professional monitoring']
}

export function getAssessmentToolsForCategory(category: string): string[] {
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
    toolMap[category] ?? [
      'Standardized assessment scales',
      'Clinical interview',
    ]
  )
}
