/**
 * Emotion Analysis Types
 * Comprehensive type definitions for emotion analysis and multidimensional mapping
 */

export interface EmotionAnalysis {
  id: string
  sessionId: string
  timestamp: string
  emotions: EmotionVector
  dimensions: EmotionDimensions
  confidence: number
  metadata?: EmotionMetadata
}

export interface EmotionVector {
  joy: number
  sadness: number
  anger: number
  fear: number
  surprise: number
  disgust: number
  trust: number
  anticipation: number
}

export interface EmotionDimensions {
  valence: number // Positive/negative emotional tone (-1 to 1)
  arousal: number // Activation level (0 to 1)
  dominance: number // Control/power level (-1 to 1)
}

export interface EmotionMetadata {
  source: 'text' | 'voice' | 'multimodal'
  processingTime: number
  modelVersion: string
  confidence: {
    overall: number
    perEmotion: Record<keyof EmotionVector, number>
  }
}

export interface DimensionalMap {
  timestamp: string
  dimensions: EmotionDimensions
  primaryEmotion: keyof EmotionVector
  intensity: number
  confidence: number
}

export interface MultidimensionalPattern {
  id: string
  type: 'trend' | 'cycle' | 'shift' | 'stability'
  timeRange: {
    start: string
    end: string
  }
  description: string
  dimensions: EmotionDimensions[]
  confidence: number
  significance: number
}

export interface TemporalEmotionData {
  sessionId: string
  timeSeriesData: EmotionAnalysis[]
  patterns: MultidimensionalPattern[]
  statistics: EmotionStatistics
}

export interface EmotionStatistics {
  mean: EmotionDimensions
  variance: EmotionDimensions
  trend: EmotionDimensions
  stability: number
  volatility: number
}

export interface EmotionMappingConfig {
  timeWindow: number // minutes
  samplingRate: number // samples per minute
  smoothingFactor: number
  dimensions: ('valence' | 'arousal' | 'dominance')[]
}

export interface EmotionCluster {
  id: string
  centroid: EmotionDimensions
  members: EmotionAnalysis[]
  radius: number
  significance: number
}

export interface EmotionTransition {
  from: EmotionDimensions
  to: EmotionDimensions
  duration: number // milliseconds
  intensity: number
  timestamp: string
}

export interface RiskFactor {
  id: string
  name: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
  description: string
  indicators: string[]
  timestamp: string
}

export interface Emotion {
  id: string
  name: string
  intensity: number
  confidence: number
  timestamp: string
  context?: string
}
