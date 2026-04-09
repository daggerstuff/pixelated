/**
 * Core type definitions for mental health analysis and chat functionality
 */

// Core analysis types
export interface MentalHealthAnalysis {
  id?: string
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
  requiresIntervention?: boolean
  indicators?: HealthIndicator[]
  sentiment?: SentimentScore
  categories?: MentalHealthCategoryDetail[]
  recommendations?: string[]
}

// Health indicator interface for analyzer
export interface HealthIndicator {
  type: string
  severity: number
  evidence: string[]
  description: string
}

// Health indicator interface for monitoring
export interface HealthMonitorIndicator {
  name: string
  value: number
  threshold: number
  status: 'healthy' | 'warning' | 'critical'
  trend?: 'improving' | 'stable' | 'declining'
}

// Sentiment scoring
export interface SentimentScore {
  positive: number
  negative: number
  neutral: number
  overall: number
  confidence: number
}

// Mental health categories
export type MentalHealthCategory =
  | 'depression'
  | 'anxiety'
  | 'ptsd'
  | 'bipolar'
  | 'eating_disorder'
  | 'substance_use'
  | 'personality_disorder'
  | 'psychosis'
  | 'none'
  | 'unknown'

// Mental health category detail for analysis results
export interface MentalHealthCategoryDetail {
  name: string
  score: number
  confidence: number
  keywords: string[]
}

// Chat message interface
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  metadata?: Record<string, unknown>
}

// Therapeutic response
export interface TherapeuticResponse {
  content: string
  confidence: number
  intervention?: boolean
  techniques?: string[]
  riskLevel?: 'low' | 'medium' | 'high' | 'critical'
  suggestedFollowup?: string
}

// Analysis configuration
export interface AnalysisConfig {
  includeRiskAssessment: boolean
  includeEmotionDetection: boolean
  includeTechniqueRecognition: boolean
  sensitivity: 'low' | 'medium' | 'high'
  maxContextLength: number
}

// Enhanced mental health analysis
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
