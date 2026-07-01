/**
 * Multi-Region Deployment Manager
 *
 * Manages deployment orchestration across multiple cloud providers and regions
 * with automated provisioning, configuration, and health monitoring.
 */

import { EventEmitter } from 'events'

import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const logger = createBuildSafeLogger('MultiRegionDeploymentManager')
import {
  CloudProviderManager,
  type DeploymentResult,
} from './CloudProviderManager'
import {
  ConfigurationManager,
  type MultiRegionConfig,
} from './ConfigurationManager'
import {
  DeploymentOrchestrator,
  type DeploymentOrchestratorConfig,
} from './DeploymentOrchestrator'
import { HealthMonitor, type HealthCheckConfig } from './HealthMonitor'

export interface RegionConfig {
  id: string
  name: string
  provider: 'aws' | 'gcp' | 'azure'
  location: string
  availabilityZones: string[]
  priority: number
  complianceRequirements: string[]
  capacity: {
    minInstances: number
    maxInstances: number
    desiredInstances: number
  }
  networking: {
    vpcCidr: string
    subnetCidrs: string[]
    securityGroups: string[]
  }
}

export interface DeploymentConfig {
  regions: RegionConfig[]
  globalServices: {
    trafficManager: boolean
    threatIntelligence: boolean
    complianceManager: boolean
  }
  edgeComputing: {
    enabled: boolean
    locations: string[]
    cacheSize: string
  }
  dataSync: {
    strategy: 'active-active' | 'active-passive'
    consistencyLevel: 'strong' | 'eventual'
    conflictResolution: 'timestamp' | 'vector-clock'
  }
  failover: {
    automatic: boolean
    detectionTime: number
    recoveryTime: number
    healthCheckInterval: number
    maxDataSyncLag: number
    failoverCooldown: number
    snsTopicArn?: string
    sqsQueueUrl?: string
  }
}

export interface DeploymentStatus {
  regionId: string
  status: 'pending' | 'deploying' | 'healthy' | 'degraded' | 'failed'
  lastDeployment: Date
  healthScore: number
  activeInstances: number
  errors: string[]
  metrics: {
    latency: number
    throughput: number
    errorRate: number
  }
}

type HealthCheckFailureEvent = {
  regionId: string
  failureReason: string
}

type HealthCheckRecoveryEvent = {
  regionId: string
}

const isHealthCheckFailureEvent = (
  data: unknown,
): data is HealthCheckFailureEvent => {
  if (typeof data !== 'object' || data === null) {
    return false
  }
  if (!('regionId' in data) || !('failureReason' in data)) {
    return false
  }
  return (
    typeof data.regionId === 'string' && typeof data.failureReason === 'string'
  )
}

const isHealthCheckRecoveryEvent = (
  data: unknown,
): data is HealthCheckRecoveryEvent => {
  if (typeof data !== 'object' || data === null) {
    return false
  }
  return 'regionId' in data && typeof data.regionId === 'string'
}

export class MultiRegionDeploymentManager extends EventEmitter {
  private readonly config: DeploymentConfig
  private readonly configurationManager: ConfigurationManager
  private readonly cloudProviderManager: CloudProviderManager
  private readonly healthMonitor: HealthMonitor
  private readonly deploymentStatuses: Map<string, DeploymentStatus> = new Map()
  private isInitialized = false

  constructor(config: DeploymentConfig) {
    super()
    this.config = config
    this.configurationManager = new ConfigurationManager(
      this.createMultiRegionConfig(config),
    )
    this.cloudProviderManager = new CloudProviderManager()
    this.healthMonitor = new HealthMonitor(this.createHealthCheckConfig())
    void new DeploymentOrchestrator(
      this.createDeploymentOrchestratorConfig(),
      this.cloudProviderManager,
    )
  }

  private createMultiRegionConfig(
    deploymentConfig: DeploymentConfig,
  ): MultiRegionConfig {
    const environmentTemplate = {
      regions: deploymentConfig.regions,
      scaling: {
        autoScaling: true,
        minInstances: 2,
        maxInstances: 20,
        targetCpuUtilization: 70,
        targetMemoryUtilization: 80,
      },
      resources: {
        cpu: '4',
        memory: '8Gi',
        storage: '100Gi',
      },
      networking: {
        vpcCidr: '10.0.0.0/16',
        subnetCidrs: ['10.0.1.0/24'],
        securityGroups: ['default'],
        loadBalancers: ['primary'],
      },
      monitoring: {
        enabled: true,
        samplingRate: 0.1,
        alertThresholds: {},
      },
    } satisfies MultiRegionConfig['environments']['development']

    return {
      deployment: deploymentConfig,
      edgeComputing: {
        locations: [],
        services: {
          threatDetection: false,
          biasDetection: false,
          cacheService: false,
          apiGateway: true,
          staticContent: true,
        },
        aiModels: {
          threatDetection: 'none',
          biasDetection: 'none',
          behavioralAnalysis: 'none',
        },
        cacheStrategies: ['LRU'],
        healthCheck: {
          interval: 30_000,
          timeout: 5_000,
          retries: 3,
        },
      },
      trafficRouting: {
        strategy: 'health-based',
        healthThreshold: 95,
        latencyThreshold: 500,
        complianceRequirements: ['HIPAA'],
        weights: {},
        fallbackRegions: ['us-east-1'],
        cacheTtl: 300,
      },
      environments: {
        development: environmentTemplate,
        staging: {
          ...environmentTemplate,
          scaling: {
            ...environmentTemplate.scaling,
            minInstances: 3,
          },
        },
        production: {
          ...environmentTemplate,
          scaling: {
            ...environmentTemplate.scaling,
            minInstances: 4,
          },
        },
      },
      featureFlags: {
        multiRegionDeployment: true,
        edgeComputing: false,
        intelligentRouting: true,
        autoFailover: true,
        threatDetection: true,
        biasDetection: true,
        complianceChecking: true,
        performanceMonitoring: true,
        aiModelServing: true,
        cacheOptimization: true,
      },
      secrets: {
        cloudProviders: {
          aws: {
            accessKeyId: '',
            secretAccessKey: '',
            region: 'us-east-1',
          },
          gcp: {
            projectId: '',
            keyFilename: '',
          },
          azure: {
            subscriptionId: '',
            clientId: '',
            clientSecret: '',
            tenantId: '',
          },
        },
        databases: {
          cockroachdb: {
            connectionString: '',
            sslMode: 'require',
          },
          redis: {
            url: '',
            password: '',
          },
        },
        aiServices: {
          openai: {
            apiKey: '',
            organization: '',
          },
          google: {
            apiKey: '',
            projectId: '',
          },
        },
        monitoring: {
          sentry: {
            dsn: '',
            authToken: '',
          },
          datadog: {
            apiKey: '',
            appKey: '',
          },
        },
      },
      monitoring: {
        metrics: {
          enabled: true,
          interval: 30_000,
          retention: 604_800,
          aggregation: 'mean',
        },
        alerting: {
          enabled: true,
          channels: ['email'],
          severityLevels: ['critical', 'warning'],
          escalationRules: {},
        },
        logging: {
          level: 'info',
          format: 'json',
          destinations: ['console'],
          sampling: 0.1,
        },
      },
      compliance: {
        gdpr: {
          enabled: true,
          dataResidency: ['US'],
          retentionPeriods: {},
          subjectRights: ['access', 'erasure'],
        },
        hipaa: {
          enabled: true,
          encryptionRequired: true,
          auditLogging: true,
          accessControls: ['mfa'],
        },
        soc2: {
          enabled: true,
          auditFrequency: 'weekly',
          controls: ['CCM', 'CC7'],
        },
        pci: {
          enabled: false,
          requirements: [],
          scanningFrequency: 'monthly',
        },
      },
    }
  }

  private createHealthCheckConfig(): HealthCheckConfig {
    return {
      interval: 30_000,
      timeout: 5_000,
      retries: 3,
      thresholds: {
        cpu: 80,
        memory: 85,
        disk: 90,
        responseTime: 500,
        errorRate: 5,
        availability: 95,
      },
    }
  }

  private createDeploymentOrchestratorConfig(): DeploymentOrchestratorConfig {
    return {
      maxParallelDeployments: 3,
      rollbackOnFailure: true,
      healthCheckTimeout: 5_000,
      deploymentTimeout: 120_000,
      retryAttempts: 2,
      retryDelay: 1_000,
      dependencies: {
        infrastructure: ['network', 'dns', 'iam'],
        services: ['api', 'worker'],
        monitoring: ['metrics', 'alerts'],
      },
    }
  }

  /**
   * Initialize the multi-region deployment manager
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Multi-Region Deployment Manager')

      // Initialize configuration manager
      await this.configurationManager.initialize()

      // Initialize cloud provider connections
      await this.cloudProviderManager.initialize(this.config.regions)

      // Initialize health monitoring
      await this.healthMonitor.initialize(this.config.regions)

      // Setup event listeners
      this.setupEventListeners()

      this.isInitialized = true
      logger.info('Multi-Region Deployment Manager initialized successfully')

      this.emit('initialized', { regions: this.config.regions.length })
    } catch (error: unknown) {
      logger.error('Failed to initialize Multi-Region Deployment Manager', {
        error,
      })
      throw new Error(
        `Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          cause: error,
        },
      )
    }
  }

  /**
   * Deploy infrastructure across all configured regions
   */
  async deployAllRegions(): Promise<DeploymentStatus[]> {
    if (!this.isInitialized) {
      throw new Error('Deployment manager not initialized')
    }

    try {
      logger.info('Starting multi-region deployment', {
        regions: this.config.regions.length,
      })

      const deploymentPromises = this.config.regions.map(async (region) =>
        this.deployRegion(region),
      )

      const results = await Promise.allSettled(deploymentPromises)

      const statuses: DeploymentStatus[] = []
      results.forEach((result, index) => {
        const region = this.config.regions[index]
        if (result.status === 'fulfilled') {
          statuses.push(result.value)
        } else {
          statuses.push({
            regionId: region.id,
            status: 'failed',
            lastDeployment: new Date(),
            healthScore: 0,
            activeInstances: 0,
            errors: [
              result.reason instanceof Error
                ? result.reason.message
                : 'Deployment failed',
            ],
            metrics: { latency: 0, throughput: 0, errorRate: 1 },
          })
        }
      })

      this.emit('deployment-complete', { statuses })
      return statuses
    } catch (error: unknown) {
      logger.error('Multi-region deployment failed', { error })
      throw new Error(
        `Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { cause: error },
      )
    }
  }

  /**
   * Deploy infrastructure to a specific region
   */
  private async deployRegion(region: RegionConfig): Promise<DeploymentStatus> {
    const startTime = Date.now()

    try {
      logger.info(`Deploying to region: ${region.name}`, { region: region.id })

      // Validate region configuration
      await this.validateRegionConfig(region)

      // Deploy infrastructure using cloud provider manager
      const deploymentResult =
        await this.cloudProviderManager.deployRegion(region)

      // Configure region-specific services
      await this.configureRegionalServices(region, deploymentResult)

      // Update deployment status
      const status: DeploymentStatus = {
        regionId: region.id,
        status: 'healthy',
        lastDeployment: new Date(),
        healthScore: 100,
        activeInstances: region.capacity.desiredInstances,
        errors: [],
        metrics: {
          latency: 0,
          throughput: 0,
          errorRate: 0,
        },
      }

      this.deploymentStatuses.set(region.id, status)

      logger.info(`Region deployment completed: ${region.name}`, {
        region: region.id,
        duration: Date.now() - startTime,
      })

      this.emit('region-deployed', { region: region.id, status })
      return status
    } catch (error: unknown) {
      logger.error(`Region deployment failed: ${region.name}`, {
        region: region.id,
        error,
      })

      const status: DeploymentStatus = {
        regionId: region.id,
        status: 'failed',
        lastDeployment: new Date(),
        healthScore: 0,
        activeInstances: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        metrics: { latency: 0, throughput: 0, errorRate: 1 },
      }

      this.deploymentStatuses.set(region.id, status)
      this.emit('region-deployment-failed', {
        region: region.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      throw error
    }
  }

  /**
   * Validate region configuration before deployment
   */
  private async validateRegionConfig(region: RegionConfig): Promise<void> {
    const errors: string[] = []

    if (!region.id || !region.name) {
      errors.push('Region ID and name are required')
    }

    if (region.availabilityZones.length === 0) {
      errors.push('At least one availability zone is required')
    }

    if (!region.networking.vpcCidr) {
      errors.push('VPC CIDR is required')
    }

    if (region.capacity.minInstances < 1) {
      errors.push('Minimum instances must be at least 1')
    }

    if (errors.length > 0) {
      throw new Error(`Invalid region configuration: ${errors.join(', ')}`)
    }
  }

  /**
   * Configure region-specific services
   */
  private async configureRegionalServices(
    region: RegionConfig,
    deploymentResult: DeploymentResult,
  ): Promise<void> {
    try {
      // Configure load balancers
      await this.configureLoadBalancers(region, deploymentResult)

      // Configure auto-scaling
      await this.configureAutoScaling(region, deploymentResult)

      // Configure monitoring and alerting
      await this.configureMonitoring(region, deploymentResult)

      // Configure security policies
      await this.configureSecurityPolicies(region, deploymentResult)

      logger.info(`Regional services configured for: ${region.name}`)
    } catch (error: unknown) {
      logger.error(
        `Failed to configure regional services for: ${region.name}`,
        { error },
      )
      throw new Error(
        `Service configuration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          cause: error,
        },
      )
    }
  }

  /**
   * Configure load balancers for the region
   */
  private async configureLoadBalancers(
    region: RegionConfig,
    _deploymentResult: DeploymentResult,
  ): Promise<void> {
    // Implementation for load balancer configuration
    logger.info(`Configuring load balancers for region: ${region.name}`)
  }

  /**
   * Configure auto-scaling for the region
   */
  private async configureAutoScaling(
    region: RegionConfig,
    _deploymentResult: DeploymentResult,
  ): Promise<void> {
    // Implementation for auto-scaling configuration
    logger.info(`Configuring auto-scaling for region: ${region.name}`)
  }

  /**
   * Configure monitoring and alerting for the region
   */
  private async configureMonitoring(
    region: RegionConfig,
    _deploymentResult: DeploymentResult,
  ): Promise<void> {
    // Implementation for monitoring configuration
    logger.info(`Configuring monitoring for region: ${region.name}`)
  }

  /**
   * Configure security policies for the region
   */
  private async configureSecurityPolicies(
    region: RegionConfig,
    _deploymentResult: DeploymentResult,
  ): Promise<void> {
    // Implementation for security policy configuration
    logger.info(`Configuring security policies for region: ${region.name}`)
  }

  /**
   * Get deployment status for all regions
   */
  getDeploymentStatuses(): DeploymentStatus[] {
    return Array.from(this.deploymentStatuses.values())
  }

  /**
   * Get deployment status for a specific region
   */
  getRegionStatus(regionId: string): DeploymentStatus | undefined {
    return this.deploymentStatuses.get(regionId)
  }

  /**
   * Update region capacity
   */
  async updateRegionCapacity(
    regionId: string,
    capacity: RegionConfig['capacity'],
  ): Promise<void> {
    const region = this.config.regions.find((r) => r.id === regionId)
    if (!region) {
      throw new Error(`Region not found: ${regionId}`)
    }

    region.capacity = capacity

    // Apply capacity changes
    await this.cloudProviderManager.updateCapacity(regionId, capacity)

    logger.info(`Updated capacity for region: ${regionId}`, { capacity })
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.healthMonitor.on('health-check-failed', (data) => {
      logger.warn('Health check failed', data)
      void this.handleHealthCheckFailure(data)
    })

    this.healthMonitor.on('health-check-recovered', (data) => {
      logger.info('Health check recovered', data)
      void this.handleHealthCheckRecovery(data)
    })
  }

  /**
   * Handle health check failure
   */
  private async handleHealthCheckFailure(data: unknown): Promise<void> {
    if (isHealthCheckFailureEvent(data)) {
      const { regionId, failureReason } = data
      const status = this.deploymentStatuses.get(regionId)
      if (status) {
        status.status = 'degraded'
        status.errors.push(`Health check failed: ${failureReason}`)

        this.emit('region-degraded', { regionId, reason: failureReason })
      }
    }
  }

  /**
   * Handle health check recovery
   */
  private async handleHealthCheckRecovery(data: unknown): Promise<void> {
    if (isHealthCheckRecoveryEvent(data)) {
      const { regionId } = data
      const status = this.deploymentStatuses.get(regionId)
      if (status) {
        status.status = 'healthy'
        status.errors = status.errors.filter(
          (e) => !e.includes('Health check failed'),
        )

        this.emit('region-recovered', { regionId })
      }
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      logger.info('Cleaning up Multi-Region Deployment Manager')

      // Cleanup cloud provider resources
      await this.cloudProviderManager.cleanup()

      // Cleanup health monitoring
      await this.healthMonitor.cleanup()

      // Cleanup configuration manager
      await this.configurationManager.cleanup()

      this.deploymentStatuses.clear()
      this.isInitialized = false

      logger.info('Multi-Region Deployment Manager cleanup completed')
    } catch (error: unknown) {
      logger.error('Cleanup failed', { error })
      throw error
    }
  }
}

export default MultiRegionDeploymentManager
