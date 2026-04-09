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

// Patient profile for AI analysis
export interface PatientProfile {
  id: string
  name: string
  age?: number
  gender?: string
  diagnosis?: string
  treatmentHistory?: string[]
  currentMedications?: string[]
  riskFactors?: string[]
  preferences?: Record<string, unknown>
}

// Intervention type for treatment
export interface Intervention {
  id: string
  type: 'therapy' | 'medication' | 'behavioral' | 'support'
  name: string
  description?: string
  startDate: Date
  endDate?: Date
  frequency?: string
  dosage?: string
  notes?: string[]
}

// Model performance metrics
export interface ModelMetrics {
  accuracy: number
  precision: number
  recall: number
  f1Score: number
  auc?: number
  loss?: number
  epoch?: number
  timestamp: Date
  inferenceTime?: number
  memoryUsage?: number
  privacyScore?: number
}

// Training configuration
export interface TrainingConfig {
  epochs: number
  batchSize: number
  learningRate: number
  optimizer: 'adam' | 'sgd' | 'rmsprop'
  lossFunction: string
  validationSplit?: number
  earlyStopping?: boolean
  patience?: number
}

// Real-time metrics for monitoring
export interface RealTimeMetrics {
  timestamp: Date
  cpuUsage: number
  memoryUsage: number
  latency: number
  throughput: number
  errorRate: number
  activeConnections: number
}

// Processing configuration
export interface ProcessingConfig {
  maxConcurrency: number
  timeout: number
  retryAttempts: number
  retryDelay: number
  batchSize: number
  queueSize: number
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
