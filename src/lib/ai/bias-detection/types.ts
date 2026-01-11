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

export interface ModelPerformanceMetrics {
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
  cacheConfig?: BiasCacheConfig
  securityConfig?: SecurityConfig
  performanceConfig?: PerformanceConfig
  hipaaCompliant?: boolean
  dataMaskingEnabled?: boolean
  auditLogging?: boolean
  strictMode?: boolean
  // Batch processing defaults
  batchProcessingConfig?: {
    enabled?: boolean
    batchSize?: number
    maxBatchDelayMs?: number
    retryFailedBatches?: boolean
    maxRetryAttempts?: number
    backoffStrategy?: 'fixed' | 'exponential'
    enableDebug?: boolean
    concurrency?: number
    timeoutMs?: number
    retries?: number
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
  performanceMetrics?: Partial<ModelPerformanceMetrics>
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
  exportFormats?: ('json' | 'csv' | 'pdf')[]
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

export interface BiasCacheConfig {
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
  timestamp?: Date
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
  type?: 'diagnostic' | 'intervention' | 'risk-assessment' | 'recommendation'
  content?: string
  confidence?: number
  modelUsed?: string
  reasoning?: string
  metadata?: Record<string, any>
}

export interface ExpectedOutcome {
  outcomeId: string
  description: string
  achieved: boolean
}

export interface SessionTranscript {
  speaker: 'user' | 'therapist' | 'ai'
  speakerId?: string
  text: string
  content?: string
  timestamp: Date
  emotionalTone?: string
  confidenceLevel?: number
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
  performanceMetrics: ModelPerformanceMetrics
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

export type PreprocessingAnalysisResult = Partial<PreprocessingLayerResult>;
export type ModelLevelAnalysisResult = Partial<ModelLevelLayerResult>;
export type InteractiveAnalysisResult = Partial<InteractiveLayerResult>;
export type EvaluationAnalysisResult = Partial<EvaluationLayerResult>;

export type LayerResults = {
  preprocessing: PreprocessingAnalysisResult;
  modelLevel: ModelLevelAnalysisResult;
  interactive: InteractiveAnalysisResult;
  evaluation: EvaluationAnalysisResult;
};

export interface BiasAnalysisResult {
  sessionId: string
  overallBiasScore: number
  alertLevel: AlertLevel
  confidence: number
  layerResults: LayerResults
  recommendations: string[]
  timestamp: Date
  demographics?: ParticipantDemographics
  explanation?: string
  error?: string
}

export type AnalysisResult = BiasAnalysisResult;

export interface BiasAlert {
  alertId: string
  sessionId: string
  timestamp: Date | string
  level: AlertLevel
  message: string
  biasScore?: number
  acknowledged?: boolean
  status?: string
  resolvedAt?: Date
}

export interface BiasDashboardSummary {
  totalSessions: number
  averageBiasScore: number
  alertsLayerBreakdown: Record<string, number>
  alertsLast24h: number
  activeAlerts: number
  trendDirection: 'up' | 'down' | 'stable'
  alerts: Record<AlertLevel, number>
}

export interface DashboardRecommendation {
  id: string
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  impact: string
  action: string
  actionUrl?: string
}

export interface BiasDashboardData {
  summary: BiasDashboardSummary
  trends: Array<{
    date: string
    time?: string
    biasScore: number
    sessionCount: number
    alertCount: number
  }>
  alerts: BiasAlert[]
  demographics: {
    [key: string]: {
      [value: string]: {
        count: number
        averageBias: number
      }
    }
  }
  recentAnalyses: BiasAnalysisResult[]
  recommendations: DashboardRecommendation[]
}

export type DashboardData = BiasDashboardData;

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
  generatedAt?: Date
  timeRange?: { start: Date; end: Date }
  overallFairnessScore?: number
  recommendations?: string[]
  executiveSummary?: {
    keyFindings: string[]
    criticalIssues: string[]
    improvementAreas: string[]
    complianceStatus: string
  }
  detailedAnalysis?: {
    demographicAnalysis: any
    temporalTrends: any
    performanceAnalysis: any
    interventionAnalysis: any
  }
  appendices?: any[]
  data: Record<string, any>
}

export interface PerformanceSnapshot {
  timestamp: number
  metrics: Array<{
    name: string
    value: number
    unit: string
  }>
  summary: {
    averageResponseTime: number
    requestCount: number
    errorRate: number
  }
}

export interface UserContext {
  userId: string
  email: string
  role: {
    id: string
    name: string
    description: string
    level: number
  }
  permissions: string[]
  institution?: string
  department?: string
}

export interface AuditAction {
  type: string
  category: string
  description: string
  sensitivityLevel: 'low' | 'medium' | 'high' | 'critical'
}

export interface AuditLogEntry {
  id: string
  timestamp: Date
  userId: string
  userEmail: string
  action: AuditAction
  resource: string
  details: Record<string, unknown>
  ipAddress: string
  userAgent: string
  success: boolean
  resourceId?: string
  sessionId?: string
  errorMessage?: string
}

export interface DataAccessLog {
  id: string
  timestamp: Date
  userId: string
  dataType: string
  dataIds: string[]
  accessReason: string
  retentionPeriod: number
  anonymized: boolean
  approvedBy?: string
}

export interface RetentionPolicy {
  dataType: string
  retentionPeriod: number
  autoDelete: boolean
  archiveBeforeDelete: boolean
  approvalRequired: boolean
}

export interface DataRetentionStatus {
  totalRecords: number
  recordsNearExpiry: number
  expiredRecords: number
  retentionPolicies: RetentionPolicy[]
  lastCleanup: Date
}

export interface EncryptionStatus {
  dataAtRest: {
    encrypted: boolean
    algorithm: string
    keyRotationDate: Date
  }
  dataInTransit: {
    encrypted: boolean
    protocol: string
    certificateExpiry: Date
  }
  backups: {
    encrypted: boolean
    location: string
    lastBackup: Date
  }
}

export interface ComplianceViolation {
  id: string
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  detectedAt: Date
  remediation: string[]
}

export interface ComplianceRecommendation {
  id: string
  category: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  implementationSteps: string[]
  timeline: string
  complianceStandards: string[]
}

export interface ComplianceReport {
  id: string
  generatedAt: Date
  period: { start: Date; end: Date }
  complianceScore: number
  violations: ComplianceViolation[]
  recommendations: ComplianceRecommendation[]
  auditTrail: AuditLogEntry[]
  dataRetentionStatus: DataRetentionStatus
  encryptionStatus: EncryptionStatus
}

export interface ConfigurationUpdate {
  section: string
  changes: Array<{
    field: string
    oldValue: any
    newValue: any
    impact: 'low' | 'medium' | 'high' | 'critical'
    requiresRestart: boolean
  }>
}

export interface BiasSummaryStats {
  totalSessions: number
  averageBiasScore: number
  alertsLayerBreakdown: Record<string, number>
  alertsLast24h: number
  activeAlerts: number
  trendDirection: 'up' | 'down' | 'stable'
  alerts: Record<AlertLevel, number>
  criticalIssues: number
  improvementRate: number
  complianceScore: number
}

export interface BiasTrendData {
  date: string
  biasScore: number
  sessionCount: number
  alertCount: number
  demographicBreakdown: Record<string, number>
}

export interface DemographicBreakdown {
  [dimension: string]: {
    [value: string]: {
      count: number
      averageBias: number
    }
  }
}

export interface BiasDetectionEvent {
  type: string
  payload: any
  timestamp: Date
}
