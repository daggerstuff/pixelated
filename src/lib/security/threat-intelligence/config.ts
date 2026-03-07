/**
 * Global Threat Intelligence Network Configuration
 * Centralized configuration for all threat intelligence components
 */

import { ThreatIntelligenceDatabaseConfig } from './ThreatIntelligenceDatabase'
import { GlobalThreatIntelligenceNetworkConfig } from './GlobalThreatIntelligenceNetwork'
import { EdgeThreatDetectionSystemConfig } from './EdgeThreatDetectionSystem'
import { ThreatCorrelationEngineConfig } from './ThreatCorrelationEngine'
import { AutomatedThreatResponseOrchestratorConfig } from './AutomatedThreatResponseOrchestrator'
import { ThreatHuntingSystemConfig } from './ThreatHuntingSystem'
import { ExternalThreatFeedIntegrationConfig } from './ExternalThreatFeedIntegration'
import { ThreatValidationSystemConfig } from './ThreatValidationSystem'

// NODE_ENV checks are available inline where needed; avoid unused bindings to satisfy linter.

const baseConfig = {
  mongodb: {
    url: process.env.MONGODB_URI || 'mongodb://localhost:27017/pixelated',
    database: process.env.MONGODB_DATABASE || 'pixelated_threat_intel',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD,
  },
  regions: {
    primary: process.env.PRIMARY_REGION || 'us-east-1',
    secondary: (
      process.env.SECONDARY_REGIONS || 'eu-west-1,ap-southeast-1'
    ).split(','),
    edge_locations: (process.env.EDGE_LOCATIONS || '50').split(',').map(Number),
  },
  security: {
    jwt_secret: process.env.JWT_SECRET || 'your-jwt-secret-key',
    encryption_key:
      process.env.ENCRYPTION_KEY || 'your-encryption-key-32-chars-long',
    rate_limiting: {
      window_ms: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
      max_requests: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    },
  },
  monitoring: {
    sentry_dsn: process.env.SENTRY_DSN,
    prometheus_port: parseInt(process.env.PROMETHEUS_PORT || '9090'),
    grafana_port: parseInt(process.env.GRAFANA_PORT || '3000'),
  },
}

export const threatIntelDatabaseConfig: ThreatIntelligenceDatabaseConfig = {
  ...baseConfig,
  stix_taxii: {
    enabled: process.env.STIX_TAXII_ENABLED === 'true',
    version: process.env.STIX_VERSION || '2.1',
    collection_name: process.env.STIX_COLLECTION || 'threat-intel',
    taxii_server: process.env.TAXII_SERVER || 'https://taxii.example.com',
    taxii_username: process.env.TAXII_USERNAME,
    taxii_password: process.env.TAXII_PASSWORD,
  },
  data_retention: {
    indicators_days: parseInt(process.env.INDICATOR_RETENTION_DAYS || '365'),
    events_days: parseInt(process.env.EVENT_RETENTION_DAYS || '730'),
    audit_logs_days: parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '2555'), // 7 years
  },
  encryption: {
    enabled: process.env.ENCRYPTION_ENABLED !== 'false',
    algorithm: 'aes-256-gcm',
    key_rotation_days: parseInt(process.env.KEY_ROTATION_DAYS || '90'),
  },
  backup: {
    enabled: process.env.BACKUP_ENABLED !== 'false',
    schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *', // Daily at 2 AM
    retention_days: parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
    storage_provider: process.env.BACKUP_STORAGE || 's3',
  },
}

export const globalThreatIntelConfig: GlobalThreatIntelligenceNetworkConfig = {
  ...baseConfig,
  regions: {
    us_east_1: {
      name: 'US East (N. Virginia)',
      endpoint:
        process.env.US_EAST_ENDPOINT || 'https://api-us-east.pixelated.com',
      priority: 1,
      capabilities: ['full_processing', 'ai_analysis', 'correlation'],
      max_capacity: parseInt(process.env.US_EAST_CAPACITY || '10000'),
    },
    eu_west_1: {
      name: 'Europe (Ireland)',
      endpoint:
        process.env.EU_WEST_ENDPOINT || 'https://api-eu-west.pixelated.com',
      priority: 2,
      capabilities: ['full_processing', 'ai_analysis', 'correlation'],
      max_capacity: parseInt(process.env.EU_WEST_CAPACITY || '8000'),
    },
    ap_southeast_1: {
      name: 'Asia Pacific (Singapore)',
      endpoint:
        process.env.AP_SOUTHEAST_ENDPOINT ||
        'https://api-ap-southeast.pixelated.com',
      priority: 3,
      capabilities: ['full_processing', 'ai_analysis', 'correlation'],
      max_capacity: parseInt(process.env.AP_SOUTHEAST_CAPACITY || '6000'),
    },
  },
  sync_settings: {
    interval_ms: parseInt(process.env.SYNC_INTERVAL_MS || '30000'), // 30 seconds
    batch_size: parseInt(process.env.SYNC_BATCH_SIZE || '1000'),
    max_retries: parseInt(process.env.SYNC_MAX_RETRIES || '3'),
    timeout_ms: parseInt(process.env.SYNC_TIMEOUT_MS || '10000'),
  },
  propagation: {
    enabled: process.env.PROPAGATION_ENABLED !== 'false',
    method: process.env.PROPAGATION_METHOD || 'push_pull',
    priority_levels: (
      process.env.PROPAGATION_PRIORITIES || 'critical,high,medium,low'
    ).split(','),
  },
  health_check: {
    enabled: process.env.HEALTH_CHECK_ENABLED !== 'false',
    interval_ms: parseInt(process.env.HEALTH_CHECK_INTERVAL || '60000'), // 1 minute
    timeout_ms: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000'),
  },
}

export const edgeThreatDetectionConfig: EdgeThreatDetectionSystemConfig = {
  ...baseConfig,
  edge_locations: baseConfig.regions.edge_locations.map((location, index) => ({
    id: `edge-${index + 1}`,
    region:
      baseConfig.regions.secondary[
        index % baseConfig.regions.secondary.length
      ] || baseConfig.regions.primary,
    endpoint: `https://edge-${index + 1}.pixelated.com`,
    capabilities: ['detection', 'filtering', 'caching'],
    max_capacity: 1000,
  })),
  ml_models: {
    anomaly_detection: {
      enabled: process.env.ANOMALY_DETECTION_ENABLED !== 'false',
      model_path:
        process.env.ANOMALY_MODEL_PATH || '/models/anomaly_detection.tf',
      threshold: parseFloat(process.env.ANOMALY_THRESHOLD || '0.7'),
      update_frequency: parseInt(process.env.ANOMALY_UPDATE_FREQ || '86400000'), // 24 hours
    },
    threat_classification: {
      enabled: process.env.THREAT_CLASSIFICATION_ENABLED !== 'false',
      model_path:
        process.env.CLASSIFICATION_MODEL_PATH || '/models/threat_classifier.tf',
      confidence_threshold: parseFloat(
        process.env.CLASSIFICATION_THRESHOLD || '0.8',
      ),
      classes: (
        process.env.THREAT_CLASSES || 'malware,phishing,ddos,data_breach'
      ).split(','),
    },
    clustering: {
      enabled: process.env.CLUSTERING_ENABLED !== 'false',
      model_path:
        process.env.CLUSTERING_MODEL_PATH || '/models/threat_clustering.tf',
      num_clusters: parseInt(process.env.NUM_CLUSTERS || '10'),
    },
    prediction: {
      enabled: process.env.PREDICTION_ENABLED !== 'false',
      model_path:
        process.env.PREDICTION_MODEL_PATH || '/models/threat_prediction.tf',
      prediction_window: parseInt(process.env.PREDICTION_WINDOW || '24'), // hours
    },
  },
  detection_thresholds: {
    low: parseFloat(process.env.DETECTION_THRESHOLD_LOW || '0.3'),
    medium: parseFloat(process.env.DETECTION_THRESHOLD_MEDIUM || '0.6'),
    high: parseFloat(process.env.DETECTION_THRESHOLD_HIGH || '0.8'),
    critical: parseFloat(process.env.DETECTION_THRESHOLD_CRITICAL || '0.9'),
  },
  performance: {
    max_processing_time_ms: parseInt(process.env.MAX_PROCESSING_TIME || '1000'),
    cache_ttl_ms: parseInt(process.env.CACHE_TTL || '300000'), // 5 minutes
    batch_size: parseInt(process.env.EDGE_BATCH_SIZE || '100'),
  },
}

export const threatCorrelationConfig: ThreatCorrelationEngineConfig = {
  ...baseConfig,
  correlation_algorithms: {
    temporal: {
      enabled: process.env.TEMPORAL_CORRELATION_ENABLED !== 'false',
      time_window_hours: parseInt(process.env.TEMPORAL_WINDOW || '24'),
      similarity_threshold: parseFloat(
        process.env.TEMPORAL_SIMILARITY || '0.7',
      ),
    },
    spatial: {
      enabled: process.env.SPATIAL_CORRELATION_ENABLED !== 'false',
      distance_threshold_km: parseInt(process.env.SPATIAL_DISTANCE || '100'),
      region_weight: parseFloat(process.env.SPATIAL_REGION_WEIGHT || '0.5'),
    },
    behavioral: {
      enabled: process.env.BEHAVIORAL_CORRELATION_ENABLED !== 'false',
      pattern_similarity_threshold: parseFloat(
        process.env.BEHAVIORAL_SIMILARITY || '0.8',
      ),
      learning_rate: parseFloat(process.env.BEHAVIORAL_LEARNING_RATE || '0.01'),
    },
    attribution: {
      enabled: process.env.ATTRIBUTION_CORRELATION_ENABLED !== 'false',
      confidence_threshold: parseFloat(
        process.env.ATTRIBUTION_CONFIDENCE || '0.6',
      ),
      max_attribution_attempts: parseInt(
        process.env.MAX_ATTRIBUTION_ATTEMPTS || '5',
      ),
    },
  },
  ml_models: {
    similarity_detection: {
      enabled: process.env.SIMILARITY_DETECTION_ENABLED !== 'false',
      model_path:
        process.env.SIMILARITY_MODEL_PATH || '/models/similarity_detection.tf',
      threshold: parseFloat(process.env.SIMILARITY_THRESHOLD || '0.75'),
    },
    pattern_recognition: {
      enabled: process.env.PATTERN_RECOGNITION_ENABLED !== 'false',
      model_path:
        process.env.PATTERN_MODEL_PATH || '/models/pattern_recognition.tf',
      min_pattern_length: parseInt(process.env.MIN_PATTERN_LENGTH || '3'),
    },
    statistical_analysis: {
      enabled: process.env.STATISTICAL_ANALYSIS_ENABLED !== 'false',
      significance_level: parseFloat(process.env.SIGNIFICANCE_LEVEL || '0.05'),
      correlation_methods: (
        process.env.CORRELATION_METHODS || 'pearson,spearman,kendall'
      ).split(','),
    },
  },
  correlation_thresholds: {
    weak: parseFloat(process.env.CORRELATION_WEAK || '0.3'),
    moderate: parseFloat(process.env.CORRELATION_MODERATE || '0.6'),
    strong: parseFloat(process.env.CORRELATION_STRONG || '0.8'),
  },
  output: {
    max_correlations: parseInt(process.env.MAX_CORRELATIONS || '100'),
    min_confidence: parseFloat(process.env.MIN_CORRELATION_CONFIDENCE || '0.5'),
    format: process.env.CORRELATION_OUTPUT_FORMAT || 'json',
  },
}

export const threatResponseConfig: AutomatedThreatResponseOrchestratorConfig = {
  ...baseConfig,
  response_strategies: {
    automatic: {
      enabled: process.env.AUTOMATIC_RESPONSE_ENABLED !== 'false',
      confidence_threshold: parseFloat(
        process.env.AUTO_RESPONSE_CONFIDENCE || '0.9',
      ),
      severity_levels: (
        process.env.AUTO_RESPONSE_SEVERITIES || 'critical,high'
      ).split(','),
      max_response_time_ms: parseInt(process.env.MAX_RESPONSE_TIME || '30000'), // 30 seconds
    },
    semi_automatic: {
      enabled: process.env.SEMI_AUTO_RESPONSE_ENABLED !== 'false',
      confidence_threshold: parseFloat(
        process.env.SEMI_AUTO_CONFIDENCE || '0.7',
      ),
      approval_required: process.env.SEMI_AUTO_APPROVAL_REQUIRED === 'true',
      timeout_ms: parseInt(process.env.SEMI_AUTO_TIMEOUT || '300000'), // 5 minutes
    },
    manual: {
      enabled: process.env.MANUAL_RESPONSE_ENABLED !== 'false',
      escalation_threshold: parseFloat(
        process.env.MANUAL_ESCALATION_THRESHOLD || '0.5',
      ),
      notification_channels: (
        process.env.MANUAL_NOTIFICATION_CHANNELS || 'email,slack'
      ).split(','),
    },
  },
  integration_apis: {
    firewall_api: process.env.FIREWALL_API || 'https://firewall.internal/api',
    siem_api: process.env.SIEM_API || 'https://siem.internal/api',
    edr_api: process.env.EDR_API || 'https://edr.internal/api',
    ticketing_api: process.env.TICKETING_API || 'https://tickets.internal/api',
    notification_api:
      process.env.NOTIFICATION_API || 'https://notify.internal/api',
  },
  response_actions: {
    block_ip: {
      enabled: process.env.BLOCK_IP_ENABLED !== 'false',
      timeout_minutes: parseInt(process.env.BLOCK_IP_TIMEOUT || '60'),
    },
    quarantine_file: {
      enabled: process.env.QUARANTINE_FILE_ENABLED !== 'false',
      scan_before_release: process.env.SCAN_BEFORE_RELEASE === 'true',
    },
    disable_user: {
      enabled: process.env.DISABLE_USER_ENABLED !== 'false',
      require_approval: process.env.DISABLE_USER_APPROVAL === 'true',
    },
    isolate_system: {
      enabled: process.env.ISOLATE_SYSTEM_ENABLED !== 'false',
      duration_minutes: parseInt(process.env.ISOLATION_DURATION || '120'),
    },
    notify_stakeholders: {
      enabled: process.env.NOTIFY_STAKEHOLDERS_ENABLED !== 'false',
      urgency_levels: (
        process.env.NOTIFICATION_URGENCY || 'critical,high'
      ).split(','),
    },
  },
  rollback: {
    enabled: process.env.ROLLBACK_ENABLED !== 'false',
    max_attempts: parseInt(process.env.ROLLBACK_MAX_ATTEMPTS || '3'),
    timeout_ms: parseInt(process.env.ROLLBACK_TIMEOUT || '60000'), // 1 minute
    backup_before_action: process.env.BACKUP_BEFORE_ACTION === 'true',
  },
}

export const threatHuntingConfig: ThreatHuntingSystemConfig = {
  ...baseConfig,
  hunt_templates: [
    {
      id: 'network_anomalies',
      name: 'Network Anomaly Detection',
      description: 'Detect unusual network patterns and connections',
      category: 'network',
      query: {
        type: 'kql',
        query:
          'network_connections | where bytes_sent > 1000000 or bytes_received > 1000000',
      },
      scope: {
        regions: ['global'],
        systems: ['all'],
        time_range: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000),
          end: new Date(),
        },
        data_sources: ['network_logs', 'firewall_logs'],
      },
      schedule: {
        enabled: true,
        frequency: 'hourly',
        max_concurrent: 5,
        timeout: 300000, // 5 minutes
      },
      enabled: true,
    },
    {
      id: 'malware_indicators',
      name: 'Malware Indicator Hunt',
      description: 'Search for known malware indicators',
      category: 'malware',
      query: {
        type: 'yara',
        query:
          'rule malware_detection { strings: $a = "malware" condition: $a }',
      },
      scope: {
        regions: ['global'],
        systems: ['endpoints'],
        time_range: {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          end: new Date(),
        },
        data_sources: ['file_system', 'process_logs'],
      },
      schedule: {
        enabled: true,
        frequency: 'daily',
        max_concurrent: 3,
        timeout: 600000, // 10 minutes
      },
      enabled: true,
    },
  ],
  ai_assistance: {
    enabled: process.env.HUNTING_AI_ENABLED !== 'false',
    model: process.env.HUNTING_AI_MODEL || 'gpt-4',
    confidence_threshold: parseFloat(
      process.env.HUNTING_AI_CONFIDENCE || '0.7',
    ),
  },
  execution_limits: {
    max_concurrent_hunts: parseInt(process.env.MAX_CONCURRENT_HUNTS || '10'),
    max_findings_per_hunt: parseInt(
      process.env.MAX_FINDINGS_PER_HUNT || '1000',
    ),
    default_timeout: parseInt(process.env.HUNT_DEFAULT_TIMEOUT || '300000'), // 5 minutes
  },
  integration_apis: {
    siem_api: process.env.HUNTING_SIEM_API || 'https://siem.internal/api',
    edr_api: process.env.HUNTING_EDR_API || 'https://edr.internal/api',
    network_monitoring_api:
      process.env.HUNTING_NETWORK_API || 'https://network-monitor.internal/api',
    log_aggregation_api:
      process.env.HUNTING_LOG_API || 'https://logs.internal/api',
  },
}

export const externalFeedConfig: ExternalThreatFeedIntegrationConfig = {
  ...baseConfig,
  feeds: [
    {
      id: 'misp_community',
      name: 'MISP Community Feed',
      description: 'Open source threat intelligence from MISP community',
      type: 'misp',
      provider: 'MISP Project',
      endpoint:
        process.env.MISP_ENDPOINT || 'https://www.circl.lu/doc/misp/feed-osint',
      authentication: {
        type: 'none',
        credentials: {},
      },
      configuration: {
        format: 'misp',
        filters: {
          confidence_threshold: 0.5,
          published: true,
          to_ids: true,
        },
      },
      status: 'active',
      sync_frequency: 'daily',
      rate_limiting: {
        requests_per_hour: 100,
        requests_per_day: 1000,
      },
      data_quality: {
        completeness: 0.8,
        accuracy: 0.7,
        timeliness: 0.6,
        uniqueness: 0.9,
        validity: 0.8,
      },
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 'alienvault_otx',
      name: 'AlienVault OTX',
      description: 'Open Threat Exchange platform',
      type: 'open_source',
      provider: 'AlienVault',
      endpoint: process.env.OTX_ENDPOINT || 'https://otx.alienvault.com/api/v1',
      authentication: {
        type: 'api_key',
        credentials: {
          api_key: process.env.OTX_API_KEY,
        },
      },
      configuration: {
        format: 'json',
        filters: {
          limit: 1000,
          modified_since: '24h',
        },
      },
      status: 'active',
      sync_frequency: 'hourly',
      rate_limiting: {
        requests_per_hour: 200,
        requests_per_day: 5000,
      },
      data_quality: {
        completeness: 0.9,
        accuracy: 0.8,
        timeliness: 0.8,
        uniqueness: 0.7,
        validity: 0.9,
      },
      created_at: new Date(),
      updated_at: new Date(),
    },
  ],
  sync_settings: {
    max_concurrent_syncs: parseInt(process.env.MAX_CONCURRENT_SYNCS || '5'),
    retry_attempts: parseInt(process.env.SYNC_RETRY_ATTEMPTS || '3'),
    retry_delay: parseInt(process.env.SYNC_RETRY_DELAY || '5000'), // 5 seconds
    timeout: parseInt(process.env.SYNC_TIMEOUT || '30000'), // 30 seconds
    batch_size: parseInt(process.env.SYNC_BATCH_SIZE || '1000'),
  },
  quality_thresholds: {
    min_completeness: parseFloat(process.env.MIN_COMPLETENESS || '0.6'),
    min_accuracy: parseFloat(process.env.MIN_ACCURACY || '0.7'),
    min_timeliness: parseFloat(process.env.MIN_TIMELINESS || '0.5'),
    min_uniqueness: parseFloat(process.env.MIN_UNIQUENESS || '0.8'),
    min_validity: parseFloat(process.env.MIN_VALIDITY || '0.8'),
  },
  integration_apis: {
    stix_taxii_client:
      process.env.STIX_TAXII_CLIENT_API || 'https://taxii.example.com/api',
    misp_client: process.env.MISP_CLIENT_API || 'https://misp.example.com/api',
    threat_intel_platform:
      process.env.THREAT_INTEL_PLATFORM_API ||
      'https://platform.example.com/api',
  },
}

export const threatValidationConfig: ThreatValidationSystemConfig = {
  ...baseConfig,
  validation_settings: {
    max_concurrent_validations: parseInt(
      process.env.MAX_CONCURRENT_VALIDATIONS || '10',
    ),
    validation_timeout: parseInt(process.env.VALIDATION_TIMEOUT || '300000'), // 5 minutes
    auto_validation_threshold: parseFloat(
      process.env.AUTO_VALIDATION_THRESHOLD || '0.8',
    ),
    human_review_threshold: parseFloat(
      process.env.HUMAN_REVIEW_THRESHOLD || '0.6',
    ),
    quality_gates: [
      {
        name: 'high_accuracy',
        description: 'Automatically approve high-accuracy threats',
        criteria: {
          accuracy_threshold: 0.9,
          completeness_requirements: ['value', 'type', 'source'],
          timeliness_window: 24,
          reliability_sources: ['trusted_feeds'],
          compliance_standards: ['STIX', 'TAXII'],
          custom_rules: [],
        },
        action: 'approve',
        notification_config: {
          enabled: true,
          channels: ['email'],
          recipients: (
            process.env.QUALITY_GATE_RECIPIENTS || 'security@pixelated.com'
          ).split(','),
          templates: {
            approval:
              'Threat {threat_id} automatically approved with score {score}',
          },
        },
      },
      {
        name: 'low_confidence',
        description: 'Flag low-confidence threats for review',
        criteria: {
          accuracy_threshold: 0.5,
          completeness_requirements: [],
          timeliness_window: 72,
          reliability_sources: [],
          compliance_standards: [],
          custom_rules: [],
        },
        action: 'review',
        notification_config: {
          enabled: true,
          channels: ['email', 'slack'],
          recipients: (
            process.env.LOW_CONFIDENCE_RECIPIENTS || 'analysts@pixelated.com'
          ).split(','),
          templates: {
            review:
              'Threat {threat_id} requires manual review - confidence: {score}',
          },
        },
      },
    ],
  },
  ai_assistance: {
    enabled: process.env.VALIDATION_AI_ENABLED !== 'false',
    model: process.env.VALIDATION_AI_MODEL || 'gpt-4',
    confidence_threshold: parseFloat(
      process.env.VALIDATION_AI_CONFIDENCE || '0.7',
    ),
  },
  compliance: {
    enabled_standards: (
      process.env.ENABLED_COMPLIANCE_STANDARDS || 'STIX,TAXII,MISP,HIPAA'
    ).split(','),
    audit_logging: process.env.COMPLIANCE_AUDIT_LOGGING !== 'false',
    data_retention_days: parseInt(
      process.env.COMPLIANCE_RETENTION_DAYS || '2555',
    ), // 7 years
  },
}

export const threatIntelligenceConfig = {
  database: threatIntelDatabaseConfig,
  global: globalThreatIntelConfig,
  edge: edgeThreatDetectionConfig,
  correlation: threatCorrelationConfig,
  response: threatResponseConfig,
  hunting: threatHuntingConfig,
  feeds: externalFeedConfig,
  validation: threatValidationConfig,
}

export function getThreatIntelConfig(component: string): unknown {
  const configMap: Record<string, unknown> = {
    database: threatIntelDatabaseConfig,
    global: globalThreatIntelConfig,
    edge: edgeThreatDetectionConfig,
    correlation: threatCorrelationConfig,
    response: threatResponseConfig,
    hunting: threatHuntingConfig,
    feeds: externalFeedConfig,
    validation: threatValidationConfig,
  }

  return (
    (configMap as Record<string, unknown>)[component] ||
    threatIntelligenceConfig
  )
}

// Environment validation
export function validateThreatIntelConfig(): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Check required environment variables
  const requiredVars = [
    'MONGODB_URI',
    'REDIS_URL',
    'JWT_SECRET',
    'ENCRYPTION_KEY',
  ]

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      errors.push(`Missing required environment variable: ${varName}`)
    }
  }

  if (
    threatIntelDatabaseConfig.stix_taxii.enabled &&
    !threatIntelDatabaseConfig.stix_taxii.taxii_username
  ) {
    errors.push('STIX/TAXII enabled but missing credentials')
  }

  if (externalFeedConfig.feeds.length === 0) {
    errors.push('No threat feeds configured')
  }

  if (threatValidationConfig.validation_settings.quality_gates.length === 0) {
    errors.push('No quality gates configured for validation')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export const config = {
  development: {
    ...threatIntelligenceConfig,
    logging: {
      level: 'debug',
      enabled: true,
    },
    debugging: {
      enabled: true,
      detailed_errors: true,
    },
  },
  production: {
    ...threatIntelligenceConfig,
    logging: {
      level: 'warn',
      enabled: true,
    },
    debugging: {
      enabled: false,
      detailed_errors: false,
    },
  },
  test: {
    ...threatIntelligenceConfig,
    logging: {
      level: 'error',
      enabled: false,
    },
    debugging: {
      enabled: true,
      detailed_errors: true,
    },
  },
}

export function getCurrentConfig() {
  const env = process.env.NODE_ENV || 'development'
  return config[env as keyof typeof config] || config.development
}

export default threatIntelligenceConfig
