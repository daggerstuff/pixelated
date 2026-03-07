import { EmotionState } from './emotional'
import {
  PatientPsiProfile,
  CulturalContext as PatientCulturalContext,
} from './patient-psi'

export interface SessionContext {
  currentState: EmotionState
  patientProfile: PatientPsiProfile
  conversationHistory: string[]
  historicalContext: SessionContext[]
  baselineState: EmotionState
  sessionDuration: number
  therapeuticAlliance: number
  crisisIndicators: string[]
  culturalContext?: PatientCulturalContext
  previousInterventions: any[]
  timestamp?: Date
}

export interface TherapeuticProgress {
  emotionalRegulation: number
  therapeuticAlliance: number
  treatmentEngagement: number
  crisisFrequency: number
  goalAchievement: number
  sessionConsistency: number
  goals: string[]
}

export interface InterventionContext {
  sessionId: string
  context: SessionContext
  progress: TherapeuticProgress
  interventionTiming: {
    shouldIntervene: boolean
    urgency: 'immediate' | 'soon' | 'routine' | 'monitor'
    recommendedApproach: string
    rationale: string
  }
  recommendations: string[]
  confidence: number
  timestamp: Date
}
