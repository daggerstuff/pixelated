/**
 * Type definitions for behavioral threat detection analyzers
 */

export interface SecurityEvent {
  userId: string
  sourceIp: string
  timestamp: Date
  eventType: string
  severity: string
  metadata?: Record<string, unknown>
}

export interface SpatialFeatures {
  ipDiversity: number
  geographicSpread: number
  mobilityPattern: number
  networkCharacteristics: NetworkCharacteristics
}

export interface NetworkCharacteristics {
  connectionType: string
  bandwidthEstimate: number
  latency: number
}

export interface TemporalFeatures {
  avgSessionDuration: number
  timeOfDayPreference: number
  dayOfWeekPattern: number[]
  activityFrequency: number
  sessionRegularity: number
  responseTimePattern: number[]
}
