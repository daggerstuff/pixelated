// AI type definitions for Pixelated Empathy
// Strict typings aligned with privacyEngine usage

export interface SessionData {
  moodScore: number
  anxietyLevel: number
  stressLevel: number
  effectiveness?: number
  riskScore?: number
}

export interface PatientData {
  id: string
  name: string | null
  contact: string | null
  address: string | null
  sessionData: SessionData[]
  diagnosis?: string | null
  treatment?: string | null
  progress?: number
}

export interface ModelUpdateMetadata {
  aggregationStrategy?: 'fedavg' | 'fedprox' | 'scaffold'
  clientCount?: number
  timestamp?: number
  version?: string
  mu?: number
}

export interface ModelUpdate {
  weights: number[]
  metadata?: ModelUpdateMetadata
  privacyLevel?: 'low' | 'medium' | 'high'
  noiseAdded?: boolean
}

export interface DifferentialPrivacyMetrics {
  epsilon: number
  delta: number
  applied: boolean
}

export interface DataSanitizationMetrics {
  piiRemoved: boolean
  fieldsObfuscated: string[]
  noiseAdded: boolean
}

export interface FederatedLearningMetrics {
  enabled: boolean
  clientCount: number
  aggregationStrategy: 'fedavg' | 'fedprox' | 'scaffold'
}

export interface PrivacyMetrics {
  differentialPrivacy: DifferentialPrivacyMetrics
  dataSanitization: DataSanitizationMetrics
  federatedLearning: FederatedLearningMetrics
}
