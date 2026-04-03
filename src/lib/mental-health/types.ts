/**
 * Shared types for mental health analysis and chat functionality
 */

export interface EnhancedMentalHealthAnalysis {
  timestamp: number
  category: 'low' | 'medium' | 'high' | 'critical'
  explanation: string
  expertGuided: boolean
  scores: Record<string, unknown>
  summary: string
  hasMentalHealthIssue: boolean
  confidence: number
  supportingEvidence: string[]
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  emotions?: string[]
  riskFactors?: string[]
}

// Archetype definitions inspired by Mind-Mirror
export interface ArchetypeResult {
  main_archetype: string
  confidence: number
  secondary_archetype?: string
  color: string
  description: string
}

export interface MoodVector {
  emotional_intensity: number
  cognitive_clarity: number
  energy_level: number
  social_connection: number
  coherence_index: number
  urgency_score: number
}

export interface MindMirrorAnalysis {
  archetype: ArchetypeResult
  mood_vector: MoodVector
  timestamp: number
  session_id: string
  insights: string[]
  recommendations: string[]
}
