/**
 * Threat Intelligence Configuration
 * Centralized configuration for the global threat intelligence network
 */

import { Redis } from 'ioredis'
import { MongoClient } from 'mongodb'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const logger = createBuildSafeLogger('threat-intelligence-config')

export interface ThreatIntelligenceConfig {
  // Global Network Configuration
  global: GlobalThreatIntelligenceConfig

  // Edge Detection Configuration
  edge: EdgeDetectionConfig

  // Correlation Engine Configuration
  correlation: CorrelationEngineConfig

  // Database Configuration
  database: DatabaseConfig

  // Response Orchestration Configuration
  orchestration: OrchestrationConfig

  // Threat Hunting Configuration
  hunting: HuntingConfig

  // External Feed Integration Configuration
  feeds: FeedIntegrationConfig

  // Validation Configuration
  validation: ValidationConfig

  // Multi-region Configuration
  regions: RegionConfig[]

  // Security Configuration
  security: SecurityConfig

  // Performance Configuration
  performance: PerformanceConfig

  // Monitoring Configuration
  monitoring: MonitoringConfig
}

export interface GlobalThreatIntelligenceConfig {
  networkId: string
  networkName: string
  regions: string[]
  primaryRegion: string
  failoverRegions: string[]
  syncInterval: number
  healthCheckInterval: number
  maxSyncRetries: number
  threatSharingEnabled: boolean
  realTimeProcessing: boolean
  encryptionEnabled: boolean
  compressionEnabled: boolean
}

export interface EdgeDetectionConfig {
  enabled: boolean
  modelUpdateInterval: number
  predictionThreshold: number
  anomalyThreshold: number
  classificationThreshold: number
  clusteringThreshold: number
  maxModelSize: number
  modelCacheSize: number
  realTimeProcessing: boolean
  batchProcessingSize: number
  aiModels: AIModelConfig[]
}

export interface AIModelConfig {
  modelId: string
  modelType:
    | 'anomaly_detection'
    | 'classification'
    | 'clustering'
    | 'prediction'
  modelPath: string
  inputShape: number[]
  outputShape: number[]
  threshold: number
  updateFrequency: number
  version: string
  metadata: Record<string, unknown>
}

export interface CorrelationEngineConfig {
  enabled: boolean
  correlationWindow: number
  similarityThreshold: number
  temporalThreshold: number
  spatialThreshold: number
  behavioralThreshold: number
  attributionThreshold: number
  maxCorrelations: number
  mlModels: MLModelConfig[]
  statisticalMethods: string[]
}

export interface MLModelConfig {
  modelId: string
  modelType: 'similarity' | 'clustering' | 'classification' | 'regression'
  algorithm: string
  parameters: Record<string, unknown>
  trainingData: string
  accuracy: number
  version: string
}

export interface DatabaseConfig {
  mongodb: MongoDBConfig
  redis: RedisConfig
  stixEnabled: boolean
  taxiiEnabled: boolean
  encryptionEnabled: boolean
  backupEnabled: boolean
  retentionPolicy: RetentionPolicy
}

export interface MongoDBConfig {
  uri: string
  database: string
  collections: CollectionConfig[]
  connectionPool: ConnectionPoolConfig
  readPreference: string
  writeConcern: string
  sslEnabled: boolean
  authEnabled: boolean
}

export interface CollectionConfig {
  name: string
  indexes: IndexConfig[]
  shardKey?: string
  ttl?: number
}

export interface IndexConfig {
  fields: Record<string, number>
  options: Record<string, unknown>
}

export interface ConnectionPoolConfig {
  minSize: number
  maxSize: number
  maxIdleTime: number
  maxLifeTime: number
  waitQueueTimeout: number
}

export interface RedisConfig {
  url: string
  cluster: boolean
  nodes: string[]
  password?: string
  db: number
  keyPrefix: string
  ttl: number
  maxMemory: string
  evictionPolicy: string
}

export interface RetentionPolicy {
  threats: number
  indicators: number
  logs: number
  metrics: number
  unit: 'days' | 'months' | 'years'
}

export interface OrchestrationConfig {
  automationLevel: 'full' | 'semi' | 'manual'
  responseStrategies: ResponseStrategy[]
  integrationEndpoints: IntegrationEndpoint[]
  escalationRules: EscalationRule[]
  maxResponseTime: number
  rollbackEnabled: boolean
  notificationEnabled: boolean
  approvalRequired: boolean
}

export interface ResponseStrategy {
  strategyId: string
  name: string
  description: string
  threatTypes: string[]
  severityLevels: string[]
  responseActions: ResponseAction[]
  conditions: ResponseCondition[]
  priority: number
}

export interface ResponseAction {
  actionId: string
  actionType: 'block' | 'isolate' | 'alert' | 'investigate' | 'mitigate'
  target: string
  parameters: Record<string, unknown>
  priority: number
  timeout: number
  rollbackStrategy?: string
}

export interface ResponseCondition {
  conditionType: 'threshold' | 'pattern' | 'time' | 'location'
  condition: string
  operator: 'greater_than' | 'less_than' | 'equals' | 'contains' | 'matches'
  value: any
}

export interface IntegrationEndpoint {
  endpointId: string
  service: string
  endpoint: string
  authType: string
  credentials: Record<string, string>
  enabled: boolean
  timeout: number
  retryPolicy: RetryPolicy
}

export interface EscalationRule {
  ruleId: string
  name: string
  conditions: ResponseCondition[]
  escalationLevel: number
  notificationRecipients: string[]
  autoEscalate: boolean
}

export interface RetryPolicy {
  maxRetries: number
  retryDelay: number
  backoffStrategy: 'linear' | 'exponential' | 'fixed'
}

export interface HuntingConfig {
  enabled: boolean
  huntPatterns: HuntPattern[]
  maxConcurrentHunts: number
  huntTimeout: number
  resultLimit: number
  schedulingEnabled: boolean
  aiAssisted: boolean
  falsePositiveReduction: boolean
  threatDiscoveryThreshold: number
}

export interface HuntPattern {
  patternId: string
  name: string
  description: string
  patternType:
    | 'network'
    | 'endpoint'
    | 'user_behavior'
    | 'malware'
    | 'lateral_movement'
    | 'custom'
  query: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
  indicators: string[]
  conditions: HuntCondition[]
  actions: HuntAction[]
  metadata: Record<string, unknown>
}

export interface HuntCondition {
  field: string
  operator: string
  value: any
  weight: number
}

export interface HuntAction {
  actionType: 'alert' | 'block' | 'investigate' | 'collect'
  target: string
  parameters: Record<string, unknown>
}

export interface FeedIntegrationConfig {
  enabled: boolean
  feedSources: FeedSource[]
  maxSubscriptions: number
  fetchInterval: number
  processingBatchSize: number
  deduplicationEnabled: boolean
  filteringEnabled: boolean
  validationEnabled: boolean
  threatConversionEnabled: boolean
  apiTimeout: number
  rateLimiting: RateLimitConfig
}

export interface FeedSource {
  sourceId: string
  name: string
  provider: string
  feedType: 'stix' | 'taxii' | 'misp' | 'otx' | 'virustotal' | 'generic'
  endpoint: string
  authType: 'api_key' | 'bearer' | 'basic' | 'none'
  requiresAuth: boolean
  updateFrequency: 'real-time' | 'hourly' | 'daily' | 'weekly'
  parameters: Record<string, unknown>
  filters: Record<string, unknown>
  enabled: boolean
}

export interface RateLimitConfig {
  requestsPerMinute: number
  requestsPerHour: number
  requestsPerDay: number
  burstAllowance: number
}

export interface ValidationConfig {
  validationThreshold: number
  validationRules: ValidationRule[]
  indicatorValidation: boolean
  attributionValidation: boolean
  metadataValidation: boolean
  crossReferenceValidation: boolean
  reputationChecking: boolean
  falsePositiveDetection: boolean
  customRulesEnabled: boolean
  aiAssistedValidation: boolean
}

export interface ValidationRule {
  ruleId: string
  name: string
  description: string
  ruleType: 'structure' | 'content' | 'cross_reference' | 'custom'
  severity: 'low' | 'medium' | 'high' | 'critical'
  conditions: ValidationCondition[]
  enabled: boolean
  weight: number
}

export interface ValidationCondition {
  type:
    | 'field_exists'
    | 'field_value'
    | 'regex_match'
    | 'range_check'
    | 'whitelist'
    | 'blacklist'
  field: string
  operator?: string
  value?: any
  pattern?: string
  min?: number
  max?: number
  values?: any[]
  required: boolean
}

export interface RegionConfig {
  regionId: string
  regionName: string
  location: string
  timezone: string
  primary: boolean
  failover: boolean
  dataCenters: string[]
  networkConfig: NetworkConfig
  compliance: ComplianceConfig
}

export interface NetworkConfig {
  subnets: string[]
  gateways: string[]
  loadBalancers: string[]
  cdnEndpoints: string[]
  dnsServers: string[]
}

export interface ComplianceConfig {
  gdpr: boolean
  hipaa: boolean
  sox: boolean
  pci: boolean
  dataResidency: string[]
  encryptionRequirements: string[]
}

export interface SecurityConfig {
  encryption: EncryptionConfig
  authentication: AuthenticationConfig
  authorization: AuthorizationConfig
  auditLogging: AuditLoggingConfig
  rateLimiting: SecurityRateLimitConfig
  inputValidation: InputValidationConfig
}

export interface EncryptionConfig {
  enabled: boolean
  algorithm: string
  keySize: number
  keyRotationInterval: number
  fheEnabled: boolean
}

export interface AuthenticationConfig {
  method: 'jwt' | 'oauth' | 'api_key' | 'multi_factor'
  providers: string[]
  tokenExpiration: number
  refreshTokenEnabled: boolean
  sessionManagement: boolean
}

export interface AuthorizationConfig {
  method: 'rbac' | 'abac' | 'pbac'
  roles: string[]
  permissions: string[]
  policyEngine: string
}

export interface AuditLoggingConfig {
  enabled: boolean
  logLevel: string
  retentionPeriod: number
  destinations: string[]
  encryption: boolean
}

export interface SecurityRateLimitConfig {
  enabled: boolean
  windowMs: number
  maxRequests: number
  skipSuccessfulRequests: boolean
  skipFailedRequests: boolean
}

export interface InputValidationConfig {
  enabled: boolean
  sanitizeHtml: boolean
  validateJson: boolean
  maxPayloadSize: number
  allowedFileTypes: string[]
}

export interface PerformanceConfig {
  caching: CacheConfig
  connectionPooling: ConnectionPoolConfig
  loadBalancing: LoadBalancingConfig
  compression: CompressionConfig
  optimization: OptimizationConfig
}

export interface CacheConfig {
  enabled: boolean
  provider: 'redis' | 'memcached' | 'memory'
  ttl: number
  maxSize: number
  evictionPolicy: string
}

export interface LoadBalancingConfig {
  enabled: boolean
  algorithm: 'round_robin' | 'least_connections' | 'ip_hash' | 'weighted'
  healthCheck: HealthCheckConfig
  failover: FailoverConfig
}

export interface HealthCheckConfig {
  enabled: boolean
  interval: number
  timeout: number
  retries: number
  endpoint: string
}

export interface FailoverConfig {
  enabled: boolean
  timeout: number
  retryAttempts: number
  backupEndpoints: string[]
}

export interface CompressionConfig {
  enabled: boolean
  algorithm: 'gzip' | 'brotli' | 'deflate'
  level: number
  threshold: number
}

export interface OptimizationConfig {
  queryOptimization: boolean
  indexOptimization: boolean
  memoryOptimization: boolean
  networkOptimization: boolean
  batchSize: number
  parallelProcessing: boolean
}

export interface MonitoringConfig {
  metrics: MetricsConfig
  alerting: AlertingConfig
  logging: LoggingConfig
  tracing: TracingConfig
}

export interface MetricsConfig {
  enabled: boolean
  provider: 'prometheus' | 'grafana' | 'datadog' | 'custom'
  interval: number
  labels: string[]
  customMetrics: string[]
}

export interface AlertingConfig {
  enabled: boolean
  providers: string[]
  severityLevels: string[]
  notificationChannels: string[]
  escalationRules: EscalationRule[]
}

export interface LoggingConfig {
  enabled: boolean
  level: string
  format: string
  destinations: string[]
  structuredLogging: boolean
  correlationIds: boolean
}

export interface TracingConfig {
  enabled: boolean
  provider: 'jaeger' | 'zipkin' | 'opentelemetry' | 'custom'
  samplingRate: number
  maxSpans: number
  spanRetention: number
}

// Default Configuration
export const DEFAULT_THREAT_INTELLIGENCE_CONFIG: ThreatIntelligenceConfig = {
  global: {
    networkId: 'pixelated-global-threat-network',
    networkName: 'Pixelated Global Threat Intelligence Network',
    regions: ['us-east-1', 'eu-west-1', 'ap-southeast-1'],
    primaryRegion: 'us-east-1',
    failoverRegions: ['eu-west-1', 'ap-southeast-1'],
    syncInterval: 30000, // 30 seconds
    healthCheckInterval: 60000, // 1 minute
    maxSyncRetries: 3,
    threatSharingEnabled: true,
    realTimeProcessing: true,
    encryptionEnabled: true,
    compressionEnabled: true,
  },

  edge: {
    enabled: true,
    modelUpdateInterval: 3600000, // 1 hour
    predictionThreshold: 0.7,
    anomalyThreshold: 0.8,
    classificationThreshold: 0.75,
    clusteringThreshold: 0.6,
    maxModelSize: 100 * 1024 * 1024, // 100MB
    modelCacheSize: 10,
    realTimeProcessing: true,
    batchProcessingSize: 1000,
    aiModels: [
      {
        modelId: 'anomaly-detection-v1',
        modelType: 'anomaly_detection',
        modelPath: '/models/anomaly_detection/model.json',
        inputShape: [100],
        outputShape: [1],
        threshold: 0.8,
        updateFrequency: 3600000,
        version: '1.0.0',
        metadata: {
          description: 'Anomaly detection model for network traffic',
          accuracy: 0.95,
        },
      },
      {
        modelId: 'threat-classification-v1',
        modelType: 'classification',
        modelPath: '/models/classification/model.json',
        inputShape: [50],
        outputShape: [5],
        threshold: 0.75,
        updateFrequency: 7200000,
        version: '1.0.0',
        metadata: {
          description: 'Multi-class threat classification model',
          accuracy: 0.92,
        },
      },
    ],
  },

  correlation: {
    enabled: true,
    correlationWindow: 3600000, // 1 hour
    similarityThreshold: 0.7,
    temporalThreshold: 1800000, // 30 minutes
    spatialThreshold: 0.8,
    behavioralThreshold: 0.75,
    attributionThreshold: 0.6,
    maxCorrelations: 100,
    mlModels: [
      {
        modelId: 'similarity-model-v1',
        modelType: 'similarity',
        algorithm: 'cosine_similarity',
        parameters: { threshold: 0.7 },
        trainingData: 'threat_intelligence_corpus',
        accuracy: 0.88,
        version: '1.0.0',
      },
      {
        modelId: 'clustering-model-v1',
        modelType: 'clustering',
        algorithm: 'kmeans',
        parameters: { k: 5, maxIterations: 100 },
        trainingData: 'threat_behavior_dataset',
        accuracy: 0.85,
        version: '1.0.0',
      },
    ],
    statisticalMethods: [
      'correlation',
      'regression',
      'time_series',
      'clustering',
    ],
  },

  database: {
    mongodb: {
      uri:
        process.env.MONGODB_URI ||
        'mongodb://localhost:27017/threat_intelligence',
      database: 'threat_intelligence',
      collections: [
        {
          name: 'threats',
          indexes: [
            { fields: { threatId: 1 }, options: { unique: true } },
            { fields: { severity: 1, createdAt: -1 }, options: {} },
            { fields: { 'indicators.value': 1 }, options: {} },
            { fields: { regions: 1 }, options: {} },
          ],
          shardKey: 'threatId',
          ttl: 90 * 24 * 60 * 60, // 90 days
        },
        {
          name: 'indicators',
          indexes: [
            {
              fields: { value: 1, indicatorType: 1 },
              options: { unique: true },
            },
            { fields: { confidence: -1 }, options: {} },
            { fields: { firstSeen: -1 }, options: {} },
          ],
          ttl: 180 * 24 * 60 * 60, // 180 days
        },
      ],
      connectionPool: {
        minSize: 5,
        maxSize: 20,
        maxIdleTime: 30000,
        maxLifeTime: 3600000,
        waitQueueTimeout: 10000,
      },
      readPreference: 'primaryPreferred',
      writeConcern: 'majority',
      sslEnabled: true,
      authEnabled: true,
    },
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      cluster: false,
      nodes: [process.env.REDIS_URL || 'redis://localhost:6379'],
      db: 0,
      keyPrefix: 'threat_intel:',
      ttl: 3600, // 1 hour
      maxMemory: '1gb',
      evictionPolicy: 'allkeys-lru',
    },
    stixEnabled: true,
    taxiiEnabled: true,
    encryptionEnabled: true,
    backupEnabled: true,
    retentionPolicy: {
      threats: 2,
      indicators: 1,
      logs: 30,
      metrics: 90,
      unit: 'years',
    },
  },

  orchestration: {
    automationLevel: 'semi',
    responseStrategies: [
      {
        strategyId: 'critical_threat_response',
        name: 'Critical Threat Response',
        description: 'Automated response for critical threats',
        threatTypes: ['malware', 'c2', 'data_breach'],
        severityLevels: ['critical'],
        responseActions: [
          {
            actionId: 'block_critical',
            actionType: 'block',
            target: 'firewall',
            parameters: { duration: '24h', scope: 'global' },
            priority: 10,
            timeout: 30000,
            rollbackStrategy: 'unblock_critical',
          },
          {
            actionId: 'alert_security_team',
            actionType: 'alert',
            target: 'security_team',
            parameters: { priority: 'critical', channels: ['email', 'slack'] },
            priority: 9,
            timeout: 10000,
          },
        ],
        conditions: [
          {
            conditionType: 'threshold',
            condition: 'confidence',
            operator: 'greater_than',
            value: 0.8,
          },
        ],
        priority: 100,
      },
    ],
    integrationEndpoints: [
      {
        endpointId: 'firewall_integration',
        service: 'firewall',
        endpoint: 'https://firewall.internal/api/v1/block',
        authType: 'api_key',
        credentials: { apiKey: process.env.FIREWALL_API_KEY || '' },
        enabled: true,
        timeout: 30000,
        retryPolicy: {
          maxRetries: 3,
          retryDelay: 5000,
          backoffStrategy: 'exponential',
        },
      },
    ],
    escalationRules: [
      {
        ruleId: 'critical_escalation',
        name: 'Critical Threat Escalation',
        conditions: [
          {
            conditionType: 'threshold',
            condition: 'severity',
            operator: 'equals',
            value: 'critical',
          },
        ],
        escalationLevel: 1,
        notificationRecipients: [
          'security-team@company.com',
          'ciso@company.com',
        ],
        autoEscalate: true,
      },
    ],
    maxResponseTime: 300000, // 5 minutes
    rollbackEnabled: true,
    notificationEnabled: true,
    approvalRequired: false,
  },

  hunting: {
    enabled: true,
    huntPatterns: [
      {
        patternId: 'network_anomaly_detection',
        name: 'Network Anomaly Detection',
        description: 'Detects unusual network patterns and behaviors',
        patternType: 'network',
        query:
          'SELECT * FROM network_logs WHERE bytes_transferred > 1000000 AND destination_port IN (22, 23, 135, 139, 445, 1433, 3389)',
        severity: 'high',
        confidence: 0.8,
        indicators: [
          'suspicious_connection',
          'port_scanning',
          'data_exfiltration',
        ],
        conditions: [
          {
            field: 'bytes_transferred',
            operator: 'greater_than',
            value: 1000000,
            weight: 0.7,
          },
          {
            field: 'destination_port',
            operator: 'in',
            value: [22, 23, 135, 139, 445, 1433, 3389],
            weight: 0.3,
          },
        ],
        actions: [
          {
            actionType: 'investigate',
            target: 'network_logs',
            parameters: { depth: 'detailed', timeframe: '24h' },
          },
        ],
        metadata: {
          category: 'network_security',
          tactics: ['discovery', 'lateral_movement'],
          techniques: ['T1046', 'T1041'],
        },
      },
    ],
    maxConcurrentHunts: 10,
    huntTimeout: 300000, // 5 minutes
    resultLimit: 1000,
    schedulingEnabled: true,
    aiAssisted: true,
    falsePositiveReduction: true,
    threatDiscoveryThreshold: 0.7,
  },

  feeds: {
    enabled: true,
    feedSources: [
      {
        sourceId: 'otx_alien_vault',
        name: 'AlienVault OTX',
        provider: 'AlienVault',
        feedType: 'otx',
        endpoint: 'https://otx.alienvault.com/api/v1/pulses/subscribed',
        authType: 'api_key',
        requiresAuth: true,
        updateFrequency: 'hourly',
        parameters: { limit: 100 },
        filters: {
          minConfidence: 0.5,
          severity: ['medium', 'high', 'critical'],
        },
        enabled: true,
      },
      {
        sourceId: 'virustotal_intelligence',
        name: 'VirusTotal Intelligence',
        provider: 'VirusTotal',
        feedType: 'virustotal',
        endpoint:
          'https://www.virustotal.com/api/v3/intelligence/hunting_notifications',
        authType: 'api_key',
        requiresAuth: true,
        updateFrequency: 'real-time',
        parameters: { limit: 50 },
        filters: { maliciousCount: 5 },
        enabled: true,
      },
    ],
    maxSubscriptions: 20,
    fetchInterval: 300000, // 5 minutes
    processingBatchSize: 100,
    deduplicationEnabled: true,
    filteringEnabled: true,
    validationEnabled: true,
    threatConversionEnabled: true,
    apiTimeout: 30000,
    rateLimiting: {
      requestsPerMinute: 60,
      requestsPerHour: 1000,
      requestsPerDay: 10000,
      burstAllowance: 10,
    },
  },

  validation: {
    validationThreshold: 70,
    validationRules: [
      {
        ruleId: 'structure_validation',
        name: 'Threat Structure Validation',
        description: 'Validates basic threat intelligence structure',
        ruleType: 'structure',
        severity: 'critical',
        conditions: [
          {
            type: 'field_exists',
            field: 'threatId',
            required: true,
          },
          {
            type: 'field_exists',
            field: 'threatType',
            required: true,
          },
          {
            type: 'field_value',
            field: 'severity',
            operator: 'whitelist',
            values: ['low', 'medium', 'high', 'critical'],
            required: true,
          },
        ],
        enabled: true,
        weight: 1.0,
      },
    ],
    indicatorValidation: true,
    attributionValidation: true,
    metadataValidation: true,
    crossReferenceValidation: true,
    reputationChecking: true,
    falsePositiveDetection: true,
    customRulesEnabled: true,
    aiAssistedValidation: false,
  },

  regions: [
    {
      regionId: 'us-east-1',
      regionName: 'US East (N. Virginia)',
      location: 'US',
      timezone: 'America/New_York',
      primary: true,
      failover: false,
      dataCenters: ['us-east-1a', 'us-east-1b', 'us-east-1c'],
      networkConfig: {
        subnets: ['10.0.1.0/24', '10.0.2.0/24', '10.0.3.0/24'],
        gateways: ['10.0.0.1', '10.0.0.2'],
        loadBalancers: ['lb-us-east-1.pixelated.com'],
        cdnEndpoints: ['cdn-us-east-1.pixelated.com'],
        dnsServers: ['8.8.8.8', '8.8.4.4'],
      },
      compliance: {
        gdpr: true,
        hipaa: true,
        sox: false,
        pci: true,
        dataResidency: ['US'],
        encryptionRequirements: ['AES-256', 'TLS-1.3'],
      },
    },
    {
      regionId: 'eu-west-1',
      regionName: 'EU (Ireland)',
      location: 'EU',
      timezone: 'Europe/Dublin',
      primary: false,
      failover: true,
      dataCenters: ['eu-west-1a', 'eu-west-1b', 'eu-west-1c'],
      networkConfig: {
        subnets: ['10.1.1.0/24', '10.1.2.0/24', '10.1.3.0/24'],
        gateways: ['10.1.0.1', '10.1.0.2'],
        loadBalancers: ['lb-eu-west-1.pixelated.com'],
        cdnEndpoints: ['cdn-eu-west-1.pixelated.com'],
        dnsServers: ['8.8.8.8', '8.8.4.4'],
      },
      compliance: {
        gdpr: true,
        hipaa: false,
        sox: false,
        pci: true,
        dataResidency: ['EU'],
        encryptionRequirements: ['AES-256', 'TLS-1.3', 'GDPR-Compliant'],
      },
    },
  ],

  security: {
    encryption: {
      enabled: true,
      algorithm: 'AES-256-GCM',
      keySize: 256,
      keyRotationInterval: 2592000000, // 30 days
      fheEnabled: false,
    },
    authentication: {
      method: 'jwt',
      providers: ['better-auth'],
      tokenExpiration: 3600000, // 1 hour
      refreshTokenEnabled: true,
      sessionManagement: true,
    },
    authorization: {
      method: 'rbac',
      roles: ['admin', 'analyst', 'viewer', 'system'],
      permissions: ['read', 'write', 'delete', 'admin'],
      policyEngine: 'casbin',
    },
    auditLogging: {
      enabled: true,
      logLevel: 'info',
      retentionPeriod: 2555, // 7 years
      destinations: ['file', 'database', 'elasticsearch'],
      encryption: true,
    },
    rateLimiting: {
      enabled: true,
      windowMs: 60000, // 1 minute
      maxRequests: 100,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
    },
    inputValidation: {
      enabled: true,
      sanitizeHtml: true,
      validateJson: true,
      maxPayloadSize: 10485760, // 10MB
      allowedFileTypes: ['.json', '.csv', '.xml', '.stix', '.taxii'],
    },
  },

  performance: {
    caching: {
      enabled: true,
      provider: 'redis',
      ttl: 3600, // 1 hour
      maxSize: 1073741824, // 1GB
      evictionPolicy: 'lru',
    },
    connectionPooling: {
      minSize: 5,
      maxSize: 20,
      maxIdleTime: 30000,
      maxLifeTime: 3600000,
      waitQueueTimeout: 10000,
    },
    loadBalancing: {
      enabled: true,
      algorithm: 'least_connections',
      healthCheck: {
        enabled: true,
        interval: 30000,
        timeout: 5000,
        retries: 3,
        endpoint: '/health',
      },
      failover: {
        enabled: true,
        timeout: 30000,
        retryAttempts: 3,
        backupEndpoints: ['backup1.pixelated.com', 'backup2.pixelated.com'],
      },
    },
    compression: {
      enabled: true,
      algorithm: 'gzip',
      level: 6,
      threshold: 1024, // 1KB
    },
    optimization: {
      queryOptimization: true,
      indexOptimization: true,
      memoryOptimization: true,
      networkOptimization: true,
      batchSize: 1000,
      parallelProcessing: true,
    },
  },

  monitoring: {
    metrics: {
      enabled: true,
      provider: 'prometheus',
      interval: 15000, // 15 seconds
      labels: ['region', 'service', 'environment'],
      customMetrics: ['threat_count', 'validation_score', 'response_time'],
    },
    alerting: {
      enabled: true,
      providers: ['email', 'slack', 'pagerduty'],
      severityLevels: ['warning', 'critical', 'emergency'],
      notificationChannels: ['email', 'slack'],
      escalationRules: [],
    },
    logging: {
      enabled: true,
      level: 'info',
      format: 'json',
      destinations: ['file', 'elasticsearch'],
      structuredLogging: true,
      correlationIds: true,
    },
    tracing: {
      enabled: true,
      provider: 'opentelemetry',
      samplingRate: 0.1,
      maxSpans: 1000,
      spanRetention: 604800000, // 7 days
    },
  },
}

export class ThreatIntelligenceConfigManager {
  private config: ThreatIntelligenceConfig
  private redis: Redis
  private mongoClient: MongoClient
  private db: Db

  constructor(
    config: ThreatIntelligenceConfig = DEFAULT_THREAT_INTELLIGENCE_CONFIG,
  ) {
    this.config = config
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Threat Intelligence Configuration Manager')

      // Initialize Redis connection
      await this.initializeRedis()

      // Initialize MongoDB connection
      await this.initializeMongoDB()

      // Load configuration from database if available
      await this.loadConfiguration()

      // Validate configuration
      this.validateConfiguration()

      logger.info(
        'Threat Intelligence Configuration Manager initialized successfully',
      )
    } catch (error) {
      logger.error('Failed to initialize Configuration Manager:', { error })
      throw error
    }
  }

  private async initializeRedis(): Promise<void> {
    try {
      this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
      await this.redis.ping()
      logger.info('Redis connection established for configuration manager')
    } catch (error) {
      logger.error('Failed to connect to Redis:', { error })
      throw new Error('Redis connection failed', { cause: error })
    }
  }

  private async initializeMongoDB(): Promise<void> {
    try {
      this.mongoClient = new MongoClient(
        process.env.MONGODB_URI ||
          'mongodb://localhost:27017/threat_intelligence',
      )
      await this.mongoClient.connect()
      this.db = this.mongoClient.db('threat_intelligence')
      logger.info('MongoDB connection established for configuration manager')
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', { error })
      throw new Error('MongoDB connection failed', { cause: error })
    }
  }

  private async loadConfiguration(): Promise<void> {
    try {
      const configCollection = this.db.collection('configuration')
      const storedConfig = await configCollection.findOne({
        configId: 'threat_intelligence',
      })

      if (storedConfig) {
        this.config = { ...this.config, ...storedConfig.config }
        logger.info('Configuration loaded from database')
      } else {
        // Store default configuration
        await this.storeConfiguration()
        logger.info('Default configuration stored in database')
      }
    } catch (error) {
      logger.error('Failed to load configuration:', { error })
    }
  }

  private validateConfiguration(): void {
    try {
      // Validate required fields
      if (!this.config.global.networkId) {
        throw new Error('Global network ID is required')
      }

      if (!this.config.database.mongodb.uri) {
        throw new Error('MongoDB URI is required')
      }

      if (!this.config.database.redis.url) {
        throw new Error('Redis URL is required')
      }

      // Validate region configuration
      if (this.config.regions.length === 0) {
        throw new Error('At least one region must be configured')
      }

      const primaryRegions = this.config.regions.filter((r) => r.primary)
      if (primaryRegions.length !== 1) {
        throw new Error('Exactly one primary region must be configured')
      }

      logger.info('Configuration validation passed')
    } catch (error) {
      logger.error('Configuration validation failed:', { error })
      throw error
    }
  }

  private async storeConfiguration(): Promise<void> {
    try {
      const configCollection = this.db.collection('configuration')
      await configCollection.replaceOne(
        { configId: 'threat_intelligence' },
        {
          configId: 'threat_intelligence',
          config: this.config,
          updatedAt: new Date(),
        },
        { upsert: true },
      )

      // Cache in Redis
      await this.redis.setex(
        'threat_intel:config',
        3600, // 1 hour
        JSON.stringify(this.config),
      )
    } catch (error) {
      logger.error('Failed to store configuration:', { error })
      throw error
    }
  }

  getConfig(): ThreatIntelligenceConfig {
    return this.config
  }

  getGlobalConfig(): GlobalThreatIntelligenceConfig {
    return this.config.global
  }

  getEdgeConfig(): EdgeDetectionConfig {
    return this.config.edge
  }

  getCorrelationConfig(): CorrelationEngineConfig {
    return this.config.correlation
  }

  getDatabaseConfig(): DatabaseConfig {
    return this.config.database
  }

  getOrchestrationConfig(): OrchestrationConfig {
    return this.config.orchestration
  }

  getHuntingConfig(): HuntingConfig {
    return this.config.hunting
  }

  getFeedsConfig(): FeedIntegrationConfig {
    return this.config.feeds
  }

  getValidationConfig(): ValidationConfig {
    return this.config.validation
  }

  getRegionsConfig(): RegionConfig[] {
    return this.config.regions
  }

  getSecurityConfig(): SecurityConfig {
    return this.config.security
  }

  getPerformanceConfig(): PerformanceConfig {
    return this.config.performance
  }

  getMonitoringConfig(): MonitoringConfig {
    return this.config.monitoring
  }

  async updateConfig(
    updates: Partial<ThreatIntelligenceConfig>,
  ): Promise<void> {
    try {
      logger.info('Updating threat intelligence configuration')

      // Deep merge updates
      this.config = this.deepMerge(this.config, updates)

      // Validate updated configuration
      this.validateConfiguration()

      // Store updated configuration
      await this.storeConfiguration()

      logger.info('Configuration updated successfully')
    } catch (error) {
      logger.error('Failed to update configuration:', { error })
      throw error
    }
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target }

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        if (
          source[key] &&
          typeof source[key] === 'object' &&
          !Array.isArray(source[key])
        ) {
          result[key] = this.deepMerge(result[key] || {}, source[key])
        } else {
          result[key] = source[key]
        }
      }
    }

    return result
  }

  async getConfigByRegion(regionId: string): Promise<RegionConfig | undefined> {
    return this.config.regions.find((r) => r.regionId === regionId)
  }

  async updateRegionConfig(
    regionId: string,
    updates: Partial<RegionConfig>,
  ): Promise<void> {
    try {
      const regionIndex = this.config.regions.findIndex(
        (r) => r.regionId === regionId,
      )

      if (regionIndex === -1) {
        throw new Error(`Region not found: ${regionId}`)
      }

      this.config.regions[regionIndex] = {
        ...this.config.regions[regionIndex],
        ...updates,
      }

      await this.storeConfiguration()

      logger.info('Region configuration updated', { regionId })
    } catch (error) {
      logger.error('Failed to update region configuration:', {
        error,
        regionId,
      })
      throw error
    }
  }

  async addRegionConfig(regionConfig: RegionConfig): Promise<void> {
    try {
      // Check if region already exists
      const existingRegion = this.config.regions.find(
        (r) => r.regionId === regionConfig.regionId,
      )
      if (existingRegion) {
        throw new Error(`Region already exists: ${regionConfig.regionId}`)
      }

      this.config.regions.push(regionConfig)
      await this.storeConfiguration()

      logger.info('Region configuration added', {
        regionId: regionConfig.regionId,
      })
    } catch (error) {
      logger.error('Failed to add region configuration:', {
        error,
        regionId: regionConfig.regionId,
      })
      throw error
    }
  }

  async removeRegionConfig(regionId: string): Promise<void> {
    try {
      const regionIndex = this.config.regions.findIndex(
        (r) => r.regionId === regionId,
      )

      if (regionIndex === -1) {
        throw new Error(`Region not found: ${regionId}`)
      }

      // Don't allow removal of primary region
      if (this.config.regions[regionIndex].primary) {
        throw new Error('Cannot remove primary region')
      }

      this.config.regions.splice(regionIndex, 1)
      await this.storeConfiguration()

      logger.info('Region configuration removed', { regionId })
    } catch (error) {
      logger.error('Failed to remove region configuration:', {
        error,
        regionId,
      })
      throw error
    }
  }

  async refreshConfig(): Promise<void> {
    try {
      logger.info('Refreshing configuration from database')

      // Clear Redis cache
      await this.redis.del('threat_intel:config')

      // Reload from database
      await this.loadConfiguration()

      logger.info('Configuration refreshed successfully')
    } catch (error) {
      logger.error('Failed to refresh configuration:', { error })
      throw error
    }
  }

  async getConfigHash(): Promise<string> {
    const crypto = await import('crypto')
    const configString = JSON.stringify(this.config)
    return crypto.createHash('sha256').update(configString).digest('hex')
  }

  async validateEnvironment(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = []

    try {
      // Check required environment variables
      const requiredEnvVars = ['MONGODB_URI', 'REDIS_URL']

      for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
          issues.push(`Missing required environment variable: ${envVar}`)
        }
      }

      // Check optional but recommended variables
      const recommendedEnvVars = [
        'OPENAI_API_KEY',
        'GOOGLE_AI_API_KEY',
        'SENTRY_DSN',
      ]

      for (const envVar of recommendedEnvVars) {
        if (!process.env[envVar]) {
          issues.push(`Recommended environment variable not set: ${envVar}`)
        }
      }

      // Test database connections
      try {
        await this.redis.ping()
      } catch (error) {
        issues.push('Redis connection failed: ' + error.message)
      }

      try {
        await this.mongoClient.db().admin().ping()
      } catch (error) {
        issues.push('MongoDB connection failed: ' + error.message)
      }

      return {
        valid:
          issues.filter((i) => i.startsWith('Missing required')).length === 0,
        issues,
      }
    } catch (error) {
      issues.push('Environment validation error: ' + error.message)
      return { valid: false, issues }
    }
  }

  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down Threat Intelligence Configuration Manager')

      if (this.redis) {
        await this.redis.quit()
      }

      if (this.mongoClient) {
        await this.mongoClient.close()
      }

      logger.info(
        'Threat Intelligence Configuration Manager shutdown completed',
      )
    } catch (error) {
      logger.error('Error during shutdown:', { error })
      throw error
    }
  }
}
