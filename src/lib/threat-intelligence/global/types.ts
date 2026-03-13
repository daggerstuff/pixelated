/**
 * Global Threat Intelligence Network Types
 * Core type definitions for the global threat intelligence system
 */

export interface GlobalThreatIntelligenceNetworkConfig {
  regions: RegionConfig[]
  dataSharing: DataSharingConfig
  edgeDetection: EdgeDetectionConfig
  correlation: CorrelationConfig
  database: DatabaseConfig
  orchestration: OrchestrationConfig
  validation: ValidationConfig
}

export interface RegionConfig {
  regionId: string
  regionName: string
  location: {
    latitude: number
    longitude: number
    timezone: string
  }
  dataCenters: DataCenterConfig[]
  edgeNodes: EdgeNodeConfig[]
  priority: number
  complianceRequirements: string[]
}

export interface DataCenterConfig {
  dataCenterId: string
  location: string
  capacity: {
    maxThreats: number
    maxConnections: number
    storageGB: number
  }
  services: string[]
  status: 'active' | 'maintenance' | 'offline'
}

export interface EdgeNodeConfig {
  nodeId: string
  location: string
  capabilities: string[]
  aiModels: string[]
  bandwidth: number
  latency: number
}

export interface DataSharingConfig {
  enabled: boolean
  protocols: string[]
  encryption: {
    algorithm: string
    keyRotation: number
  }
  authentication: {
    method: string
    certificates: string[]
  }
  rateLimiting: {
    requestsPerSecond: number
    burstLimit: number
  }
}

export interface EdgeDetectionConfig {
  aiModels: AIModelConfig[]
  detectionThresholds: DetectionThresholds
  updateFrequency: number
  modelDeployment: ModelDeploymentConfig
}

export interface AIModelConfig {
  modelId: string
  modelType: 'anomaly' | 'classification' | 'clustering' | 'prediction'
  version: string
  framework: 'tensorflow' | 'pytorch' | 'sklearn'
  performance: {
    accuracy: number
    precision: number
    recall: number
    f1Score: number
  }
  deployment: {
    regions: string[]
    edgeNodes: string[]
    resources: {
      cpu: number
      memory: number
      gpu?: number
    }
  }
}

export interface DetectionThresholds {
  anomaly: number
  threat: number
  confidence: number
  severity: {
    low: number
    medium: number
    high: number
    critical: number
  }
}

export interface ModelDeploymentConfig {
  strategy: 'rolling' | 'blue_green' | 'canary'
  rolloutPercentage: number
  rollbackThreshold: number
  healthChecks: HealthCheckConfig[]
}

export interface HealthCheckConfig {
  type: 'http' | 'tcp' | 'grpc'
  endpoint: string
  interval: number
  timeout: number
  retries: number
}

export interface CorrelationConfig {
  algorithms: CorrelationAlgorithm[]
  timeWindow: number
  similarityThreshold: number
  crossRegionWeight: number
  historicalWeight: number
}

export interface CorrelationAlgorithm {
  algorithmId: string
  algorithmType: 'graph' | 'statistical' | 'ml' | 'rule_based'
  parameters: Record<string, unknown>
  performance: {
    accuracy: number
    speed: number
    scalability: number
  }
}

export interface DatabaseConfig {
  primary: DatabaseConnectionConfig
  replicas: DatabaseConnectionConfig[]
  sharding: ShardingConfig
  backup: BackupConfig
  stixSupport: STIXConfig
  taxiiSupport: TAXIIConfig
}

export interface DatabaseConnectionConfig {
  host: string
  port: number
  database: string
  username: string
  password: string
  ssl: boolean
  connectionPool: {
    min: number
    max: number
    idleTimeout: number
  }
}

export interface ShardingConfig {
  enabled: boolean
  shards: ShardConfig[]
  shardKey: string
  balancingStrategy: string
}

export interface ShardConfig {
  shardId: string
  region: string
  nodes: string[]
  capacity: number
}

export interface BackupConfig {
  enabled: boolean
  frequency: number
  retention: number
  locations: string[]
  encryption: boolean
}

export interface STIXConfig {
  enabled: boolean
  version: string
  objects: string[]
  validation: boolean
  exportFormats: string[]
}

export interface TAXIIConfig {
  enabled: boolean
  version: string
  collections: string[]
  authentication: {
    method: string
    certificates: string[]
  }
  rateLimiting: {
    requestsPerMinute: number
    burstLimit: number
  }
}

export interface OrchestrationConfig {
  responseStrategies: ResponseStrategy[]
  automationLevel: 'full' | 'semi' | 'manual'
  escalationRules: EscalationRule[]
  integrationEndpoints: IntegrationEndpoint[]
}

export interface ResponseStrategy {
  strategyId: string
  name?: string
  description?: string
  threatTypes: string[]
  severityLevels: string[]
  responseActions: ResponseAction[]
  conditions: ResponseCondition[]
  priority: number
  primaryType?: 'block' | 'isolate' | 'alert' | 'investigate' | 'mitigate' | 'rate_limit'
}

export interface ResponseAction {
  actionId: string
  actionType:
    | 'block'
    | 'isolate'
    | 'alert'
    | 'investigate'
    | 'mitigate'
    | 'rate_limit'
  target: string
  parameters: Record<string, unknown>
  priority: number
  timeout: number
  rollbackStrategy?: string
}

export interface ResponseCondition {
  conditionType: 'threshold' | 'pattern' | 'time' | 'location'
  condition: string
  value: unknown
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'matches'
}

export interface EscalationRule {
  ruleId: string
  trigger: string
  conditions: ResponseCondition[]
  actions: ResponseAction[]
  recipients: string[]
  priority: number
}

export interface IntegrationEndpoint {
  endpointId: string
  service: string
  endpoint: string
  authType: string
  credentials: Record<string, string>
  enabled?: boolean
  timeout?: number
  retryPolicy: {
    maxRetries: number
    backoffStrategy: 'linear' | 'exponential' | 'fixed'
    retryDelay?: number
  }
  url?: string
  authentication?: {
    method: string
    credentials: Record<string, string>
  }
  rateLimiting?: {
    requestsPerSecond: number
    burstLimit: number
  }
}

export interface ValidationConfig {
  enabled: boolean
  validationRules: ValidationRule[]
  validationThreshold?: number
  qualityThresholds: QualityThresholds
  feedbackLoop: FeedbackLoopConfig
}

export interface ValidationRule {
  ruleId: string
  name: string
  ruleType:
    | 'accuracy'
    | 'completeness'
    | 'consistency'
    | 'timeliness'
    | 'relevance'
  conditions: ValidationRuleCondition[]
  severity?: 'low' | 'medium' | 'high' | 'critical'
  condition: string
  threshold?: number
  action: 'accept' | 'reject' | 'flag' | 'review'
}

export interface ValidationRuleCondition {
  type: string
  field: string
  operator: string
  value: unknown
  required?: boolean
  weight?: number
  min?: number
  max?: number
  pattern?: string
  values?: unknown[]
}

export interface ValidationResult {
  ruleId: string
  ruleName: string
  passed: boolean
  score: number
  issues: string[]
  details: Record<string, unknown>
}

export interface ThreatValidation {
  validationId: string
  threatId: string
  threatType: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
  status: 'pending' | 'valid' | 'invalid' | 'reviewed' | 'timeout'
  overallScore: number
  isValid: boolean
  results: ValidationResult[]
  createdAt: Date
  completedAt?: Date
  metadata?: Record<string, unknown>
}

export interface QualityThresholds {
  accuracy: number
  completeness: number
  consistency: number
  timeliness: number
  relevance: number
}

export interface FeedbackLoopConfig {
  enabled: boolean
  sources: string[]
  updateFrequency: number
  learningRate: number
}

// Global threat intelligence data structures
export interface GlobalThreatIntelligence {
  intelligenceId: string
  threatId: string
  globalThreatId?: string
  threatType: string
  regions: string[]
  severity: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
  firstSeen: Date
  lastSeen: Date
  expirationDate?: Date
  indicators: ThreatIndicator[]
  attribution?: ThreatAttribution
  impactAssessment: GlobalImpactAssessment
  correlationData: CorrelationData
  validationStatus: ValidationStatus
  metadata?: Record<string, unknown>
}

export interface ThreatIndicator {
  indicatorId?: string
  indicatorType: string
  value: string
  confidence: number
  sourceRegion?: string
  firstSeen: Date
  lastSeen: Date
  expirationDate?: Date
  metadata?: Record<string, unknown>
}

export interface GlobalThreatIndicator extends ThreatIndicator {}

export interface ThreatAttribution {
  actor?: string
  campaign: string
  family?: string
  motivation?: string
  sophistication?: string
  resources?: string
  confidence: number
  evidence?: string[]
}

export interface GlobalImpactAssessment {
  geographicSpread: number
  affectedRegions: string[]
  affectedSectors: string[]
  potentialImpact: number
  economicImpact?: number
  operationalImpact?: number
  reputationImpact?: number
}

export interface CorrelationData {
  correlationId: string
  correlatedThreats: string[]
  correlationStrength: number
  correlationType: string
  confidence: number
  analysisMethod: string
  timestamp: Date
}

export interface ValidationStatus {
  validationId: string
  status: 'validated' | 'pending' | 'rejected' | 'flagged'
  accuracy: number
  completeness: number
  consistency: number
  timeliness: number
  relevance: number
  validator: string
  validationDate: Date
  feedback: string[]
}

// Real-time data structures
export interface RealTimeThreatData {
  threatId: string
  timestamp: Date
  region: string
  severity: number
  confidence: number
  indicators: ThreatIndicator[]
  context: ThreatContext
  source: string
}

export interface ThreatStream {
  streamId: string
  region: string
  threats: RealTimeThreatData[]
  metadata: StreamMetadata
}

export interface StreamMetadata {
  totalThreats: number
  averageSeverity: number
  confidenceLevel: number
  dataQuality: number
  lastUpdate: Date
}

// Edge detection data structures
export interface EdgeDetectionResult {
  detectionId: string
  edgeNodeId: string
  region: string
  threatType: string
  severity: number
  confidence: number
  indicators: ThreatIndicator[]
  aiModel: string
  processingTime: number
  timestamp: Date
}

export interface EdgeNodeStatus {
  nodeId: string
  region: string
  status: 'online' | 'offline' | 'maintenance'
  load: number
  memoryUsage: number
  cpuUsage: number
  activeModels: string[]
  lastHeartbeat: Date
}

// Hunting system data structures
export interface ThreatHunt {
  huntId: string
  huntName: string
  description: string
  query: HuntQuery
  scope: HuntScope
  schedule?: HuntSchedule
  results: HuntResult[]
  status: 'active' | 'completed' | 'failed' | 'paused'
  createdBy: string
  createdAt: Date
}

export interface HuntQuery {
  huntId: string
  patternId?: string
  customQuery?: string
  queryType?: 'sql' | 'kql' | 'spl' | 'yaml'
  query?: string
  parameters?: Record<string, unknown>
  filters?: HuntFilter[]
  scope?: string[]
  regions?: string[]
  dataSources?: string[]
  priority?: 'low' | 'medium' | 'high' | 'critical'
  timeout?: number
  maxResults?: number
  timeRange?: {
    startTime: string
    endTime: string
  }
}

export interface HuntFilter {
  field: string
  operator: string
  value: unknown
  condition: 'and' | 'or'
}

export interface HuntScope {
  regions: string[]
  timeRange: TimeWindow
  dataSources: string[]
  threatTypes: string[]
}

export interface HuntSchedule {
  frequency: string
  cronExpression?: string
  timezone?: string
  enabled?: boolean
  scheduleId: string
  patternId: string
  scope?: string[]
  parameters?: Record<string, unknown>
  lastExecution?: Date | string
}

export interface HuntResult {
  resultId: string
  huntId: string
  executionId?: string
  patternId?: string
  startTime?: Date
  endTime?: Date
  timestamp: Date
  status?: 'completed' | 'failed' | 'running'
  threatsDiscovered?: number
  confidence?: number
  findings: HuntFinding[]
  metadata: HuntMetadata
}

export interface HuntExecution {
  executionId: string
  huntId: string
  patternId: string
  startTime: Date
  completedTime?: Date
  status: 'preparing' | 'executing' | 'completed' | 'failed' | 'cancelled' | 'timeout'
  scope: string[]
  dataSources: string[]
  regions: string[]
  parameters: Record<string, unknown>
  maxResults?: number
  metadata?: HuntMetadata | Record<string, unknown>
}

export interface HuntFinding {
  findingId: string
  threatId?: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
  description: string
  evidence: string[]
  remediation: string
}

export interface HuntMetadata {
  executionTime: number
  dataProcessed: number
  falsePositives: number
  truePositives: number
  coverage: number
  [key: string]: unknown
}

// External feed integration data structures
export interface ExternalFeed {
  feedId: string
  feedName: string
  feedType: 'commercial' | 'open_source' | 'community' | 'government'
  provider: string
  endpoint: string
  authentication: FeedAuthentication
  updateFrequency: number
  supportedFormats: string[]
  rateLimiting: FeedRateLimiting
  qualityMetrics: FeedQualityMetrics
  status: 'active' | 'inactive' | 'error'
}

export interface FeedAuthentication {
  method: 'api_key' | 'oauth' | 'certificate' | 'basic_auth'
  credentials: Record<string, string>
  tokenRefresh?: TokenRefreshConfig
}

export interface TokenRefreshConfig {
  endpoint: string
  method: string
  parameters: Record<string, unknown>
  refreshInterval: number
}

export interface FeedRateLimiting {
  requestsPerMinute: number
  burstLimit: number
  retryPolicy: RetryPolicy
}

export interface RetryPolicy {
  maxRetries: number
  backoffStrategy: 'linear' | 'exponential' | 'fixed'
  initialDelay: number
  maxDelay: number
}

export interface FeedQualityMetrics {
  accuracy: number
  completeness: number
  timeliness: number
  consistency: number
  relevance: number
  lastUpdated: Date
}

/** Feed subscription configuration (input) */
export interface FeedConfig {
  feedId: string
  provider: string
  feedType: 'stix' | 'taxii' | 'misp' | 'otx' | 'virustotal' | 'generic'
  endpoint: string
  apiKey?: string
  requiresAuth?: boolean
  updateFrequency?: 'real-time' | 'hourly' | 'daily' | 'weekly'
  parameters?: Record<string, unknown>
  filters?: Record<string, unknown>
}

/** Single item from an external feed (parsed) */
export interface FeedItem {
  itemId: string
  indicator: string
  indicatorType: string
  severity: string
  confidence: number
  timestamp: Date
  description: string
  source?: string
  metadata?: Record<string, unknown>
}

/** Request-building options for feed fetch (optional on subscription config) */
export interface FeedSubscriptionRequestConfig {
  method?: string
  headers?: Record<string, string>
  authType?: 'api_key' | 'bearer' | 'basic'
  username?: string
  queryParams?: Record<string, unknown>
  requestBody?: unknown
}

/** Active feed subscription (stored, may include runtime stats) */
export interface FeedSubscription {
  subscriptionId: string
  feedId: string
  provider: string
  feedType: string
  endpoint: string
  apiKey?: string
  parameters: Record<string, unknown>
  filters: Record<string, unknown>
  updateFrequency: string
  status: 'active' | 'inactive' | 'error'
  createdAt: Date
  lastFetchTime?: Date
  lastProcessedTime?: Date
  /** Runtime stats (updated on process) */
  itemsProcessed?: number
  errors?: number
  /** Feed config (optional; may include request options for fetch) */
  config?: FeedConfig & FeedSubscriptionRequestConfig
}

/** Result of processing a batch of feed items */
export interface FeedProcessingResult {
  subscriptionId: string
  itemsProcessed: number
  threatsDiscovered: number
  errors: number
  processingTime: number
  threats: GlobalThreatIntelligence[]
}

// Utility types
export interface TimeWindow {
  start: Date
  end: Date
}

export interface PaginationParams {
  page: number
  limit: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  metadata?: {
    timestamp: Date
    requestId: string
    processingTime: number
  }
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: Date
  components: Record<string, ComponentHealth>
  metrics: SystemMetrics
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  message?: string
  lastCheck: Date
  responseTime?: number
}

export interface SystemMetrics {
  cpuUsage: number
  memoryUsage: number
  diskUsage: number
  networkLatency: number
  activeConnections: number
  queueSize: number
}
