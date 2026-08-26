/**
 * Explainability Types
 * Type definitions for AI response explainability:
 * confidence scores, source attribution, and technique attribution
 */

export type ExplainabilitySourceType =
  | 'llm'
  | 'fhe'
  | 'keyword-fallback'
  | 'neutral-baseline'
  | 'dimensional-model'
  | 'technique-classifier'
  | 'metadata'

export interface ExplainabilitySource {
  type: ExplainabilitySourceType
  reference: string
  confidenceContribution: number
  description?: string
  timestamp: string
}

export interface TechniqueAttribution {
  technique: string
  confidence: number
  reasoning: string[]
  alternatives?: Array<{
    technique: string
    confidence: number
  }>
  contraindications?: string[]
}

export interface ExplainabilityResult<T = unknown> {
  data: T
  confidence: number
  sources: ExplainabilitySource[]
  techniqueAttribution?: TechniqueAttribution
}

export interface ExplainabilityContext {
  provider: string
  modelVersion: string
  inputLength: number
  processingTime: number
  fallbackUsed: boolean
  neutralBaseline: boolean
  perEmotionConfidence?: Record<string, number>
}
