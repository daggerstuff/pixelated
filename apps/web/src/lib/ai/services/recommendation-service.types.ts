/**
 * Treatment recommendation types — extracted from RecommendationService.ts.
 */

import type { MentalHealthAnalysis } from '@/lib/chat'
import type { TherapySession } from '../models/ai-types'
import type { ExpertGuidance } from '../mental-llama/types/mentalLLaMATypes'

export interface ChatMessage {
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
