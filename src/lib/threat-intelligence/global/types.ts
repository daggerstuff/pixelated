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
  threatTypes: string[]
  severityLevels: string[]
  responseActions: ResponseAction[]
  conditions: ResponseCondition[]
}

export interface ResponseAction {
  actionId: string
  actionType: 'block' | 'isolate' | 'alert' | 'investigate' | 'mitigate'
  target: string
  parameters: Record<string, unknown>
  timeout: number
  rollbackStrategy: string
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
  url: string
  authentication: {
    method: string
    credentials: Record<string, string>
  }
  rateLimiting: {
    requestsPerSecond: number
    burstLimit: number
  }
  retryPolicy: {
    maxRetries: number
    backoffStrategy: string
    timeout: number
  }
}

export interface ValidationConfig {
  enabled: boolean
  validationRules: ValidationRule[]
  qualityThresholds: QualityThresholds
  feedbackLoop: FeedbackLoopConfig
}

export interface ValidationRule {
  ruleId: string
  ruleType:
    | 'accuracy'
    | 'completeness'
    | 'consistency'
    | 'timeliness'
    | 'relevance'
  condition: string
  threshold: number
  action: 'accept' | 'reject' | 'flag' | 'review'
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
  globalThreatId: string
  regions: string[]
  severity: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
  firstSeen: Date
  lastSeen: Date
  expirationDate?: Date
  indicators: GlobalThreatIndicator[]
  attribution?: ThreatAttribution
  impactAssessment: GlobalImpactAssessment
  correlationData: CorrelationData
  validationStatus: ValidationStatus
}

export interface GlobalThreatIndicator {
  indicatorId: string
  indicatorType: string
  value: string
  confidence: number
  sourceRegion: string
  firstSeen: Date
  lastSeen: Date
  expirationDate?: Date
  metadata: Record<string, unknown>
}

export interface ThreatAttribution {
  actor: string
  campaign: string
  family: string
  motivation: string
  sophistication: string
  resources: string
  confidence: number
  evidence: string[]
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
  queryType: 'sql' | 'kql' | 'spl' | 'yaml'
  query: string
  parameters: Record<string, unknown>
  filters: HuntFilter[]
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
  cronExpression: string
  timezone: string
  enabled: boolean
}

export interface HuntResult {
  resultId: string
  huntId: string
  timestamp: Date
  findings: HuntFinding[]
  metadata: HuntMetadata
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
