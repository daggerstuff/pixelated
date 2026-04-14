/**
 * Behavioral analysis types and interfaces
 */

export interface BehavioralConfig {
  mlEnabled: boolean
  modelPath: string
  profileRetentionDays?: number
  anomalyThreshold?: number
  maxProfileEvents?: number
  enableRealTimeAnalysis?: boolean
  analysisBatchSize?: number
  confidenceThreshold?: number
}

export interface BehavioralProfile {
  userId: string
  eventCount: number
  updatedAt: Date
  typicalIPs: string[]
  typicalLoginHours: number[]
  riskScore?: number
  lastAnomalyDetected?: Date
  anomalyHistory?: AnomalyRecord[]
}

export interface AnomalyRecord {
  type: 'unusual_ip' | 'unusual_time' | 'unusual_behavior' | 'ml_anomaly'
  detail: string | number
  severity: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
  timestamp: Date
  metadata?: Record<string, unknown>
}

export interface ActivityEvent {
  userId: string
  timestamp: string
  ip?: string
  userAgent?: string
  action: string
  resource?: string
  metadata?: Record<string, unknown>
}

export interface AnomalyDetectionResult {
  userId: string
  anomalies: AnomalyRecord[]
  riskScore: number
  timestamp: Date
}

export interface MLAnomalyInput {
  features: number[]
  userId: string
  timestamp: Date
  context?: Record<string, unknown>
}

export interface MLAnomalyResult {
  userId: string
  anomalyScore: number
  featureContributions?: Record<string, number>
  timestamp: Date
  modelVersion?: string
}

export interface BehavioralAnalysisOptions {
  includeMLAnalysis?: boolean
  includeProfileAnalysis?: boolean
  includeTimeAnalysis?: boolean
  includeIPAnalysis?: boolean
  confidenceThreshold?: number
  maxResults?: number
}
