export type { MultidimensionalPattern } from '../emotions/types'

// Progression analysis for temporal tracking
export interface ProgressionAnalysis {
  id: string
  sessionId: string
  timestamp: Date
  timeRange: {
    start: Date
    end: Date
  }
  progress: {
    overall: number
    domains: Record<string, number>
  }
  milestones: Array<{
    id: string
    name: string
    achieved: boolean
    timestamp?: Date
    progress: number
  }>
  predictions: {
    estimatedCompletion?: Date
    confidence: number
    factors: string[]
  }
  recommendations: string[]
}
