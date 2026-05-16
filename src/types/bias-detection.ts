/**
 * Shared type definitions for bias detection system
 */

// Alert levels for bias detection
export type AlertLevel = 'low' | 'medium' | 'high' | 'critical'

// Alert status for tracking
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'dismissed'

// Base alert interface
export interface BiasAlert {
  alertId: string
  message: string
  level: AlertLevel
  timestamp: string | Date
  sessionId?: string
  type?: string
  acknowledged?: boolean
  status?: AlertStatus
}

// Dashboard variant with looser types for display
export type AlertItem = Omit<BiasAlert, 'level' | 'status'> & {
  level: string
  status?: string
}

// Bias score filter types
export type BiasScoreFilterLiteral = 'all' | 'low' | 'medium' | 'high'
export type BiasScoreFilter =
  | BiasScoreFilterLiteral
  | { min: number; max: number }

// Time range filter
export type TimeRange = '24h' | '7d' | '30d' | '90d' | 'custom'
