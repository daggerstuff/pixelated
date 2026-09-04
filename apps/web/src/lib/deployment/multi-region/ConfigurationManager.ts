/**
 * Configuration Manager
 *
 * Manages multi-region deployment configuration with environment-specific
 * settings, feature flags, and dynamic configuration updates.
 */

import { EventEmitter } from 'events'

import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const logger = createBuildSafeLogger('ConfigurationManager')
import type {
  MultiRegionConfig,
  EnvironmentConfig,
  FeatureFlags,
  SecretConfig,
  MonitoringConfig,
  ComplianceConfig,
} from './configuration-manager.types'
import { validateConfiguration, mergeConfigurations } from './configuration-manager.utils'
export type {
  MultiRegionConfig,
  EnvironmentConfig,
  FeatureFlags,
  SecretConfig,
  MonitoringConfig,
  ComplianceConfig,
} from './configuration-manager.types'

import { EdgeDeploymentConfig } from './EdgeComputingManager'
import { RoutingConfig } from './GlobalTrafficRoutingManager'
import { DeploymentConfig, RegionConfig } from './MultiRegionDeploymentManager'

export class ConfigurationManager extends EventEmitter {
  private config: MultiRegionConfig
  private readonly configWatchers: Map<string, NodeJS.Timeout> = new Map()
  private readonly featureFlagCache: Map<string, boolean> = new Map()

  constructor(initialConfig: MultiRegionConfig) {
    super()
    this.config = initialConfig
  }

  /**
   * Initialize configuration manager
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Configuration Manager')

      // Validate initial configuration
      await validateConfiguration(this.config)

      // Load environment-specific configuration
      await this.loadEnvironmentConfig()

      // Initialize feature flags
      await this.initializeFeatureFlags()

      // Setup configuration watchers
      this.setupConfigurationWatchers()

      logger.info('Configuration Manager initialized successfully')

      this.emit('initialized', {
        environments: Object.keys(this.config.environments),
        regions: this.config.deployment.regions.length,
      })
    } catch (error: unknown) {
      logger.error('Failed to initialize Configuration Manager', { error })
      throw new Error(
        `Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          cause: error,
        },
      )
    }
  }

  /**
   * Validate configuration structure and values
   */

  /**
   * Load environment-specific configuration
   */
  private async loadEnvironmentConfig(): Promise<void> {
    try {
      const environment = process.env['NODE_ENV'] ?? 'development'
      logger.info(`Loading configuration for environment: ${environment}`)

      // Load environment-specific overrides
      const envConfig = await this.loadEnvironmentOverrides(environment)

      if (envConfig) {
        this.config = mergeConfigurations(this.config, envConfig)
        logger.info(`Environment configuration loaded for: ${environment}`)
      }

      // Load secrets from environment variables
      await this.loadSecretsFromEnvironment()
    } catch (error: unknown) {
      logger.error('Failed to load environment configuration', { error })
      throw error
    }
  }

  /**
   * Load environment-specific overrides
   */
  private async loadEnvironmentOverrides(
    environment: string,
  ): Promise<Partial<MultiRegionConfig> | null> {
    try {
      // In a real implementation, this would load from a configuration service or file

      // Simulate loading configuration
      const envOverrides: Record<string, Partial<MultiRegionConfig>> = {
        development: {
          deployment: {
            globalServices: {
              trafficManager: true,
              threatIntelligence: false,
              complianceManager: false,
            },
            edgeComputing: {
              enabled: true,
              locations: ['us-east-1-edge'],
              cacheSize: '2Gi',
            },
            dataSync: {
              strategy: 'active-passive',
              consistencyLevel: 'eventual',
              conflictResolution: 'timestamp',
            },
            failover: {
              automatic: false,
              detectionTime: 30_000,
              recoveryTime: 120_000,
              healthCheckInterval: 30_000,
              maxDataSyncLag: 5000,
              failoverCooldown: 180_000,
            },
            regions: this.config.deployment.regions.map((region) => ({
              ...region,
              capacity: {
                ...region.capacity,
                minInstances: 1,
                maxInstances: 5,
                desiredInstances: 2,
              },
            })),
          },
          featureFlags: {
            ...this.config.featureFlags,
            multiRegionDeployment: true,
            edgeComputing: true,
            intelligentRouting: true,
            autoFailover: false,
            performanceMonitoring: true,
          },
          monitoring: {
            metrics: {
              enabled: true,
              interval: 30000,
              retention: 7,
              aggregation: 'average',
            },
            alerting: {
              enabled: false,
              channels: [],
              severityLevels: [],
              escalationRules: {},
            },
            logging: {
              level: 'debug',
              format: 'json',
              destinations: ['console'],
              sampling: 1.0,
            },
          },
        },
        staging: {
          deployment: {
            globalServices: {
              trafficManager: true,
              threatIntelligence: false,
              complianceManager: true,
            },
            edgeComputing: {
              enabled: true,
              locations: ['us-east-1-edge', 'us-west-2-edge'],
              cacheSize: '4Gi',
            },
            dataSync: {
              strategy: 'active-passive',
              consistencyLevel: 'strong',
              conflictResolution: 'timestamp',
            },
            failover: {
              automatic: true,
              detectionTime: 20_000,
              recoveryTime: 60_000,
              healthCheckInterval: 20_000,
              maxDataSyncLag: 3000,
              failoverCooldown: 120_000,
            },
            regions: this.config.deployment.regions.map((region) => ({
              ...region,
              capacity: {
                ...region.capacity,
                minInstances: 2,
                maxInstances: 10,
                desiredInstances: 5,
              },
            })),
          },
          featureFlags: {
            ...this.config.featureFlags,
            multiRegionDeployment: true,
            edgeComputing: true,
            intelligentRouting: true,
            autoFailover: true,
            performanceMonitoring: true,
          },
          monitoring: {
            metrics: {
              enabled: true,
              interval: 60000,
              retention: 14,
              aggregation: 'average',
            },
            alerting: {
              enabled: true,
              channels: ['slack'],
              severityLevels: ['warning', 'error'],
              escalationRules: {},
            },
            logging: {
              level: 'info',
              format: 'json',
              destinations: ['console', 'file'],
              sampling: 0.5,
            },
          },
        },
        production: {
          deployment: {
            globalServices: {
              trafficManager: true,
              threatIntelligence: true,
              complianceManager: true,
            },
            edgeComputing: {
              enabled: true,
              locations: ['global'],
              cacheSize: '8Gi',
            },
            dataSync: {
              strategy: 'active-active',
              consistencyLevel: 'strong',
              conflictResolution: 'vector-clock',
            },
            failover: {
              automatic: true,
              detectionTime: 15_000,
              recoveryTime: 45_000,
              healthCheckInterval: 10_000,
              maxDataSyncLag: 1000,
              failoverCooldown: 90_000,
            },
            regions: this.config.deployment.regions.map((region) => ({
              ...region,
              capacity: {
                ...region.capacity,
                minInstances: 3,
                maxInstances: 20,
                desiredInstances: 10,
              },
            })),
          },
          featureFlags: {
            ...this.config.featureFlags,
            multiRegionDeployment: true,
            edgeComputing: true,
            intelligentRouting: true,
            autoFailover: true,
            performanceMonitoring: true,
            threatDetection: true,
            biasDetection: true,
            complianceChecking: true,
          },
          monitoring: {
            metrics: {
              enabled: true,
              interval: 30000,
              retention: 30,
              aggregation: 'detailed',
            },
            alerting: {
              enabled: true,
              channels: ['slack', 'email', 'pagerduty'],
              severityLevels: ['info', 'warning', 'error', 'critical'],
              escalationRules: {},
            },
            logging: {
              level: 'warn',
              format: 'structured',
              destinations: ['console', 'file', 'elasticsearch'],
              sampling: 0.1,
            },
          },
        },
      }

      return envOverrides[environment] ?? null
    } catch (error: unknown) {
      logger.error('Failed to load environment overrides', { error })
      return null
    }
  }

  /**
   * Load secrets from environment variables
   */
  private async loadSecretsFromEnvironment(): Promise<void> {
    try {
      logger.info('Loading secrets from environment variables')

      // AWS credentials
      if (process.env['AWS_ACCESS_KEY_ID']) {
        this.config.secrets.cloudProviders.aws.accessKeyId =
          process.env['AWS_ACCESS_KEY_ID']
      }
      if (process.env['AWS_SECRET_ACCESS_KEY']) {
        this.config.secrets.cloudProviders.aws.secretAccessKey =
          process.env['AWS_SECRET_ACCESS_KEY']
      }
      if (process.env['AWS_REGION']) {
        this.config.secrets.cloudProviders.aws.region =
          process.env['AWS_REGION']
      }

      // GCP credentials
      if (process.env['GOOGLE_CLOUD_PROJECT']) {
        this.config.secrets.cloudProviders.gcp.projectId =
          process.env['GOOGLE_CLOUD_PROJECT']
      }
      if (process.env['GOOGLE_APPLICATION_CREDENTIALS']) {
        this.config.secrets.cloudProviders.gcp.keyFilename =
          process.env['GOOGLE_APPLICATION_CREDENTIALS']
      }

      // Azure credentials
      if (process.env['AZURE_SUBSCRIPTION_ID']) {
        this.config.secrets.cloudProviders.azure.subscriptionId =
          process.env['AZURE_SUBSCRIPTION_ID']
      }
      if (process.env['AZURE_CLIENT_ID']) {
        this.config.secrets.cloudProviders.azure.clientId =
          process.env['AZURE_CLIENT_ID']
      }
      if (process.env['AZURE_CLIENT_SECRET']) {
        this.config.secrets.cloudProviders.azure.clientSecret =
          process.env['AZURE_CLIENT_SECRET']
      }
      if (process.env['AZURE_TENANT_ID']) {
        this.config.secrets.cloudProviders.azure.tenantId =
          process.env['AZURE_TENANT_ID']
      }

      // Database credentials
      if (process.env['COCKROACHDB_CONNECTION_STRING']) {
        this.config.secrets.databases.cockroachdb.connectionString =
          process.env['COCKROACHDB_CONNECTION_STRING']
      }
      if (process.env['REDIS_URL']) {
        this.config.secrets.databases.redis.url = process.env['REDIS_URL']
      }
      if (process.env['REDIS_PASSWORD']) {
        this.config.secrets.databases.redis.password =
          process.env['REDIS_PASSWORD']
      }

      // AI service credentials
      if (process.env['OPENAI_API_KEY']) {
        this.config.secrets.aiServices.openai.apiKey =
          process.env['OPENAI_API_KEY']
      }
      if (process.env['OPENAI_ORGANIZATION']) {
        this.config.secrets.aiServices.openai.organization =
          process.env['OPENAI_ORGANIZATION']
      }
      if (process.env['GOOGLE_AI_API_KEY']) {
        this.config.secrets.aiServices.google.apiKey =
          process.env['GOOGLE_AI_API_KEY']
      }
      if (process.env['GOOGLE_CLOUD_PROJECT']) {
        this.config.secrets.aiServices.google.projectId =
          process.env['GOOGLE_CLOUD_PROJECT']
      }

      // Monitoring credentials
      if (process.env['SENTRY_DSN']) {
        this.config.secrets.monitoring.sentry.dsn = process.env['SENTRY_DSN']
      }
      if (process.env['SENTRY_AUTH_TOKEN']) {
        this.config.secrets.monitoring.sentry.authToken =
          process.env['SENTRY_AUTH_TOKEN']
      }
      if (process.env['DATADOG_API_KEY']) {
        this.config.secrets.monitoring.datadog.apiKey =
          process.env['DATADOG_API_KEY']
      }
      if (process.env['DATADOG_APP_KEY']) {
        this.config.secrets.monitoring.datadog.appKey =
          process.env['DATADOG_APP_KEY']
      }

      logger.info('Secrets loaded from environment variables')
    } catch (error: unknown) {
      logger.error('Failed to load secrets from environment', { error })
      throw error
    }
  }

  /**
   * Initialize feature flags
   */
  private async initializeFeatureFlags(): Promise<void> {
    try {
      logger.info('Initializing feature flags')

      // Validate feature flag dependencies
      if (
        this.config.featureFlags.multiRegionDeployment &&
        this.config.deployment.regions.length === 0
      ) {
        logger.warn('Multi-region deployment enabled but no regions configured')
        this.config.featureFlags.multiRegionDeployment = false
      }

      if (
        this.config.featureFlags.edgeComputing &&
        (!this.config.edgeComputing ||
          this.config.edgeComputing.locations.length === 0)
      ) {
        logger.warn('Edge computing enabled but no edge locations configured')
        this.config.featureFlags.edgeComputing = false
      }

      // Cache feature flags for quick access
      for (const [flag, value] of Object.entries(this.config.featureFlags)) {
        this.featureFlagCache.set(flag, value)
      }

      logger.info('Feature flags initialized', {
        enabledFlags: Object.entries(this.config.featureFlags)
          .filter(([, value]) => value)
          .map(([key]) => key),
      })
    } catch (error: unknown) {
      logger.error('Failed to initialize feature flags', { error })
      throw error
    }
  }

  /**
   * Setup configuration watchers for dynamic updates
   */
  private setupConfigurationWatchers(): void {
    try {
      // Watch for configuration file changes
      this.setupFileWatchers()

      // Watch for environment variable changes
      this.setupEnvironmentWatchers()

      // Watch for feature flag changes
      this.setupFeatureFlagWatchers()

      logger.info('Configuration watchers setup completed')
    } catch (error: unknown) {
      logger.error('Failed to setup configuration watchers', { error })
      throw error
    }
  }

  /**
   * Setup file watchers for configuration changes
   */
  private setupFileWatchers(): void {
    // In a real implementation, this would use file system watchers
    // For now, we'll simulate periodic checks
    const fileWatcher = setInterval(() => {
      void this.checkForConfigurationUpdates()
    }, 30000) // Check every 30 seconds

    this.configWatchers.set('file', fileWatcher)
  }

  /**
   * Setup environment variable watchers
   */
  private setupEnvironmentWatchers(): void {
    const envWatcher = setInterval(() => {
      void this.checkForEnvironmentChanges()
    }, 60000) // Check every minute

    this.configWatchers.set('environment', envWatcher)
  }

  /**
   * Setup feature flag watchers
   */
  private setupFeatureFlagWatchers(): void {
    const flagWatcher = setInterval(() => {
      void this.checkForFeatureFlagChanges()
    }, 15000) // Check every 15 seconds

    this.configWatchers.set('featureFlags', flagWatcher)
  }

  /**
   * Check for configuration file updates
   */
  private async checkForConfigurationUpdates(): Promise<void> {
    try {
      // Simulate checking for configuration updates
      // In a real implementation, this would check file modification times
      // or use a configuration service API
      const hasUpdates = Math.random() < 0.01 // 1% chance of updates

      if (hasUpdates) {
        logger.info('Configuration updates detected')
        await this.reloadConfiguration()
      }
    } catch (error: unknown) {
      logger.error('Error checking for configuration updates', { error })
    }
  }

  /**
   * Check for environment variable changes
   */
  private async checkForEnvironmentChanges(): Promise<void> {
    try {
      // Check for critical environment variable changes
      const criticalVars = [
        'NODE_ENV',
        'AWS_REGION',
        'GOOGLE_CLOUD_PROJECT',
        'COCKROACHDB_CONNECTION_STRING',
      ]

      let hasChanges = false
      for (const varName of criticalVars) {
        const currentValue = process.env[varName]
        const previousValue = this.getCachedEnvironmentVariable(varName)

        if (currentValue !== previousValue) {
          hasChanges = true
          this.cacheEnvironmentVariable(varName, currentValue)
          logger.info(`Environment variable changed: ${varName}`)
        }
      }

      if (hasChanges) {
        await this.reloadConfiguration()
      }
    } catch (error: unknown) {
      logger.error('Error checking for environment changes', { error })
    }
  }

  /**
   * Check for feature flag changes
   */
  private async checkForFeatureFlagChanges(): Promise<void> {
    try {
      // Simulate checking for feature flag updates
      // In a real implementation, this would check a feature flag service
      const hasChanges = Math.random() < 0.02 // 2% chance of changes

      if (hasChanges) {
        logger.info('Feature flag changes detected')
        await this.reloadFeatureFlags()
      }
    } catch (error: unknown) {
      logger.error('Error checking for feature flag changes', { error })
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): MultiRegionConfig {
    return { ...this.config }
  }

  /**
   * Get deployment configuration
   */
  getDeploymentConfig(): DeploymentConfig {
    return { ...this.config.deployment }
  }

  /**
   * Get primary region identifier
   */
  getPrimaryRegion(): string {
    const sortedRegions = [...this.config.deployment.regions].sort(
      (a, b) => a.priority - b.priority,
    )
    return sortedRegions[0]?.id ?? ''
  }

  /**
   * Get backup region identifiers
   */
  getBackupRegions(): string[] {
    const sortedRegions = [...this.config.deployment.regions].sort(
      (a, b) => a.priority - b.priority,
    )
    return sortedRegions.slice(1).map((region) => region.id)
  }

  /**
   * Get failover configuration
   */
  getFailoverConfig(): DeploymentConfig['failover'] {
    return { ...this.config.deployment.failover }
  }

  /**
   * Get DNS failover configuration
   */
  getDNSConfig(): {
    domainName: string
    hostedZoneId: string
    cloudflareZoneId?: string
    ttl?: number
  } {
    return {
      domainName:
        process.env['MULTI_REGION_DOMAIN_NAME'] ??
        this.config.deployment.regions[0]?.name ??
        'example.com',
      hostedZoneId:
        process.env['MULTI_REGION_HOSTED_ZONE_ID'] ?? 'Z00000000000000000000',
      cloudflareZoneId:
        process.env['MULTI_REGION_CLOUDFLARE_ZONE_ID'] ?? undefined,
      ttl: Number.parseInt(process.env['MULTI_REGION_DNS_TTL'] ?? '60', 10),
    }
  }

  /**
   * Get current environment name
   */
  getEnvironment(): string {
    return process.env['NODE_ENV'] ?? 'production'
  }

  /**
   * Get edge computing configuration
   */
  getEdgeComputingConfig(): EdgeDeploymentConfig {
    return { ...this.config.edgeComputing }
  }

  /**
   * Get traffic routing configuration
   */
  getTrafficRoutingConfig(): RoutingConfig {
    return { ...this.config.trafficRouting }
  }

  /**
   * Get environment-specific configuration
   */
  getEnvironmentConfig(environment: string): EnvironmentConfig {
    return {
      ...this.config.environments[
        environment as keyof typeof this.config.environments
      ],
    }
  }

  /**
   * Check if feature flag is enabled
   */
  isFeatureEnabled(flag: keyof FeatureFlags): boolean {
    return this.featureFlagCache.get(flag) ?? false
  }

  /**
   * Get all feature flags
   */
  getFeatureFlags(): FeatureFlags {
    return { ...this.config.featureFlags }
  }

  /**
   * Update feature flag
   */
  async updateFeatureFlag(
    flag: keyof FeatureFlags,
    enabled: boolean,
  ): Promise<void> {
    try {
      this.config.featureFlags[flag] = enabled
      this.featureFlagCache.set(flag, enabled)

      logger.info(`Feature flag updated: ${flag} = ${enabled}`)
      this.emit('feature-flag-updated', { flag, enabled })
    } catch (error: unknown) {
      logger.error('Failed to update feature flag', { error, flag, enabled })
      throw error
    }
  }

  /**
   * Get secrets configuration
   */
  getSecrets(): SecretConfig {
    return { ...this.config.secrets }
  }

  /**
   * Get monitoring configuration
   */
  getMonitoringConfig(): MonitoringConfig {
    return { ...this.config.monitoring }
  }

  /**
   * Get compliance configuration
   */
  getComplianceConfig(): ComplianceConfig {
    return { ...this.config.compliance }
  }

  /**
   * Update configuration
   */
  async updateConfig(updates: Partial<MultiRegionConfig>): Promise<void> {
    try {
      logger.info('Updating configuration')

      // Validate updates
      await validateConfiguration({
        ...this.config,
        ...updates,
      })

      // Apply updates
      this.config = mergeConfigurations(this.config, updates)

      // Reinitialize affected components
      await this.reinitializeAffectedComponents(updates)

      logger.info('Configuration updated successfully')
      this.emit('configuration-updated', { updates: Object.keys(updates) })
    } catch (error: unknown) {
      logger.error('Failed to update configuration', { error })
      throw error
    }
  }

  /**
   * Merge configurations
   */

  /**
   * Reinitialize components affected by configuration changes
   */
  private async reinitializeAffectedComponents(
    updates: Partial<MultiRegionConfig>,
  ): Promise<void> {
    try {
      const affectedComponents: string[] = []

      if (updates.deployment) {
        affectedComponents.push('deployment')
      }
      if (updates.edgeComputing) {
        affectedComponents.push('edge-computing')
      }
      if (updates.trafficRouting) {
        affectedComponents.push('traffic-routing')
      }
      if (updates.featureFlags) {
        affectedComponents.push('feature-flags')
        await this.initializeFeatureFlags()
      }
      if (updates.monitoring) {
        affectedComponents.push('monitoring')
      }

      if (affectedComponents.length > 0) {
        logger.info('Reinitializing affected components', {
          components: affectedComponents,
        })
        this.emit('components-reinitialized', {
          components: affectedComponents,
        })
      }
    } catch (error: unknown) {
      logger.error('Failed to reinitialize affected components', { error })
      throw error
    }
  }

  /**
   * Reload configuration
   */
  private async reloadConfiguration(): Promise<void> {
    try {
      logger.info('Reloading configuration')

      // Load new configuration
      const newConfig = await this.loadConfigurationFromSource()

      if (newConfig) {
        // Validate new configuration
        await validateConfiguration(newConfig)

        // Apply new configuration
        this.config = newConfig

        // Reinitialize components
        await this.reinitializeAffectedComponents(newConfig)

        logger.info('Configuration reloaded successfully')
        this.emit('configuration-reloaded')
      }
    } catch (error: unknown) {
      logger.error('Failed to reload configuration', { error })
      throw error
    }
  }

  /**
   * Load configuration from source
   */
  private async loadConfigurationFromSource(): Promise<MultiRegionConfig | null> {
    // In a real implementation, this would load from a configuration service
    // For now, return current configuration
    return null
  }

  /**
   * Reload feature flags
   */
  private async reloadFeatureFlags(): Promise<void> {
    try {
      logger.info('Reloading feature flags')

      // Simulate loading new feature flags
      // In a real implementation, this would load from a feature flag service
      const newFlags = { ...this.config.featureFlags }

      // Randomly toggle some flags for simulation
      const flags = Object.keys(newFlags) as (keyof FeatureFlags)[]
      const flagToToggle = flags[Math.floor(Math.random() * flags.length)]
      newFlags[flagToToggle] = !newFlags[flagToToggle]

      // Update configuration
      this.config.featureFlags = newFlags
      await this.initializeFeatureFlags()

      logger.info('Feature flags reloaded successfully')
      this.emit('feature-flags-reloaded')
    } catch (error: unknown) {
      logger.error('Failed to reload feature flags', { error })
      throw error
    }
  }

  /**
   * Helper methods for caching
   */
  private getCachedEnvironmentVariable(varName: string): string | undefined {
    // In a real implementation, this would use a proper cache
    return process.env[varName]
  }

  private cacheEnvironmentVariable(
    _varName: string,
    _value: string | undefined,
  ): void {
    // In a real implementation, this would use a proper cache
    // For now, we just use the process.env directly
  }

  /**
   * Get configuration summary
   */
  getConfigurationSummary(): {
    environments: string[]
    totalRegions: number
    totalEdgeLocations: number
    enabledFeatures: string[]
    complianceStandards: string[]
  } {
    return {
      environments: Object.keys(this.config.environments),
      totalRegions: this.config.deployment.regions.length,
      totalEdgeLocations: this.config.edgeComputing.locations.length,
      enabledFeatures: Object.entries(this.config.featureFlags)
        .filter(([, value]) => value)
        .map(([key]) => key),
      complianceStandards: Object.keys(this.config.compliance).filter(
        (standard) =>
          this.config.compliance[standard as keyof ComplianceConfig].enabled,
      ),
    }
  }

  /**
   * Export configuration for backup
   */
  exportConfiguration(redactSecrets: boolean = true): MultiRegionConfig {
    const config = { ...this.config }

    if (redactSecrets) {
      // Redact sensitive information
      config.secrets = {
        cloudProviders: {
          aws: {
            accessKeyId: '***',
            secretAccessKey: '***',
            region: config.secrets.cloudProviders.aws.region,
          },
          gcp: {
            projectId: config.secrets.cloudProviders.gcp.projectId,
            keyFilename: '***',
          },
          azure: {
            subscriptionId: '***',
            clientId: '***',
            clientSecret: '***',
            tenantId: '***',
          },
        },
        databases: {
          cockroachdb: {
            connectionString: '***',
            sslMode: config.secrets.databases.cockroachdb.sslMode,
          },
          redis: { url: '***', password: '***' },
        },
        aiServices: {
          openai: {
            apiKey: '***',
            organization: config.secrets.aiServices.openai.organization,
          },
          google: {
            apiKey: '***',
            projectId: config.secrets.aiServices.google.projectId,
          },
        },
        monitoring: {
          sentry: { dsn: '***', authToken: '***' },
          datadog: { apiKey: '***', appKey: '***' },
        },
      }
    }

    return config
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      logger.info('Cleaning up Configuration Manager')

      // Clear all watchers
      for (const [name, watcher] of this.configWatchers.entries()) {
        clearInterval(watcher)
        logger.debug(`Stopped configuration watcher: ${name}`)
      }
      this.configWatchers.clear()

      // Clear caches
      this.featureFlagCache.clear()

      logger.info('Configuration Manager cleanup completed')
    } catch (error: unknown) {
      logger.error('Configuration Manager cleanup failed', { error })
      throw error
    }
  }
}

export default ConfigurationManager
