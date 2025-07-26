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
  // Python service configuration
  pythonServiceUrl:
    process.env.BIAS_DETECTION_SERVICE_URL || 'http://localhost:5000',
  pythonServiceTimeout: 30000, // 30 seconds

  // Bias score thresholds (0.0 - 1.0 scale)
  thresholds: {
    warningLevel: 0.3,
    highLevel: 0.6,
    criticalLevel: 0.8,
  },

  // Layer weight configuration for aggregated bias scoring
  layerWeights: {
    preprocessing: 0.25,
    modelLevel: 0.25,
    interactive: 0.25,
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
export function validateConfig(config: Partial<BiasDetectionConfig>): void {
  const errors: string[] = []

  // Validate threshold values
  if (config.thresholds) {
    const { thresholds } = config

    if (
      thresholds.warningLevel !== undefined &&
      (thresholds.warningLevel < 0 || thresholds.warningLevel > 1)
    ) {
      errors.push('thresholds.warningLevel must be between 0.0 and 1.0')
    }

    if (
      thresholds.highLevel !== undefined &&
      (thresholds.highLevel < 0 || thresholds.highLevel > 1)
    ) {
      errors.push('thresholds.highLevel must be between 0.0 and 1.0')
    }

    if (
      thresholds.criticalLevel !== undefined &&
      (thresholds.criticalLevel < 0 || thresholds.criticalLevel > 1)
    ) {
      errors.push('thresholds.criticalLevel must be between 0.0 and 1.0')
    }

    // Validate threshold ordering
    const warning =
      thresholds.warningLevel ?? DEFAULT_CONFIG.thresholds.warningLevel
    const high = thresholds.highLevel ?? DEFAULT_CONFIG.thresholds.highLevel
    const critical =
      thresholds.criticalLevel ?? DEFAULT_CONFIG.thresholds.criticalLevel

    if (warning >= high || high >= critical) {
      errors.push(
        'Thresholds must be in ascending order: warningLevel < highLevel < criticalLevel',
      )
    }
  }

  // Validate layer weights
  if (config.layerWeights) {
    const weights = config.layerWeights

    // Check individual weight values
    Object.entries(weights).forEach(([layer, weight]) => {
      if (weight !== undefined && (weight < 0 || weight > 1)) {
        errors.push(
          `layerWeights.${layer} must be between 0.0 and 1.0, got ${weight}`,
        )
      }
    })

    // Check total sum
    const total =
      (weights.preprocessing ?? 0) +
      (weights.modelLevel ?? 0) +
      (weights.interactive ?? 0) +
      (weights.evaluation ?? 0)

    if (Math.abs(total - 1.0) > 0.001) {
      errors.push(
        `Layer weights must sum to 1.0, current sum is ${total.toFixed(3)}`,
      )
    }
  }

  // Validate Python service configuration
  if (config.pythonServiceUrl) {
    try {
      const url = new URL(config.pythonServiceUrl)
      if (!['http:', 'https:'].includes(url.protocol)) {
        errors.push('pythonServiceUrl must use http:// or https:// protocol')
      }
    } catch {
      errors.push(
        `pythonServiceUrl must be a valid URL, got: ${config.pythonServiceUrl}`,
      )
    }
  }

  if (
    config.pythonServiceTimeout !== undefined &&
    (config.pythonServiceTimeout < 1000 || config.pythonServiceTimeout > 300000)
  ) {
    errors.push(
      `pythonServiceTimeout must be between 1000ms and 300000ms, got ${config.pythonServiceTimeout}ms`,
    )
  }

  // Validate evaluation metrics
  if (config.evaluationMetrics) {
    const validMetrics = [
      'demographic_parity',
      'equalized_odds',
      'calibration',
      'individual_fairness',
    ]
    const invalidMetrics = config.evaluationMetrics.filter(
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
    config.hipaaCompliant !== undefined &&
    typeof config.hipaaCompliant !== 'boolean'
  ) {
    errors.push('hipaaCompliant must be a boolean value')
  }

  if (
    config.auditLogging !== undefined &&
    typeof config.auditLogging !== 'boolean'
  ) {
    errors.push('auditLogging must be a boolean value')
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed: ${errors.join('; ')}`)
  }
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

  // Validate before merging
  validateConfig(userConfig)

  // Deep merge configuration objects
  const mergedConfig: BiasDetectionConfig = {
    ...DEFAULT_CONFIG,
    ...userConfig,
    thresholds: {
      ...DEFAULT_CONFIG.thresholds,
      ...(userConfig.thresholds || {}),
    },
    layerWeights: {
      ...DEFAULT_CONFIG.layerWeights,
      ...(userConfig.layerWeights || {}),
    },
    metricsConfig: {
      ...DEFAULT_CONFIG.metricsConfig,
      ...(userConfig.metricsConfig || {}),
    },
    alertConfig: {
      ...DEFAULT_CONFIG.alertConfig,
      ...(userConfig.alertConfig || {}),
    },
    reportConfig: {
      ...DEFAULT_CONFIG.reportConfig,
      ...(userConfig.reportConfig || {}),
    },
    explanationConfig: {
      ...DEFAULT_CONFIG.explanationConfig,
      ...(userConfig.explanationConfig || {}),
    },
  }

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
    thresholds.warningLevel = parseFloat(process.env.BIAS_WARNING_THRESHOLD)
  }
  if (process.env.BIAS_HIGH_THRESHOLD) {
    thresholds.highLevel = parseFloat(process.env.BIAS_HIGH_THRESHOLD)
  }
  if (process.env.BIAS_CRITICAL_THRESHOLD) {
    thresholds.criticalLevel = parseFloat(process.env.BIAS_CRITICAL_THRESHOLD)
  }
  if (Object.keys(thresholds).length > 0) {
    envConfig.thresholds = thresholds as BiasDetectionConfig['thresholds']
  }

  // Load service configuration
  if (process.env.BIAS_DETECTION_SERVICE_URL) {
    envConfig.pythonServiceUrl = process.env.BIAS_DETECTION_SERVICE_URL
  }
  if (process.env.BIAS_SERVICE_TIMEOUT) {
    envConfig.pythonServiceTimeout = parseInt(process.env.BIAS_SERVICE_TIMEOUT)
  }

  // Load layer weights
  const layerWeights: Partial<BiasDetectionConfig['layerWeights']> = {}
  if (process.env.BIAS_WEIGHT_PREPROCESSING) {
    layerWeights.preprocessing = parseFloat(
      process.env.BIAS_WEIGHT_PREPROCESSING,
    )
  }
  if (process.env.BIAS_WEIGHT_MODEL_LEVEL) {
    layerWeights.modelLevel = parseFloat(process.env.BIAS_WEIGHT_MODEL_LEVEL)
  }
  if (process.env.BIAS_WEIGHT_INTERACTIVE) {
    layerWeights.interactive = parseFloat(process.env.BIAS_WEIGHT_INTERACTIVE)
  }
  if (process.env.BIAS_WEIGHT_EVALUATION) {
    layerWeights.evaluation = parseFloat(process.env.BIAS_WEIGHT_EVALUATION)
  }
  if (Object.keys(layerWeights).length > 0) {
    envConfig.layerWeights = layerWeights as BiasDetectionConfig['layerWeights']
  }

  // Load evaluation metrics
  if (process.env.BIAS_EVALUATION_METRICS) {
    envConfig.evaluationMetrics = process.env.BIAS_EVALUATION_METRICS.split(
      ',',
    ).map((m: string) => m.trim())
  }

  // Load compliance settings
  if (process.env.ENABLE_HIPAA_COMPLIANCE) {
    envConfig.hipaaCompliant = process.env.ENABLE_HIPAA_COMPLIANCE === 'true'
  }
  if (process.env.ENABLE_AUDIT_LOGGING) {
    envConfig.auditLogging = process.env.ENABLE_AUDIT_LOGGING === 'true'
  }
  if (process.env.ENABLE_DATA_MASKING) {
    envConfig.dataMaskingEnabled = process.env.ENABLE_DATA_MASKING === 'true'
  }

  // Load alert configuration
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

  public getConfig(): BiasDetectionConfig {
    return this.config
  }

  public getThresholds() {
    return this.config.thresholds
  }

  public getLayerWeights() {
    return this.config.layerWeights
  }

  public getPythonServiceConfig() {
    const url = new URL(this.config.pythonServiceUrl)
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
        this.config.metricsConfig.enableRealTimeMonitoring,
    }
  }

  public updateConfig(updates: Partial<BiasDetectionConfig>): void {
    this.config = updateConfiguration(this.config, updates)
  }

  public reloadFromEnvironment(): void {
    this.config = createConfigWithEnvOverrides()
  }
}

/**
 * Global configuration instance
 */
export const biasDetectionConfig = BiasDetectionConfigManager.getInstance()

/**
 * Convenience function to get current configuration
 */
export function getBiasDetectionConfig(): BiasDetectionConfig {
  return biasDetectionConfig.getConfig()
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
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error))
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
    config.pythonServiceUrl.includes('localhost') ||
    config.pythonServiceUrl.includes('127.0.0.1') ||
    config.pythonServiceUrl.includes('0.0.0.0') ||
    !config.pythonServiceUrl.startsWith('https://')
  ) {
    issues.push(
      'Python service URL should use HTTPS and not use localhost/127.0.0.1/0.0.0.0 in production',
    )
  }

  // Check HIPAA compliance
  if (!config.hipaaCompliant) {
    issues.push('HIPAA compliance must be enabled for production')
  }

  if (!config.auditLogging) {
    issues.push('Audit logging must be enabled for production')
  }

  // Check alert configuration
  if (
    !config.alertConfig.enableEmailNotifications &&
    !config.alertConfig.enableSlackNotifications
  ) {
    issues.push('At least one alert method must be configured')
  }

  return {
    ready: issues.length === 0,
    issues,
  }
}
