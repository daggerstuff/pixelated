// Types used by BiasDetectionEngine and tests

export interface BiasThresholdsConfig {
  warning: number
  high: number
  critical: number
}

export interface BiasLayerWeights {
  preprocessing: number
  modelLevel: number
  interactive: number
  evaluation: number
}

export interface BiasMetricsConfig {
  /**
   * Type definitions for the Pixelated Empathy Bias Detection Engine
   */

  // Python service configuration
  pythonServiceUrl?: string
  pythonServiceTimeout?: number

  // Detection thresholds
  thresholds?: {
    warning: number // 0.3 - Bias score above which warnings are issued
    high: number // 0.6 - Bias score indicating high bias
    critical: number // 0.8 - Bias score requiring immediate action
  }

  // Layer-specific weights for overall bias scoring
  layerWeights?: {
    preprocessing: number // Weight for preprocessing layer (default: 0.2)
    modelLevel: number // Weight for model-level analysis (default: 0.3)
    interactive: number // Weight for interactive analysis (default: 0.2)
    evaluation: number // Weight for evaluation layer (default: 0.3)
  }

  // Evaluation metrics to compute
  evaluationMetrics?: string[]

  // Configuration for different components
  metricsConfig?: BiasMetricsConfig
  alertConfig?: BiasAlertConfig
  reportConfig?: BiasReportConfig
  explanationConfig?: BiasExplanationConfig
  pythonServiceConfig?: PythonServiceConfig
  cacheConfig?: CacheConfig
  securityConfig?: SecurityConfig
  performanceConfig?: PerformanceConfig

  // HIPAA compliance settings
  hipaaCompliant?: boolean
  dataMaskingEnabled?: boolean
  auditLogging?: boolean
}

export type AlertLevel = 'low' | 'medium' | 'high' | 'critical'

export interface DataQualityMetrics {
  completeness: number
  consistency: number
  accuracy: number
  timeliness: number
  validity: number
  missingDataByDemographic: Record<string, number>
}

export interface FairnessMetrics {
  demographicParity: number
  equalizedOdds: number
  equalOpportunity: number
  calibration: number
  individualFairness: number
  counterfactualFairness: number
}

export interface PerformanceMetrics {
  accuracy: number
  precision: number
  recall: number
  f1Score: number
  auc: number
  calibrationError: number
  demographicBreakdown: Record<string, number>
}

export interface BiasDetectionConfig {
  pythonServiceUrl?: string
  pythonServiceTimeout?: number
  thresholds?: BiasThresholdsConfig
  layerWeights?: BiasLayerWeights
  evaluationMetrics?: string[]
  metricsConfig?: BiasMetricsConfig
  alertConfig?: BiasAlertConfig
  reportConfig?: BiasReportConfig
  explanationConfig?: BiasExplanationConfig
  pythonServiceConfig?: PythonServiceConfig
  cacheConfig?: CacheConfig
  securityConfig?: SecurityConfig
  performanceConfig?: PerformanceConfig
  hipaaCompliant?: boolean
  dataMaskingEnabled?: boolean
  auditLogging?: boolean
  // Batch processing defaults
  batchProcessingConfig?: {
    enabled?: boolean
    batchSize?: number
    maxBatchDelayMs?: number
    retryFailedBatches?: boolean
    maxRetryAttempts?: number
    backoffStrategy?: 'fixed' | 'exponential'
    enableDebug?: boolean
  }
  mlToolkitConfig?: {
    enabled?: boolean
    framework?: 'tensorflow' | 'pytorch' | 'scikit-learn'
    version?: string
    tensorflow?: { enabled?: boolean }
  }
}

export interface BiasMetricsConfig {
  dataQualityMetrics?: Partial<DataQualityMetrics>
  fairnessMetrics?: Partial<FairnessMetrics>
  performanceMetrics?: Partial<PerformanceMetrics>
  enableRealTimeMonitoring?: boolean
  metricsRetentionDays?: number
  aggregationIntervals?: string[] // ['1h', '1d', '1w', '1m']
  dashboardRefreshRate?: number // seconds
  exportFormats?: string[] // ['json', 'csv', 'pdf']
}

export interface BiasAlertConfig {
  alertLevel?: AlertLevel
  alertMessage?: string
  alertLevels?: string[]
  alertThresholds?: {
    low: number
    medium: number
    high: number
    critical: number
  }
  alertActions?: {
    low: string[]
    medium: string[]
    high: string[]
    critical: string[]
  }
  enableSlackNotifications?: boolean
  enableEmailNotifications?: boolean
  slackWebhookUrl?: string | undefined
  emailRecipients?: string[]
  alertCooldownMinutes?: number // Prevent alert spam
  escalationThresholds?: {
    criticalResponseTimeMinutes: number
    highResponseTimeMinutes: number
  }
}

export interface BiasReportConfig {
  reportTitle?: string
  reportDescription?: string
  reportFrequency?: 'daily' | 'weekly' | 'monthly'
  reportFormats?: ('json' | 'csv' | 'pdf')[]
  reportDestinations?: ('console' | 'email' | 's3')[]
  includeConfidentialityAnalysis?: boolean
  includeDemographicBreakdown?: boolean
  includeTemporalTrends?: boolean
  includeRecommendations?: boolean
  reportTemplate?: 'standard' | 'executive' | 'technical'
}

export interface BiasExplanationConfig {
  explanationTitle?: string
  explanationDescription?: string
  explanationMethods?: ('shap' | 'lime' | 'integrated-gradients')[]
  explanationThresholds?: {
    low: number
    medium: number
    high: number
    critical: number
  }
  explanationMethod?: 'shap' | 'lime' | 'integrated-gradients'
  maxFeatures?: number
  includeCounterfactuals?: boolean
  generateVisualization?: boolean
}

export interface PythonServiceConfig {
  host?: string
  port?: number
  timeout?: number
  retries?: number
  healthCheckInterval?: number
}

export interface CacheConfig {
  enabled?: boolean
  ttl?: number // milliseconds
  maxSize?: number
  compressionEnabled?: boolean
  compressionThreshold?: number
  enableDistributedCache?: boolean
}

export interface SecurityConfig {
  encryptionEnabled?: boolean
  auditLoggingEnabled?: boolean
  sessionTimeoutMs?: number
  maxSessionSizeMB?: number
  rateLimitPerMinute?: number
  // Note: secrets should come from secure env vars, not config
}

export interface PerformanceConfig {
  maxConcurrentAnalyses?: number
  analysisTimeoutMs?: number
  batchSize?: number
  enableMetrics?: boolean
}

export interface GroupPerformanceComparison {
  groupA: string
  groupB: string
  metric: string
  valueA: number
  valueB: number
  disparity: number
}

export interface TherapeuticSession {
  sessionId: string
  sessionDate: string
  participantDemographics: ParticipantDemographics
  scenario: TrainingScenario
  content: SessionContent
  aiResponses: AIResponse[]
  expectedOutcomes: ExpectedOutcome[]
  transcripts: SessionTranscript[]
  userInputs: string[]
  metadata: SessionMetadata
}

export interface ParticipantDemographics {
  age: string // Age group: '18-25', '26-35', etc.
  gender: string // 'male', 'female', 'non-binary', 'prefer-not-to-say'
  ethnicity: string // 'white', 'black', 'hispanic', 'asian', 'other'
  primaryLanguage: string // ISO language code
  socioeconomicStatus?: string // 'low', 'middle', 'high', 'not-specified'
  education?: string // Education level
  region?: string // Geographic region
  culturalBackground?: string[] // Cultural identifiers
  disabilityStatus?: string // Disability information (if relevant)
}

export interface TrainingScenario {
  scenarioId: string
  type:
    | 'depression'
    | 'anxiety'
    | 'trauma'
    | 'substance-abuse'
    | 'relationship-issues'
    | 'general-wellness'
}

export interface SessionContent {
  transcript: string
  aiResponses: string[]
  userInputs: string[]
  metadata?: Record<string, any>
}

export interface AIResponse {
  responseId: string
  text: string
  timestamp: Date
  metadata?: Record<string, any>
}

export interface ExpectedOutcome {
  outcomeId: string
  description: string
  achieved: boolean
}

export interface SessionTranscript {
  speaker: 'user' | 'therapist'
  text: string
  timestamp: Date
}

export interface SessionMetadata {
  sessionStartTime: Date
  sessionEndTime: Date
  location?: string
  device?: string
  tags?: string[]
}

export interface PreprocessingLayerResult {
  biasScore: number
  linguisticBias: {
    genderBiasScore: number
    racialBiasScore: number
    ageBiasScore: number
    culturalBiasScore: number
    biasedTerms: string[]
    sentimentAnalysis: {
      overallSentiment: number
      emotionalValence: number
      subjectivity: number
      demographicVariations: Record<string, number>
    }
  }
  representationAnalysis: {
    demographicDistribution: Record<string, number>
    underrepresentedGroups: string[]
    overrepresentedGroups: string[]
    diversityIndex: number
    intersectionalityAnalysis: any[]
  }
  dataQualityMetrics: DataQualityMetrics
  recommendations: string[]
}

export interface ModelLevelLayerResult {
  biasScore: number
  fairnessMetrics: FairnessMetrics
  performanceMetrics: PerformanceMetrics
  groupPerformanceComparison: GroupPerformanceComparison[]
  recommendations: string[]
}

export interface InteractiveLayerResult {
  biasScore: number
  counterfactualAnalysis: {
    scenariosAnalyzed: number
    biasDetected: boolean
    consistencyScore: number
    problematicScenarios: any[]
  }
  featureImportance: any[]
  whatIfScenarios: any[]
  recommendations: string[]
}

export interface EvaluationLayerResult {
  biasScore: number
  huggingFaceMetrics: {
    toxicity: number
    bias: number
    regard: Record<string, number>
    stereotype: number
    fairness: number
  }
  customMetrics: {
    therapeuticBias: number
    culturalSensitivity: number
    professionalEthics: number
    patientSafety: number
  }
  temporalAnalysis: {
    trendDirection: 'stable' | 'increasing' | 'decreasing'
    changeRate: number
    seasonalPatterns: any[]
    interventionEffectiveness: any[]
  }
  recommendations: string[]
}

export interface BiasAnalysisResult {
  sessionId: string
  overallBiasScore: number
  alertLevel: AlertLevel
  confidence: number
  layerResults: {
    preprocessing: Partial<PreprocessingLayerResult>
    modelLevel: Partial<ModelLevelLayerResult>
    interactive: Partial<InteractiveLayerResult>
    evaluation: Partial<EvaluationLayerResult>
  }
  recommendations: string[]
  demographics?: ParticipantDemographics
  error?: string
}

export interface DashboardData {
  summary: {
    totalSessions: number
    averageBiasScore: number
    alerts: Record<AlertLevel, number>
  }
  trends: {
    time: string
    biasScore: number
  }[]
  alerts: {
    sessionId: string
    timestamp: string
    level: AlertLevel
    biasScore: number
  }[]
  demographics: {
    [key: string]: {
      [value: string]: {
        count: number
        averageBias: number
      }
    }
  }
}

export interface SessionData {
  sessionId: string
  sessionDate: string
  sessionDuration: number
  sessionType: string
  sessionNotes: string
  sessionData: {
    transcript: string
    metadata: {
      age: string
      gender: string
      race: string
      language: string
    }
  }
  participantDemographics?: ParticipantDemographics
  content?: SessionContent
}

// Define CacheEntry type
export interface CacheEntry<T = any> {
  key: string
  value: T
  timestamp: Date
  expiresAt: Date
  accessCount: number
  lastAccessed: Date
  tags: string[]
}

// Define CacheStats type
export interface CacheStats {
  totalEntries: number
  hitRate: number
  missRate: number
  evictionCount: number
  memoryUsage: number
  oldestEntry: Date
  newestEntry: Date
  redisHits: number
  redisMisses: number
  memoryHits: number
  memoryMisses: number
}

// Define BiasReport type
export interface BiasReport {
  reportId: string
  title: string
  description: string
  createdAt: Date
  data: Record<string, any>
}
