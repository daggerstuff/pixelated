/**
 * Type definitions for the Pixelated Empathy Bias Detection Engine
 */

export interface BiasDetectionConfig {
  // Python service configuration
  pythonServiceUrl: string
  pythonServiceTimeout: number

  // Detection thresholds
  thresholds: {
    warningLevel: number // 0.3 - Bias score above which warnings are issued
    highLevel: number // 0.6 - Bias score indicating high bias
    criticalLevel: number // 0.8 - Bias score requiring immediate action
  }

  // Layer-specific weights for overall bias scoring
  layerWeights: {
    preprocessing: number // Weight for preprocessing layer (default: 0.2)
    modelLevel: number // Weight for model-level analysis (default: 0.3)
    interactive: number // Weight for interactive analysis (default: 0.2)
    evaluation: number // Weight for evaluation layer (default: 0.3)
  }

  // Evaluation metrics to compute
  evaluationMetrics: string[]

  // Configuration for different components
  metricsConfig: BiasMetricsConfig
  alertConfig: BiasAlertConfig
  reportConfig: BiasReportConfig
  explanationConfig: BiasExplanationConfig
  pythonServiceConfig?: PythonServiceConfig
  cacheConfig?: CacheConfig
  securityConfig?: SecurityConfig
  performanceConfig?: PerformanceConfig

  // HIPAA compliance settings
  hipaaCompliant: boolean
  dataMaskingEnabled: boolean
  auditLogging: boolean
}

export interface BiasMetricsConfig {
  enableRealTimeMonitoring: boolean
  metricsRetentionDays: number
  aggregationIntervals: string[] // ['1h', '1d', '1w', '1m']
  dashboardRefreshRate: number // seconds
  exportFormats: string[] // ['json', 'csv', 'pdf']
}

export interface BiasAlertConfig {
  enableSlackNotifications: boolean
  enableEmailNotifications: boolean
  slackWebhookUrl?: string | undefined
  emailRecipients: string[]
  alertCooldownMinutes: number // Prevent alert spam
  escalationThresholds: {
    criticalResponseTimeMinutes: number
    highResponseTimeMinutes: number
  }
}

export interface BiasReportConfig {
  includeConfidentialityAnalysis: boolean
  includeDemographicBreakdown: boolean
  includeTemporalTrends: boolean
  includeRecommendations: boolean
  reportTemplate: 'standard' | 'executive' | 'technical'
  exportFormats: string[]
}

export interface BiasExplanationConfig {
  explanationMethod: 'shap' | 'lime' | 'integrated-gradients'
  maxFeatures: number
  includeCounterfactuals: boolean
  generateVisualization: boolean
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

export interface TherapeuticSession {
  sessionId: string
  timestamp: Date
  participantDemographics: ParticipantDemographics
  scenario: TrainingScenario
  content: SessionContent
  aiResponses: AIResponse[]
  expectedOutcomes: ExpectedOutcome[]
  transcripts: SessionTranscript[]
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
    | 'grief'
    | 'other'
  complexity: 'beginner' | 'intermediate' | 'advanced'
  tags: string[]
  description: string
  learningObjectives: string[]
}

export interface SessionContent {
  patientPresentation: string // Initial patient presentation
  therapeuticInterventions: string[]
  patientResponses: string[]
  sessionNotes: string
  assessmentResults?: Record<string, unknown>
}

export interface AIResponse {
  responseId: string
  timestamp: Date
  type: 'diagnostic' | 'intervention' | 'risk-assessment' | 'recommendation'
  content: string
  confidence: number
  modelUsed: string
  reasoning?: string
}

export interface ExpectedOutcome {
  outcomeId: string
  type:
    | 'therapeutic-alliance'
    | 'symptom-reduction'
    | 'insight-development'
    | 'skill-acquisition'
  expectedValue: unknown
  actualValue?: unknown
  variance?: number
}

export interface SessionTranscript {
  speakerId: string // 'therapist', 'patient', 'ai-assistant'
  timestamp: Date
  content: string
  emotionalTone?: string
  confidenceLevel?: number
}

export interface SessionMetadata {
  trainingInstitution: string
  supervisorId?: string
  traineeId: string
  sessionDuration: number // minutes
  completionStatus: 'completed' | 'partial' | 'abandoned'
  technicalIssues?: string[]
}

export interface DemographicGroup {
  type:
    | 'age'
    | 'gender'
    | 'ethnicity'
    | 'language'
    | 'socioeconomic'
    | 'education'
    | 'region'
  value: string
  subgroups?: string[]
}

export interface FairnessMetrics {
  demographicParity: number // Difference in positive prediction rates
  equalizedOdds: number // Difference in TPR and FPR across groups
  equalOpportunity: number // Difference in TPR across groups
  calibration: number // Difference in calibration across groups
  individualFairness: number // Similarity of outcomes for similar individuals
  counterfactualFairness: number // Fairness under counterfactual scenarios
}

export type AlertLevel = 'low' | 'medium' | 'high' | 'critical'

export interface BiasAnalysisResult {
  sessionId: string
  timestamp: Date
  overallBiasScore: number // 0-1, where 1 is maximum bias
  layerResults: {
    preprocessing: PreprocessingAnalysisResult
    modelLevel: ModelLevelAnalysisResult
    interactive: InteractiveAnalysisResult
    evaluation: EvaluationAnalysisResult
  }
  demographics: ParticipantDemographics
  recommendations: string[]
  alertLevel: AlertLevel
  explanation?: string
  confidence: number
}

export interface PreprocessingAnalysisResult {
  biasScore: number
  linguisticBias: LinguisticBiasResult
  representationAnalysis: RepresentationAnalysisResult
  dataQualityMetrics: DataQualityMetrics
  recommendations: string[]
}

export interface LinguisticBiasResult {
  genderBiasScore: number
  racialBiasScore: number
  ageBiasScore: number
  culturalBiasScore: number
  biasedTerms: BiasedTerm[]
  sentimentAnalysis: SentimentAnalysis
}

export interface BiasedTerm {
  term: string
  context: string
  biasType: string
  severity: 'low' | 'medium' | 'high'
  suggestedAlternative?: string
}

export interface SentimentAnalysis {
  overallSentiment: number // -1 to 1
  emotionalValence: number
  subjectivity: number
  demographicVariations: Record<string, number>
}

export interface RepresentationAnalysisResult {
  demographicDistribution: Record<string, number>
  underrepresentedGroups: string[]
  overrepresentedGroups: string[]
  diversityIndex: number
  intersectionalityAnalysis: IntersectionalityResult[]
}

export interface IntersectionalityResult {
  groups: string[]
  representation: number
  biasScore: number
  sampleSize: number
}

export interface DataQualityMetrics {
  completeness: number // 0-1
  consistency: number // 0-1
  accuracy: number // 0-1
  timeliness: number // 0-1
  validity: number // 0-1
  missingDataByDemographic: Record<string, number>
}

export interface ModelLevelAnalysisResult {
  biasScore: number
  fairnessMetrics: FairnessMetrics
  performanceMetrics: ModelPerformanceMetrics
  groupPerformanceComparison: GroupPerformanceComparison[]
  recommendations: string[]
}

export interface ModelPerformanceMetrics {
  accuracy: number
  precision: number
  recall: number
  f1Score: number
  auc: number
  calibrationError: number
  demographicBreakdown: Record<string, ModelPerformanceMetrics>
}

export interface GroupPerformanceComparison {
  group1: DemographicGroup
  group2: DemographicGroup
  performanceDifference: number
  significance: number
  effectSize: number
}

export interface InteractiveAnalysisResult {
  biasScore: number
  counterfactualAnalysis: CounterfactualAnalysisResult
  featureImportance: FeatureImportanceResult[]
  whatIfScenarios: WhatIfScenarioResult[]
  recommendations: string[]
}

export interface CounterfactualAnalysisResult {
  scenariosAnalyzed: number
  biasDetected: boolean
  consistencyScore: number // How consistent outcomes are across demographics
  problematicScenarios: ProblematicScenario[]
}

export interface ProblematicScenario {
  scenarioId: string
  originalDemographics: ParticipantDemographics
  alteredDemographics: ParticipantDemographics
  outcomeChange: string
  biasType: string
  severity: 'low' | 'medium' | 'high'
}

export interface FeatureImportanceResult {
  feature: string
  importance: number
  biasContribution: number
  demographicSensitivity: Record<string, number>
}

export interface WhatIfScenarioResult {
  scenarioId: string
  modifications: Record<string, unknown>
  predictedOutcome: unknown
  confidenceChange: number
  biasImplications: string[]
}

export interface EvaluationAnalysisResult {
  biasScore: number
  huggingFaceMetrics: HuggingFaceMetricsResult
  customMetrics: CustomBiasMetrics
  temporalAnalysis: TemporalBiasAnalysis
  recommendations: string[]
}

export interface HuggingFaceMetricsResult {
  toxicity: number
  bias: number
  regard: Record<string, number>
  stereotype: number
  fairness: number
}

export interface CustomBiasMetrics {
  therapeuticBias: number // Bias specific to therapeutic contexts
  culturalSensitivity: number
  professionalEthics: number
  patientSafety: number
}

export interface TemporalBiasAnalysis {
  trendDirection: 'improving' | 'worsening' | 'stable'
  changeRate: number
  seasonalPatterns: SeasonalPattern[]
  interventionEffectiveness: InterventionEffectiveness[]
}

export interface SeasonalPattern {
  period: string
  biasLevel: number
  confidence: number
}

export interface InterventionEffectiveness {
  interventionType: string
  preInterventionBias: number
  postInterventionBias: number
  improvement: number
  sustainabilityScore: number
}

export interface BiasReport {
  reportId: string
  generatedAt: Date
  timeRange: { start: Date; end: Date }
  overallFairnessScore: number
  executiveSummary: ExecutiveSummary
  detailedAnalysis: DetailedAnalysis
  recommendations: BiasRecommendation[]
  appendices: ReportAppendix[]
}

export interface ExecutiveSummary {
  keyFindings: string[]
  criticalIssues: string[]
  improvementAreas: string[]
  complianceStatus:
    | 'compliant'
    | 'minor-issues'
    | 'major-issues'
    | 'non-compliant'
}

export interface DetailedAnalysis {
  demographicAnalysis: DemographicAnalysisSection
  temporalTrends: TemporalTrendsSection
  performanceAnalysis: PerformanceAnalysisSection
  interventionAnalysis: InterventionAnalysisSection
}

export interface DemographicAnalysisSection {
  representation: Record<string, number>
  performanceGaps: GroupPerformanceComparison[]
  intersectionalAnalysis: IntersectionalityResult[]
  riskGroups: RiskGroup[]
}

export interface RiskGroup {
  demographics: ParticipantDemographics
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  identifiedBiases: string[]
  recommendedActions: string[]
}

export interface TemporalTrendsSection {
  overallTrend: 'improving' | 'worsening' | 'stable'
  monthlyMetrics: MonthlyMetric[]
  seasonalPatterns: SeasonalPattern[]
  correlationAnalysis: CorrelationAnalysis[]
}

export interface MonthlyMetric {
  month: string
  biasScore: number
  sessionCount: number
  alertCount: number
  improvementRate: number
}

export interface CorrelationAnalysis {
  factor: string
  correlation: number
  significance: number
  interpretation: string
}

export interface PerformanceAnalysisSection {
  overallMetrics: ModelPerformanceMetrics
  demographicBreakdown: Record<string, ModelPerformanceMetrics>
  fairnessMetrics: FairnessMetrics
  benchmarkComparison: BenchmarkComparison[]
}

export interface BenchmarkComparison {
  metric: string
  currentValue: number
  benchmarkValue: number
  difference: number
  status: 'above-benchmark' | 'at-benchmark' | 'below-benchmark'
}

export interface InterventionAnalysisSection {
  implementedInterventions: InterventionRecord[]
  effectivenessAnalysis: InterventionEffectiveness[]
  recommendedInterventions: BiasRecommendation[]
}

export interface InterventionRecord {
  interventionId: string
  type: string
  implementedAt: Date
  description: string
  targetDemographics: string[]
  measuredImpact: number
}

export interface BiasRecommendation {
  id: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  category: 'data' | 'model' | 'process' | 'training' | 'policy'
  title: string
  description: string
  expectedImpact: string
  implementationSteps: string[]
  timeline: string
  resources: string[]
  successMetrics: string[]
  riskMitigation: string[]
}

export interface ReportAppendix {
  title: string
  type: 'methodology' | 'data-sources' | 'technical-details' | 'references'
  content: string
  attachments?: ReportAttachment[]
}

export interface ReportAttachment {
  filename: string
  type: 'chart' | 'table' | 'raw-data' | 'documentation'
  url: string
  description: string
}

// Configuration interfaces for different bias detection layers
export interface AIF360Config {
  privilegedGroups: Record<string, unknown>[]
  unprivilegedGroups: Record<string, unknown>[]
  favorableLabel: number
  unfavorableLabel: number
  metricsToCompute: string[]
}

export interface FairlearnConfig {
  constraints: string[] // 'demographic_parity', 'equalized_odds', etc.
  gridSize: number
  eps: number
  maxIter: number
}

export interface WhatIfToolConfig {
  modelType: 'classification' | 'regression'
  maxCounterfactuals: number
  featureColumns: string[]
  targetColumn: string
  optimizationMetric: string
}

export interface HuggingFaceEvaluateConfig {
  metrics: string[] // List of fairness metrics to compute
  referenceColumn: string
  predictionColumn: string
  demographicColumns: string[]
}

// Error types
export interface BiasDetectionError extends Error {
  code: string
  layer?: string
  sessionId?: string
  demographics?: ParticipantDemographics
  recoverable: boolean
}

// Event types for real-time monitoring
export interface BiasDetectionEvent {
  eventId: string
  timestamp: Date
  type:
    | 'bias-detected'
    | 'threshold-exceeded'
    | 'analysis-completed'
    | 'system-error'
  sessionId: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  data: Record<string, unknown>
  requiresAction: boolean
}

// Dashboard data types
export interface BiasDashboardData {
  summary: BiasSummaryStats
  recentAnalyses: BiasAnalysisResult[]
  alerts: BiasAlert[]
  trends: BiasTrendData[]
  demographics: DemographicBreakdown
  recommendations: DashboardRecommendation[]
}

export interface BiasSummaryStats {
  totalSessions: number
  averageBiasScore: number
  alertsLast24h: number
  criticalIssues: number
  improvementRate: number
  complianceScore: number
}

export interface BiasAlert {
  alertId: string
  timestamp: Date
  level: 'low' | 'medium' | 'high' | 'critical'
  type: string
  message: string
  sessionId: string
  acknowledged: boolean
  resolvedAt?: Date
}

export interface BiasTrendData {
  date: Date
  biasScore: number
  sessionCount: number
  alertCount: number
  demographicBreakdown: Record<string, number>
}

export interface DemographicBreakdown {
  age: Record<string, number>
  gender: Record<string, number>
  ethnicity: Record<string, number>
  language: Record<string, number>
  intersectional: IntersectionalityResult[]
}

export interface DashboardRecommendation {
  id: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  action: string
  estimatedImpact: string
}

// API Request/Response Types
export interface AnalyzeSessionRequest {
  session: TherapeuticSession
  options?: {
    skipCache?: boolean
    includeExplanation?: boolean
    demographicFocus?: DemographicGroup[]
  }
}

export interface AnalyzeSessionResponse {
  success: boolean
  data?: BiasAnalysisResult
  error?: string
  processingTime: number
  cacheHit?: boolean
}

export interface DashboardDataRequest {
  timeRange?: { start: Date; end: Date }
  demographicFilters?: DemographicGroup[]
  includeAlerts?: boolean
  includeRecommendations?: boolean
}

export interface DashboardDataResponse {
  success: boolean
  data?: BiasDashboardData
  error?: string
  lastUpdated: Date
}

export interface ExportDataRequest {
  format: 'json' | 'csv' | 'pdf'
  timeRange: { start: Date; end: Date }
  includeRawData?: boolean
  includeSummary?: boolean
  demographicFilters?: DemographicGroup[]
  sessionIds?: string[]
}

export interface ExportDataResponse {
  success: boolean
  downloadUrl?: string
  filename?: string
  error?: string
  expiresAt?: Date
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: Date
  services: {
    pythonService: ServiceStatus
    database: ServiceStatus
    cache: ServiceStatus
    alertSystem: ServiceStatus
  }
  version: string
  uptime: number
}

export interface ServiceStatus {
  status: 'up' | 'down' | 'degraded'
  responseTime?: number
  lastCheck: Date
  error?: string
}

// WebSocket Event Types for Real-time Monitoring
export interface WebSocketMessage {
  type:
    | 'bias-alert'
    | 'analysis-complete'
    | 'dashboard-update'
    | 'system-status'
  timestamp: Date
  data: Record<string, unknown>
  sessionId?: string
}

export interface BiasAlertWebSocketEvent extends WebSocketMessage {
  type: 'bias-alert'
  data: {
    alert: BiasAlert
    analysisResult: BiasAnalysisResult
    requiresImmediateAction: boolean
  }
}

export interface AnalysisCompleteWebSocketEvent extends WebSocketMessage {
  type: 'analysis-complete'
  data: {
    sessionId: string
    result: BiasAnalysisResult
    processingTime: number
  }
}

export interface DashboardUpdateWebSocketEvent extends WebSocketMessage {
  type: 'dashboard-update'
  data: {
    summary: BiasSummaryStats
    newAlerts: BiasAlert[]
    updatedTrends: BiasTrendData[]
  }
}

export interface SystemStatusWebSocketEvent extends WebSocketMessage {
  type: 'system-status'
  data: {
    status: HealthCheckResponse
    changedServices: string[]
  }
}

// Authentication and Authorization Types
export interface UserContext {
  userId: string
  email: string
  role: UserRole
  permissions: Permission[]
  institution?: string
  department?: string
}

export interface UserRole {
  id: string
  name: 'admin' | 'supervisor' | 'trainer' | 'analyst' | 'viewer'
  description: string
  level: number // 1-5, where 5 is highest access
}

export interface Permission {
  resource:
    | 'bias-analysis'
    | 'dashboard'
    | 'reports'
    | 'configuration'
    | 'user-management'
  actions: ('read' | 'write' | 'delete' | 'export')[]
  conditions?: PermissionCondition[]
}

export interface PermissionCondition {
  field: string
  operator: 'equals' | 'in' | 'not_in' | 'contains'
  value: unknown
}

// Performance Monitoring Types
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

export interface PerformanceMetrics {
  timestamp: Date
  endpoint: string
  method: string
  responseTime: number
  statusCode: number
  userAgent?: string
  userId?: string
  sessionId?: string
  errorDetails?: string
}

export interface SystemPerformanceStats {
  averageResponseTime: number
  requestsPerMinute: number
  errorRate: number
  activeConnections: number
  memoryUsage: number
  cpuUsage: number
  cacheHitRate: number
}

export interface PerformanceAlert {
  id: string
  type: 'high-latency' | 'error-rate' | 'resource-usage' | 'service-down'
  threshold: number
  currentValue: number
  timestamp: Date
  resolved: boolean
  resolvedAt?: Date
}

// HIPAA Compliance and Audit Types
export interface AuditLogEntry {
  id: string
  timestamp: Date
  userId: string
  userEmail: string
  action: AuditAction
  resource: string
  resourceId?: string
  details: Record<string, unknown>
  ipAddress: string
  userAgent: string
  sessionId?: string
  success: boolean
  errorMessage?: string
}

export interface AuditAction {
  type: 'create' | 'read' | 'update' | 'delete' | 'export' | 'login' | 'logout'
  category:
    | 'bias-analysis'
    | 'user-data'
    | 'configuration'
    | 'authentication'
    | 'system'
  description: string
  sensitivityLevel: 'low' | 'medium' | 'high' | 'critical'
}

export interface DataAccessLog {
  id: string
  timestamp: Date
  userId: string
  dataType: 'session-data' | 'demographics' | 'analysis-results' | 'reports'
  dataIds: string[]
  accessReason: string
  approvedBy?: string
  retentionPeriod: number // days
  anonymized: boolean
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

export interface ComplianceViolation {
  id: string
  type:
    | 'data-retention'
    | 'unauthorized-access'
    | 'missing-audit'
    | 'encryption-failure'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  detectedAt: Date
  resolvedAt?: Date
  remediation: string[]
}

export interface ComplianceRecommendation {
  id: string
  category: 'access-control' | 'data-protection' | 'audit-logging' | 'training'
  priority: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  implementationSteps: string[]
  timeline: string
  complianceStandards: string[] // ['HIPAA', 'SOC2', 'GDPR']
}

export interface DataRetentionStatus {
  totalRecords: number
  recordsNearExpiry: number
  expiredRecords: number
  retentionPolicies: RetentionPolicy[]
  lastCleanup: Date
}

export interface RetentionPolicy {
  dataType: string
  retentionPeriod: number // days
  autoDelete: boolean
  archiveBeforeDelete: boolean
  approvalRequired: boolean
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

// Cache and Storage Types
export interface CacheEntry<T = unknown> {
  key: string
  value: T | string // Modified to allow string for compressed data
  timestamp: Date
  expiresAt: Date
  accessCount: number
  lastAccessed: Date
  tags: string[]
}

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
  redisAvailable?: boolean
  hybridMode?: boolean
}

// Configuration Management Types
export interface ConfigurationUpdate {
  id: string
  timestamp: Date
  userId: string
  section: 'thresholds' | 'alerts' | 'metrics' | 'python-service' | 'security'
  changes: ConfigurationChange[]
  reason: string
  approvedBy?: string
  rollbackAvailable: boolean
}

export interface ConfigurationChange {
  field: string
  oldValue: unknown
  newValue: unknown
  impact: 'low' | 'medium' | 'high' | 'critical'
  requiresRestart: boolean
}

// Error Handling and Recovery Types
export interface ErrorContext {
  timestamp: Date
  userId?: string
  sessionId?: string
  endpoint?: string
  userAgent?: string
  stackTrace?: string
  additionalData?: Record<string, unknown>
}

export interface RecoveryAction {
  type: 'retry' | 'fallback' | 'circuit-breaker' | 'manual-intervention'
  description: string
  automated: boolean
  maxAttempts?: number
  backoffStrategy?: 'linear' | 'exponential' | 'fixed'
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'critical'
  components: ComponentHealth[]
  lastCheck: Date
  nextCheck: Date
  alerts: SystemAlert[]
}

export interface ComponentHealth {
  name: string
  status: 'up' | 'down' | 'degraded'
  responseTime?: number
  errorRate?: number
  lastError?: string
  dependencies: string[]
}

export interface SystemAlert {
  id: string
  component: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  message: string
  timestamp: Date
  acknowledged: boolean
  resolvedAt?: Date
}
