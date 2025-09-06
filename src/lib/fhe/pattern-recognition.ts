/**
 * Pattern Recognition Type Definitions
 * 
 * Exports core interfaces for temporal, cross-session, and risk pattern analytics,
 * used in FHE-powered pattern recognition and clinical AI analytics.
 */

export interface TrendPattern {
  id: string
  type: 'increasing' | 'decreasing' | 'cyclical' | 'spike' | 'drop' | string
  confidence: number
  startDate: Date
  endDate: Date
  indicators: string[]
  description?: string
}

export interface CrossSessionPattern {
  id: string
  type: string
  sessions: string[]
  description?: string
  confidence: number
  significance?: number
  strength?: number
  categories?: string[]
}

export interface RiskCorrelation {
  id: string
  type: string
  correlation: number
  factorA: string
  factorB: string
  description?: string
  confidence?: number
}