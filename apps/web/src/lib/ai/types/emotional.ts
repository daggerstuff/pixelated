export interface EmotionState {
  primary: string
  intensity: number // 0-1 scale
  valence: number // -1 to 1 scale (negative to positive)
  arousal: number // 0-1 scale (calm to excited)
  secondary?: string[]
  confidence: number // 0-1 scale
  timestamp?: Date
}

export interface EmotionPattern {
  emotion: string
  frequency: number
  triggers: string[]
  intensityTrend: number[]
  avgIntensity: number
  stdDeviation: number
}

export enum CrisisLevel {
  CRITICAL = 5,
  HIGH = 4,
  MEDIUM = 3,
  LOW = 2,
  NONE = 1,
}

export interface CrisisIndicators {
  level: number
  indicators: string[]
  confidence: number
  recommendedAction: string
  urgency: 'immediate' | 'soon' | 'routine' | 'monitor'
}
