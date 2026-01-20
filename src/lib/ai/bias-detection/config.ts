/**
 * Bias Detection Engine Configuration
 *
 * Provides default configuration and validation for the bias detection system
 */

import type { BiasDetectionConfig } from './types'

/**
 * Default configuration for the bias detection engine
 */
export const DEFAULT_CONFIG: BiasDetectionConfig = {
  // Environment
  environment: 'development',
  // Python service configuration
  pythonServiceUrl:
    process.env.BIAS_DETECTION_SERVICE_URL || 'http://localhost:5000',
  pythonServiceTimeout: 30000, // 30 seconds
  pythonServicePort: 5000, // Default port

  // Bias score thresholds (0.0 - 1.0 scale)
  thresholds: {
    warning: 0.3,
    high: 0.6,
    critical: 0.8,
  },

  // Layer weight configuration for aggregated bias scoring
  layerWeights: {
    preprocessing: 0.25,
    modelLevel: 0.3,
    interactive: 0.2,
    evaluation: 0.25,
  },

  // Evaluation metrics to compute
  evaluationMetrics: [
    'demographic_parity',
    'equalized_odds',
    'calibration',
    'individual_fairness',
  ],

  // Metrics collection configuration
  metricsConfig: {
    enableRealTimeMonitoring: true,
    metricsRetentionDays: 30,
    aggregationIntervals: ['1h', '1d', '1w', '1m'],
    dashboardRefreshRate: 60, // seconds
    exportFormats: ['json', 'csv', 'pdf'],
  },

  // Alert system configuration
  alertConfig: {
    enableSlackNotifications: false,
    enableEmailNotifications: false,
    slackWebhookUrl: process.env.BIAS_ALERT_SLACK_WEBHOOK,
    emailRecipients: [],
    alertCooldownMinutes: 1,
    escalationThresholds: {
      criticalResponseTimeMinutes: 15,
      highResponseTimeMinutes: 60,
    },
  },

  // Report configuration
  reportConfig: {
    includeConfidentialityAnalysis: true,
    includeDemographicBreakdown: true,
    includeTemporalTrends: true,
    includeRecommendations: true,
    reportTemplate: 'standard',
    exportFormats: ['json', 'pdf'],
  },

  // Explanation configuration
  explanationConfig: {
    explanationMethod: 'shap',
    maxFeatures: 10,
    includeCounterfactuals: true,
    generateVisualization: true,
  },

  // Python service configuration
  pythonServiceConfig: {
    retries: 3,
    healthCheckInterval: 60000,
  },

  // Logging configuration
  loggingConfig: {
    level: 'info',
    enableConsole: true,
    enableFile: true,
    enableDebug: false,
    filePath: './logs/bias-detection.log',
    maxFileSize: '10MB',
    maxFiles: 5,
    enableStructured: true,
  },

  // Cache configuration
  cacheConfig: {
    enabled: true,
    ttl: 300000, // 5 minutes
    maxSize: 1000,
    compressionEnabled: true,
  },

  // Security configuration
  securityConfig: {
    sessionTimeoutMs: 3600000, // 1 hour
    maxSessionSizeMB: 50,
    rateLimitPerMinute: 60,
  },

  // Performance configuration
  performanceConfig: {
    maxConcurrentAnalyses: 10,
    analysisTimeoutMs: 120000, // 2 minutes
    batchSize: 100,
  },

  // HIPAA compliance settings
  hipaaCompliant: true,
  dataMaskingEnabled: true,
  auditLogging: true,
}

/**
 * Validates bias detection configuration
 */
export function validateConfig(
  config?: Partial<BiasDetectionConfig>,
): string[] {
  const configToValidate =
    config || BiasDetectionConfigManager.getInstance().getConfig()
  const errors: string[] = []

  // Validate threshold values
  if (configToValidate.thresholds) {
    const { thresholds } = configToValidate

    if (
      thresholds.warning !== undefined &&
      (thresholds.warning < 0 || thresholds.warning > 1)
    ) {
      errors.push('thresholds.warning must be between 0.0 and 1.0')
    }

    if (
      thresholds.high !== undefined &&
      (thresholds.high < 0 || thresholds.high > 1)
    ) {
      errors.push('thresholds.high must be between 0.0 and 1.0')
    }

    if (
      thresholds.critical !== undefined &&
      (thresholds.critical < 0 || thresholds.critical > 1)
    ) {
      errors.push('thresholds.critical must be between 0.0 and 1.0')
    }

    // Validate threshold ordering
    const warning =
      thresholds.warning ??
      (DEFAULT_CONFIG.thresholds ? DEFAULT_CONFIG.thresholds.warning : 0.3)
    const high =
      thresholds.high ??
      (DEFAULT_CONFIG.thresholds ? DEFAULT_CONFIG.thresholds.high : 0.6)
    const critical =
      thresholds.critical ??
      (DEFAULT_CONFIG.thresholds ? DEFAULT_CONFIG.thresholds.critical : 0.8)

    if (warning >= high || high >= critical) {
      errors.push(
        'Thresholds must be in ascending order: warning < high < critical',
      )
    }
  }

  // Validate layer weights
  if (configToValidate.layerWeights) {
    const weights = configToValidate.layerWeights

    // Check individual weight values
    Object.entries(weights).forEach(([layer, weight]) => {
      if (weight !== undefined && (weight < 0 || weight > 1)) {
        errors.push(
          `layerWeights.${layer} must be between 0.0 and 1.0, got ${weight}`,
        )
      }
    })

    // Check weights are non-negative (sum validation removed as normalization can be done elsewhere)
    // No additional validation needed as individual weight validation is done above
  }

  // Validate Python service configuration
  if (configToValidate.pythonServiceUrl) {
    try {
      const url = new URL(configToValidate.pythonServiceUrl)
      if (!['http:', 'https:'].includes(url.protocol)) {
        errors.push('pythonServiceUrl must use http:// or https:// protocol')
      }
    } catch {
      errors.push(
        `pythonServiceUrl must be a valid URL, got: ${configToValidate.pythonServiceUrl}`,
      )
    }
  }

  if (
    configToValidate.pythonServiceTimeout !== undefined &&
    (configToValidate.pythonServiceTimeout < 1000 ||
      configToValidate.pythonServiceTimeout > 300000)
  ) {
    errors.push(
      `pythonServiceTimeout must be between 1000ms and 300000ms, got ${configToValidate.pythonServiceTimeout}ms`,
    )
  }

  // Validate evaluation metrics
  if (configToValidate.evaluationMetrics) {
    const validMetrics = [
      'demographic_parity',
      'equalized_odds',
      'calibration',
      'individual_fairness',
    ]
    const invalidMetrics = configToValidate.evaluationMetrics.filter(
      (metric) => !validMetrics.includes(metric),
    )
    if (invalidMetrics.length > 0) {
      errors.push(
        `Invalid evaluation metrics: ${invalidMetrics.join(', ')}. Valid options: ${validMetrics.join(', ')}`,
      )
    }
  }

  // Validate HIPAA compliance settings
  if (
    configToValidate.hipaaCompliant !== undefined &&
    typeof configToValidate.hipaaCompliant !== 'boolean'
  ) {
    errors.push('hipaaCompliant must be a boolean value')
  }

  if (
    configToValidate.auditLogging !== undefined &&
    typeof configToValidate.auditLogging !== 'boolean'
  ) {
    errors.push('auditLogging must be a boolean value')
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed: ${errors.join('; ')}`)
  }

  return errors
}

/**
 * Merges user configuration with defaults
 */
export function mergeWithDefaults(
  userConfig?: Partial<BiasDetectionConfig>,
): BiasDetectionConfig {
  if (!userConfig) {
    return { ...DEFAULT_CONFIG }
  }
  validateConfig(userConfig)
  const mergedConfig: BiasDetectionConfig = deepMergeConfigs(
    DEFAULT_CONFIG,
    userConfig,
  ) as BiasDetectionConfig
  return mergedConfig
}

/**
 * Loads configuration from environment variables with comprehensive support
 */
export function loadConfigFromEnv(): Partial<BiasDetectionConfig> {
  const envConfig: Partial<BiasDetectionConfig> = {}

  // Load threshold values from environment
  const thresholds: Partial<BiasDetectionConfig['thresholds']> = {}
  if (process.env.BIAS_WARNING_THRESHOLD) {
    const parsed = parseFloat(process.env.BIAS_WARNING_THRESHOLD)
    if (!isNaN(parsed)) thresholds.warning = parsed
  }
  if (process.env.BIAS_HIGH_THRESHOLD) {
    const parsed = parseFloat(process.env.BIAS_HIGH_THRESHOLD)
    if (!isNaN(parsed)) thresholds.high = parsed
  }
  if (process.env.BIAS_CRITICAL_THRESHOLD) {
    const parsed = parseFloat(process.env.BIAS_CRITICAL_THRESHOLD)
    if (!isNaN(parsed)) thresholds.critical = parsed
  }
  if (Object.keys(thresholds).length > 0) {
    envConfig.thresholds = thresholds as BiasDetectionConfig['thresholds']
  }

  // Load service configuration
  if (process.env.BIAS_DETECTION_SERVICE_URL) {
    envConfig.pythonServiceUrl = process.env.BIAS_DETECTION_SERVICE_URL
  }
  if (process.env.BIAS_SERVICE_TIMEOUT) {
    const parsed = parseInt(process.env.BIAS_SERVICE_TIMEOUT)
    if (!isNaN(parsed)) envConfig.pythonServiceTimeout = parsed
  }
  if (process.env.PYTHON_SERVICE_PORT) {
    const parsed = parseInt(process.env.PYTHON_SERVICE_PORT)
    if (!isNaN(parsed)) envConfig.pythonServicePort = parsed
  }

  // Load layer weights
  const layerWeights: Partial<BiasDetectionConfig['layerWeights']> = {}
  if (process.env.BIAS_WEIGHT_PREPROCESSING) {
    const parsed = parseFloat(process.env.BIAS_WEIGHT_PREPROCESSING)
    if (!isNaN(parsed)) layerWeights.preprocessing = parsed
  }
  if (process.env.BIAS_WEIGHT_MODEL_LEVEL) {
    const parsed = parseFloat(process.env.BIAS_WEIGHT_MODEL_LEVEL)
    if (!isNaN(parsed)) layerWeights.modelLevel = parsed
  }
  if (process.env.BIAS_WEIGHT_INTERACTIVE) {
    const parsed = parseFloat(process.env.BIAS_WEIGHT_INTERACTIVE)
    if (!isNaN(parsed)) layerWeights.interactive = parsed
  }
  if (process.env.BIAS_WEIGHT_EVALUATION) {
    const parsed = parseFloat(process.env.BIAS_WEIGHT_EVALUATION)
    if (!isNaN(parsed)) layerWeights.evaluation = parsed
  }
  if (Object.keys(layerWeights).length > 0) {
    envConfig.layerWeights = layerWeights as BiasDetectionConfig['layerWeights']
  }

  // Load logging configuration
  const loggingConfig: Partial<BiasDetectionConfig['loggingConfig']> = {}
  if (process.env.LOG_LEVEL === 'debug') {
    loggingConfig.enableDebug = true
  }
  if (Object.keys(loggingConfig).length > 0) {
    envConfig.loggingConfig = {
      ...DEFAULT_CONFIG.loggingConfig,
      ...loggingConfig,
    }
  }
  if (process.env.BIAS_EVALUATION_METRICS) {
    envConfig.evaluationMetrics = process.env.BIAS_EVALUATION_METRICS.split(
      ',',
    ).map((m: string) => m.trim())
  }

  // Load cache configuration
  const cacheConfig: Partial<BiasDetectionConfig['cacheConfig']> = {}
  if (process.env.CACHE_TTL) {
    const parsed = parseInt(process.env.CACHE_TTL)
    if (!isNaN(parsed)) cacheConfig.ttl = parsed
  }
  if (Object.keys(cacheConfig).length > 0) {
    envConfig.cacheConfig = { ...DEFAULT_CONFIG.cacheConfig, ...cacheConfig }
  }
  if (process.env.ENABLE_HIPAA_COMPLIANCE) {
    envConfig.hipaaCompliant = process.env.ENABLE_HIPAA_COMPLIANCE === 'true'
  }
  if (process.env.ENABLE_AUDIT_LOGGING) {
    envConfig.auditLogging = process.env.ENABLE_AUDIT_LOGGING === 'true'
  }
  if (process.env.ENABLE_DATA_MASKING) {
    envConfig.dataMaskingEnabled = process.env.ENABLE_DATA_MASKING === 'true'
  }

  // Load performance configuration
  const performanceConfig: Partial<BiasDetectionConfig['performanceConfig']> =
    {}
  if (process.env.MAX_CONCURRENT_ANALYSES) {
    const parsed = parseInt(process.env.MAX_CONCURRENT_ANALYSES)
    if (!isNaN(parsed)) performanceConfig.maxConcurrentAnalyses = parsed
  }
  if (Object.keys(performanceConfig).length > 0) {
    envConfig.performanceConfig = {
      ...DEFAULT_CONFIG.performanceConfig,
      ...performanceConfig,
    }
  }
  const alertConfig: Partial<BiasDetectionConfig['alertConfig']> = {}
  if (process.env.BIAS_ALERT_SLACK_WEBHOOK) {
    alertConfig.slackWebhookUrl = process.env.BIAS_ALERT_SLACK_WEBHOOK
    alertConfig.enableSlackNotifications = true
  }
  if (process.env.BIAS_ALERT_EMAIL_RECIPIENTS) {
    alertConfig.emailRecipients = process.env.BIAS_ALERT_EMAIL_RECIPIENTS.split(
      ',',
    ).map((e: string) => e.trim())
    alertConfig.enableEmailNotifications = true
  }
  if (process.env.BIAS_ALERT_COOLDOWN_MINUTES) {
    alertConfig.alertCooldownMinutes = parseInt(
      process.env.BIAS_ALERT_COOLDOWN_MINUTES,
    )
  }
  if (Object.keys(alertConfig).length > 0) {
    envConfig.alertConfig = alertConfig as BiasDetectionConfig['alertConfig']
  }

  // Load metrics configuration
  const metricsConfig: Partial<BiasDetectionConfig['metricsConfig']> = {}
  if (process.env.BIAS_METRICS_RETENTION_DAYS) {
    metricsConfig.metricsRetentionDays = parseInt(
      process.env.BIAS_METRICS_RETENTION_DAYS,
    )
  }
  if (process.env.BIAS_DASHBOARD_REFRESH_RATE) {
    metricsConfig.dashboardRefreshRate = parseInt(
      process.env.BIAS_DASHBOARD_REFRESH_RATE,
    )
  }
  if (process.env.BIAS_ENABLE_REAL_TIME_MONITORING) {
    metricsConfig.enableRealTimeMonitoring =
      process.env.BIAS_ENABLE_REAL_TIME_MONITORING === 'true'
  }
  if (Object.keys(metricsConfig).length > 0) {
    envConfig.metricsConfig =
      metricsConfig as BiasDetectionConfig['metricsConfig']
  }

  return envConfig
}

/**
 * Gets a summary of which configuration values came from environment variables
 */
export function getEnvironmentConfigSummary(): {
  loaded: string[]
  available: string[]
} {
  const availableEnvVars = [
    'BIAS_DETECTION_SERVICE_URL',
    'BIAS_SERVICE_TIMEOUT',
    'BIAS_WARNING_THRESHOLD',
    'BIAS_HIGH_THRESHOLD',
    'BIAS_CRITICAL_THRESHOLD',
    'BIAS_WEIGHT_PREPROCESSING',
    'BIAS_WEIGHT_MODEL_LEVEL',
    'BIAS_WEIGHT_INTERACTIVE',
    'BIAS_WEIGHT_EVALUATION',
    'BIAS_EVALUATION_METRICS',
    'ENABLE_HIPAA_COMPLIANCE',
    'ENABLE_AUDIT_LOGGING',
    'ENABLE_DATA_MASKING',
    'BIAS_ALERT_SLACK_WEBHOOK',
    'BIAS_ALERT_EMAIL_RECIPIENTS',
    'BIAS_ALERT_COOLDOWN_MINUTES',
    'BIAS_METRICS_RETENTION_DAYS',
    'BIAS_DASHBOARD_REFRESH_RATE',
    'BIAS_ENABLE_REAL_TIME_MONITORING',
  ]

  const loaded = availableEnvVars.filter(
    (varName) =>
      (process.env as Record<string, string | undefined>)[varName] !==
      undefined,
  )

  return { loaded, available: availableEnvVars }
}

/**
 * Deep merges configuration objects with precedence handling
 */
export function deepMergeConfigs(
  baseConfig: Partial<BiasDetectionConfig>,
  ...overrideConfigs: Partial<BiasDetectionConfig>[]
): Partial<BiasDetectionConfig> {
  const merged = { ...baseConfig }

  for (const override of overrideConfigs) {
    Object.assign(merged, override)

    if (override.thresholds) {
      merged.thresholds = {
        ...merged.thresholds,
        ...override.thresholds,
      }
    }

    if (override.layerWeights) {
      merged.layerWeights = {
        ...merged.layerWeights,
        ...override.layerWeights,
      }
    }

    if (override.metricsConfig) {
      merged.metricsConfig = {
        ...merged.metricsConfig,
        ...override.metricsConfig,
      }
    }

    if (override.alertConfig) {
      merged.alertConfig = {
        ...merged.alertConfig,
        ...override.alertConfig,
      }

      if (override.alertConfig.escalationThresholds) {
        merged.alertConfig.escalationThresholds = {
          ...merged.alertConfig?.escalationThresholds,
          ...override.alertConfig.escalationThresholds,
        }
      }
    }

    if (override.reportConfig) {
      merged.reportConfig = {
        ...merged.reportConfig,
        ...override.reportConfig,
      }
    }

    if (override.explanationConfig) {
      merged.explanationConfig = {
        ...merged.explanationConfig,
        ...override.explanationConfig,
      }
    }
  }

  return merged
}

/**
 * Creates a configuration with environment variable overrides
 * Order of precedence: user config > environment variables > defaults
 */
export function createConfigWithEnvOverrides(
  userConfig?: Partial<BiasDetectionConfig>,
): BiasDetectionConfig {
  const envConfig = loadConfigFromEnv()

  // Merge in order of precedence: defaults < env < user
  const combinedConfig = deepMergeConfigs(
    DEFAULT_CONFIG,
    envConfig,
    userConfig || {},
  )

  return combinedConfig as BiasDetectionConfig
}

/**
 * Updates an existing configuration with new values
 */
export function updateConfiguration(
  currentConfig: BiasDetectionConfig,
  updates: Partial<BiasDetectionConfig>,
): BiasDetectionConfig {
  validateConfig(updates)
  return deepMergeConfigs(currentConfig, updates) as BiasDetectionConfig
}

/**
 * Configuration Manager Class - Singleton pattern for managing bias detection configuration
 */
export class BiasDetectionConfigManager {
  private static instance: BiasDetectionConfigManager | undefined
  private config: BiasDetectionConfig

  private constructor() {
    this.config = createConfigWithEnvOverrides()
  }

  public static getInstance(): BiasDetectionConfigManager {
    if (!BiasDetectionConfigManager.instance) {
      BiasDetectionConfigManager.instance = new BiasDetectionConfigManager()
    }
    return BiasDetectionConfigManager.instance
  }

  public getConfig(): BiasDetectionConfig & {
    cache?: any
    security?: any
    performance?: any
    pythonService?: any
  } {
    // Return config with compatibility properties for tests
    return {
      ...this.config,
      // Add compatibility properties that tests expect
      cache: this.config.cacheConfig,
      security: {
        ...this.config.securityConfig,
        encryptionEnabled:
          this.config.securityConfig?.encryptionEnabled ?? false,
        auditLoggingEnabled: this.config.auditLogging ?? true,
      },
      performance: {
        ...this.config.performanceConfig,
        enableMetrics: this.config.performanceConfig?.enableMetrics ?? false,
        maxConcurrentAnalyses:
          this.config.performanceConfig?.maxConcurrentAnalyses ?? 10,
      },
      pythonService: {
        url: this.config.pythonServiceUrl,
        port: this.config.pythonServicePort || 5000,
        timeout: this.config.pythonServiceTimeout,
      },
    }
  }

  public getThresholds() {
    return this.config.thresholds
  }

  public getLayerWeights() {
    return this.config.layerWeights
  }

  public getPythonServiceConfig() {
    const urlStr = this.config.pythonServiceUrl ?? 'http://localhost:5000'
    const url = new URL(urlStr)
    return {
      host: url.hostname,
      port: parseInt(url.port) || 5000,
      timeout: this.config.pythonServiceTimeout,
      retries: this.config.pythonServiceConfig?.retries ?? 3,
      healthCheckInterval:
        this.config.pythonServiceConfig?.healthCheckInterval ?? 60000,
    }
  }

  public getCacheConfig() {
    return {
      enabled: this.config.cacheConfig?.enabled ?? true,
      ttl: this.config.cacheConfig?.ttl ?? 300000,
      maxSize: this.config.cacheConfig?.maxSize ?? 1000,
      compressionEnabled: this.config.cacheConfig?.compressionEnabled ?? true,
    }
  }

  public getSecurityConfig() {
    return {
      encryptionEnabled: this.config.dataMaskingEnabled,
      auditLoggingEnabled: this.config.auditLogging,
      sessionTimeoutMs: this.config.securityConfig?.sessionTimeoutMs ?? 3600000,
      maxSessionSizeMB: this.config.securityConfig?.maxSessionSizeMB ?? 50,
      rateLimitPerMinute: this.config.securityConfig?.rateLimitPerMinute ?? 60,
      // Note: Secrets are handled separately via secure environment variables
      // These should never be exposed to client-side code or logs
    }
  }

  public getPerformanceConfig() {
    return {
      maxConcurrentAnalyses:
        this.config.performanceConfig?.maxConcurrentAnalyses ?? 10,
      analysisTimeoutMs:
        this.config.performanceConfig?.analysisTimeoutMs ?? 120000,
      batchSize: this.config.performanceConfig?.batchSize ?? 100,
      enableMetrics:
        this.config.performanceConfig?.enableMetrics ??
        (this.config.metricsConfig
          ? this.config.metricsConfig.enableRealTimeMonitoring
          : true),
      metricsInterval: 60000,
    }
  }

  public getMLToolkitConfig() {
    return {
      aif360: {
        enabled: this.config.mlToolkitConfig?.aif360?.enabled ?? true,
        fallbackOnError:
          this.config.mlToolkitConfig?.aif360?.fallbackOnError ?? true,
      },
      fairlearn: {
        enabled: this.config.mlToolkitConfig?.fairlearn?.enabled ?? true,
        fallbackOnError:
          this.config.mlToolkitConfig?.fairlearn?.fallbackOnError ?? true,
      },
      tensorflow: {
        enabled: this.config.mlToolkitConfig?.tensorflow?.enabled ?? true,
        fallbackOnError:
          this.config.mlToolkitConfig?.tensorflow?.fallbackOnError ?? true,
      },
      huggingFace: {
        enabled: this.config.mlToolkitConfig?.huggingFace?.enabled ?? true,
        fallbackOnError:
          this.config.mlToolkitConfig?.huggingFace?.fallbackOnError ?? true,
        apiKey: this.config.mlToolkitConfig?.huggingFace?.apiKey,
        model:
          this.config.mlToolkitConfig?.huggingFace?.model ??
          'unitary/toxic-bert',
      },
      interpretability: {
        enabled: this.config.mlToolkitConfig?.interpretability?.enabled ?? true,
        fallbackOnError:
          this.config.mlToolkitConfig?.interpretability?.fallbackOnError ??
          true,
        shap: this.config.mlToolkitConfig?.interpretability?.shap ?? {
          enabled: true,
        },
        lime: this.config.mlToolkitConfig?.interpretability?.lime ?? {
          enabled: true,
        },
      },
      spacy: {
        enabled: this.config.mlToolkitConfig?.spacy?.enabled ?? true,
        fallbackOnError:
          this.config.mlToolkitConfig?.spacy?.fallbackOnError ?? true,
        model: this.config.mlToolkitConfig?.spacy?.model ?? 'en_core_web_sm',
      },
    }
  }

  public getLoggingConfig() {
    return {
      level: this.config.loggingConfig?.level ?? 'info',
      enableConsole: this.config.loggingConfig?.enableConsole ?? true,
      enableFile: this.config.loggingConfig?.enableFile ?? true,
      filePath:
        this.config.loggingConfig?.filePath ?? './logs/bias-detection.log',
      maxFileSize: this.config.loggingConfig?.maxFileSize ?? '10MB',
      maxFiles: this.config.loggingConfig?.maxFiles ?? 5,
      enableStructured: this.config.loggingConfig?.enableStructured ?? true,
    }
  }

  public validateConfiguration(): string[] {
    const errors: string[] = []

    try {
      validateConfig(this.config)
    } catch (error: unknown) {
      if (error instanceof Error) {
        errors.push(String(error))
      }
    }

    // Additional validation checks
    const weights = this.config.layerWeights
    if (weights) {
      const sum =
        (weights.preprocessing ?? 0) +
        (weights.modelLevel ?? 0) +
        (weights.interactive ?? 0) +
        (weights.evaluation ?? 0)
      if (Math.abs(sum - 1.0) > 0.001) {
        errors.push('Layer weights must sum to 1.0')
      }
    }
    if (
      this.config.thresholds &&
      this.config.thresholds.warning >= this.config.thresholds.high
    ) {
      errors.push('Warning threshold must be less than high threshold')
    }
    if (
      this.config.thresholds &&
      this.config.thresholds.high >= this.config.thresholds.critical
    ) {
      errors.push('High threshold must be less than critical threshold')
    }

    return errors
  }

  public isProductionReady(): {
    ready: boolean
    warnings: string[]
    errors: string[]
  } {
    const warnings: string[] = []
    const errors: string[] = []

    // Check for JWT secret
    const jwtSecret =
      process.env.JWT_SECRET || this.config.securityConfig?.jwtSecret
    if (!jwtSecret || jwtSecret.length < 32) {
      errors.push('JWT secret is missing or too short (minimum 32 characters)')
    }

    // Check for encryption key
    const encryptionKey =
      process.env.ENCRYPTION_KEY || this.config.securityConfig?.encryptionKey
    if (!encryptionKey || encryptionKey.length < 32) {
      errors.push(
        'Encryption key is missing or too short (minimum 32 characters)',
      )
    }

    // Check for debug logging in production
    if (
      this.config.loggingConfig?.enableDebug ||
      process.env.LOG_LEVEL === 'debug'
    ) {
      warnings.push(
        'Debug logging enabled in production - may expose sensitive data',
      )
    }

    return {
      ready: errors.length === 0 && warnings.length === 0,
      warnings,
      errors,
    }
  }

  public getConfigSummary(): {
    isValid: boolean
    source: string
    loadedEnvVars: string[]
    errors: string[]
    mlToolkits?: {
      aif360: { enabled: boolean }
      fairlearn: { enabled: boolean }
      tensorflow: { enabled: boolean }
    }
  } {
    const errors = this.validateConfiguration()
    const envSummary = getEnvironmentConfigSummary()

    return {
      isValid: errors.length === 0,
      environment: this.config.environment,
      thresholds: this.config.thresholds,
      layerWeights: this.config.layerWeights,
      cache: this.config.cacheConfig,
      security: this.config.securityConfig,
      performance: this.config.performanceConfig,
      features: {
        auditLogging: this.config.auditLogging ?? false,
        dataMasking: this.config.dataMaskingEnabled ?? false,
        caching: this.config.cacheConfig?.enabled ?? true,
      },
      source: 'environment + defaults',
      loadedEnvVars: envSummary.loaded,
      errors,
      mlToolkits: {
        aif360: {
          enabled:
            this.config['mlToolkitConfig']?.['aif360']?.['enabled'] ?? true,
        },
        fairlearn: {
          enabled:
            this.config['mlToolkitConfig']?.['fairlearn']?.['enabled'] ?? true,
        },
        huggingFace: {
          enabled:
            this.config['mlToolkitConfig']?.['huggingFace']?.['enabled'] ??
            true,
        },
        interpretability: {
          enabled:
            this.config['mlToolkitConfig']?.['interpretability']?.['enabled'] ??
            true,
        },
        spacy: {
          enabled:
            this.config['mlToolkitConfig']?.['spacy']?.['enabled'] ?? true,
        },
      },
    }
  }

  public updateConfig(updates: Partial<BiasDetectionConfig>): void {
    this.config = updateConfiguration(this.config, updates)
  }

  public reloadConfiguration(): BiasDetectionConfig {
    this.reloadFromEnvironment()
    return this.config
  }

  public reloadFromEnvironment() {
    this.config = createConfigWithEnvOverrides()
  }
}

/**
 * Global configuration instance
 */
export function getBiasDetectionConfig(): BiasDetectionConfig {
  return BiasDetectionConfigManager.getInstance().getConfig()
}

/**
 * Get configuration summary for debugging
 */
export function getConfigSummary(): {
  isValid: boolean
  source: string
  loadedEnvVars: string[]
  errors: string[]
} {
  const envSummary = getEnvironmentConfigSummary()
  const errors: string[] = []

  try {
    const config = getBiasDetectionConfig()
    validateConfig(config)
    return {
      isValid: true,
      source: 'merged',
      loadedEnvVars: envSummary.loaded,
      errors: [],
    }
  } catch (error: unknown) {
    errors.push(error instanceof Error ? String(error) : String(error))
    return {
      isValid: false,
      source: 'invalid',
      loadedEnvVars: envSummary.loaded,
      errors,
    }
  }
}

/**
 * Check if configuration is production ready
 */
/**
 * Check if configuration is production-ready
 */
export function isProductionReady(): {
  ready: boolean
  issues: string[]
} {
  const config = getBiasDetectionConfig()
  const issues: string[] = []

  // Check required environment variables
  if (!process.env['JWT_SECRET']) {
    issues.push('JWT_SECRET environment variable is required')
  }

  if (!process.env['ENCRYPTION_KEY']) {
    issues.push('ENCRYPTION_KEY environment variable is required')
  }

  // Check service configuration - comprehensive insecure URL checks
  if (
    config?.['pythonServiceUrl']?.includes?.('localhost') ||
    config?.['pythonServiceUrl']?.includes?.('127.0.0.1') ||
    config?.['pythonServiceUrl']?.includes?.('0.0.0.0') ||
    !config?.['pythonServiceUrl']?.startsWith?.('https://')
  ) {
    issues.push(
      'Python service URL should use HTTPS and not use localhost/127.0.0.1/0.0.0.0 in production',
    )
  }

  // Check HIPAA compliance
  if (!config['hipaaCompliant']) {
    issues.push('HIPAA compliance must be enabled for production')
  }

  if (!config['auditLogging']) {
    issues.push('Audit logging must be enabled for production')
  }

  // Check alert configuration
  if (
    !config?.['alertConfig']?.['enableEmailNotifications'] &&
    !config?.['alertConfig']?.['enableSlackNotifications']
  ) {
    issues.push('At least one alert method must be configured')
  }

  return {
    ready: issues.length === 0,
    issues,
  }
}

// Export singleton instance for convenience
export const biasDetectionConfig = BiasDetectionConfigManager.getInstance()
