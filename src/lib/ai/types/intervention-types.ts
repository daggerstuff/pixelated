/**
 * Intervention Analysis Types
 * Type definitions for intervention effectiveness analysis
 */

// Re-export from InterventionAnalysisService for consistency
export type {
  InterventionEffectivenessResult,
  InterventionContext,
  PatientResponse,
} from '../services/InterventionAnalysisService'

// Additional intervention-related types
export interface InterventionRecommendation {
  id: string
  type:
    | 'technique_adjustment'
    | 'duration_change'
    | 'approach_modification'
    | 'risk_mitigation'
  priority: 'low' | 'medium' | 'high' | 'critical'
  description: string
  rationale: string
  expectedOutcome: string
  implementationSteps: string[]
  timeframe: string
  confidence: number
}

export interface InterventionEffectivenessMetrics {
  shortTerm: {
    immediateResponse: number // 0-1 scale
    emotionalShift: number // -1 to 1 scale
    engagementLevel: number // 0-1 scale
  }
  mediumTerm: {
    sessionProgress: number // 0-1 scale
    skillAcquisition: number // 0-1 scale
    behaviorChange: number // 0-1 scale
  }
  longTerm: {
    sustainedImprovement: number // 0-1 scale
    relapsePrevention: number // 0-1 scale
    overallWellbeing: number // 0-1 scale
  }
}

export interface InterventionOutcome {
  interventionId: string
  sessionId: string
  timestamp: string
  effectiveness: InterventionEffectivenessResult
  metrics: InterventionEffectivenessMetrics
  followUpRequired: boolean
  notes?: string
}
