import { Logger } from '../../utils/logger'
import { ConfigurationManager } from './ConfigurationManager'
import { HealthMonitor } from './HealthMonitor'
import { CrossRegionDataSyncManager } from './CrossRegionDataSyncManager'
import { EventEmitter } from 'events'
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'
import {
  Route53Client,
  ChangeResourceRecordSetsCommand,
} from '@aws-sdk/client-route-53'
import {
  CloudWatchClient,
  PutMetricDataCommand,
} from '@aws-sdk/client-cloudwatch'

/**
 * Automated Failover Orchestrator
 * Manages automatic failover across regions with health monitoring integration
 */
export class AutomatedFailoverOrchestrator extends EventEmitter {
  private logger: Logger
  private config: ConfigurationManager
  private healthMonitor: HealthMonitor
  private dataSyncManager: CrossRegionDataSyncManager
  private snsClient: SNSClient
  private sqsClient: SQSClient
  private lambdaClient: LambdaClient
  private route53Client: Route53Client
  private cloudWatchClient: CloudWatchClient
  private isActive = false
  private failoverState: FailoverState
  private healthCheckInterval: NodeJS.Timeout | null = null
  private failoverTimeout: NodeJS.Timeout | null = null
  private circuitBreakers: Map<string, CircuitBreaker> = new Map()
  private failoverHistory: FailoverEvent[] = []
  private currentPrimaryRegion: string
  private backupRegions: string[] = []

  constructor(
    config: ConfigurationManager,
    healthMonitor: HealthMonitor,
    dataSyncManager: CrossRegionDataSyncManager,
  ) {
    super()
    this.config = config
    this.healthMonitor = healthMonitor
    this.dataSyncManager = dataSyncManager
    this.logger = new Logger('AutomatedFailoverOrchestrator')

    // Initialize AWS clients
    this.snsClient = new SNSClient({ region: config.getPrimaryRegion() })
    this.sqsClient = new SQSClient({ region: config.getPrimaryRegion() })
    this.lambdaClient = new LambdaClient({ region: config.getPrimaryRegion() })
    this.route53Client = new Route53Client({ region: 'us-east-1' }) // Route 53 is global
    this.cloudWatchClient = new CloudWatchClient({
      region: config.getPrimaryRegion(),
    })

    this.failoverState = {
      status: 'healthy',
      primaryRegion: config.getPrimaryRegion(),
      backupRegion: null,
      lastFailover: null,
      failoverCount: 0,
      reason: null,
    }

    this.currentPrimaryRegion = config.getPrimaryRegion()
    this.backupRegions = config.getBackupRegions()
  }

  /**
   * Initialize the failover orchestrator
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing AutomatedFailoverOrchestrator...')

      // Initialize circuit breakers for each region
      this.initializeCircuitBreakers()

      // Set up health monitoring
      this.setupHealthMonitoring()

      // Initialize failover state from persistent storage
      await this.loadFailoverState()

      // Start health monitoring
      this.startHealthMonitoring()

      // Register event handlers
      this.registerEventHandlers()

      this.isActive = true
      this.logger.info('AutomatedFailoverOrchestrator initialized successfully')

      this.emit('initialized')
    } catch (error) {
      this.logger.error('Failed to initialize AutomatedFailoverOrchestrator', {
        error,
      })
      throw error
    }
  }

  /**
   * Initialize circuit breakers for each region
   */
  private initializeCircuitBreakers(): void {
    const regions = [this.currentPrimaryRegion, ...this.backupRegions]

    for (const region of regions) {
      this.circuitBreakers.set(
        region,
        new CircuitBreaker({
          name: `region-${region}`,
          failureThreshold: 5,
          resetTimeout: 60000, // 1 minute
          monitoringPeriod: 30000, // 30 seconds
          onStateChange: (state) => {
            this.logger.info(
              `Circuit breaker ${region} state changed to ${state}`,
            )
            this.emit('circuitBreakerStateChange', { region, state })
          },
        }),
      )
    }

    this.logger.info(
      `Initialized circuit breakers for ${regions.length} regions`,
    )
  }

  /**
   * Set up health monitoring
   */
  private setupHealthMonitoring(): void {
    // Register custom health checks for failover
    this.healthMonitor.registerCheck('failover-readiness', async () => {
      try {
        const readiness = await this.checkFailoverReadiness()
        return {
          status: readiness.ready ? 'healthy' : 'unhealthy',
          message: readiness.message,
        }
      } catch (error) {
        return {
          status: 'unhealthy',
          message: `Failover readiness check failed: ${error.message}`,
        }
      }
    })

    this.healthMonitor.registerCheck('data-sync-lag', async () => {
      try {
        const maxLag = await this.checkDataSyncLag()
        const threshold = this.config.getFailoverConfig().maxDataSyncLag

        if (maxLag > threshold) {
          return {
            status: 'unhealthy',
            message: `Data sync lag ${maxLag}ms exceeds threshold ${threshold}ms`,
          }
        }

        return {
          status: 'healthy',
          message: `Data sync lag ${maxLag}ms within threshold`,
        }
      } catch (error) {
        return {
          status: 'unhealthy',
          message: `Data sync lag check failed: ${error.message}`,
        }
      }
    })
  }

  /**
   * Check failover readiness
   */
  private async checkFailoverReadiness(): Promise<{
    ready: boolean
    message: string
  }> {
    try {
      // Check if backup regions are healthy
      const backupHealth = await this.checkBackupRegionsHealth()
      if (!backupHealth.healthy) {
        return {
          ready: false,
          message: `Backup regions unhealthy: ${backupHealth.reason}`,
        }
      }

      // Check data synchronization status
      const syncStatus = await this.dataSyncManager.getSyncStatus()
      const hasPendingSync = Array.from(syncStatus.values()).some(
        (status) => status.pendingRecords > 0,
      )

      if (hasPendingSync) {
        return {
          ready: false,
          message: 'Pending data synchronization detected',
        }
      }

      // Check circuit breaker states
      for (const [region, breaker] of this.circuitBreakers) {
        if (breaker.isOpen()) {
          return {
            ready: false,
            message: `Circuit breaker open for region: ${region}`,
          }
        }
      }

      return { ready: true, message: 'All failover readiness checks passed' }
    } catch (error) {
      this.logger.error('Failover readiness check failed', { error })
      return {
        ready: false,
        message: `Readiness check error: ${error.message}`,
      }
    }
  }

  /**
   * Check backup regions health
   */
  private async checkBackupRegionsHealth(): Promise<{
    healthy: boolean
    reason?: string
  }> {
    try {
      const healthyRegions: string[] = []
      const unhealthyRegions: string[] = []

      for (const region of this.backupRegions) {
        const breaker = this.circuitBreakers.get(region)
        if (!breaker || breaker.isOpen()) {
          unhealthyRegions.push(region)
          continue
        }

        // Check if region is responding
        const isHealthy = await this.checkRegionHealth(region)
        if (isHealthy) {
          healthyRegions.push(region)
        } else {
          unhealthyRegions.push(region)
        }
      }

      if (healthyRegions.length === 0) {
        return { healthy: false, reason: 'No healthy backup regions available' }
      }

      if (unhealthyRegions.length > 0) {
        this.logger.warn('Some backup regions are unhealthy', {
          unhealthyRegions,
          healthyRegions,
        })
      }

      return { healthy: true }
    } catch (error) {
      this.logger.error('Backup regions health check failed', { error })
      return { healthy: false, reason: error.message }
    }
  }

  /**
   * Check individual region health
   */
  private async checkRegionHealth(region: string): Promise<boolean> {
    try {
      const breaker = this.circuitBreakers.get(region)
      if (!breaker) return false

      return await breaker.execute(async () => {
        // Check region-specific health
        const health = await this.healthMonitor.getRegionHealth(region)
        return health.status === 'healthy'
      })
    } catch (error) {
      this.logger.error(`Region health check failed for ${region}`, { error })
      return false
    }
  }

  /**
   * Check data synchronization lag
   */
  private async checkDataSyncLag(): Promise<number> {
    try {
      const regions = [this.currentPrimaryRegion, ...this.backupRegions]
      const lagPromises = regions.map((region) =>
        this.dataSyncManager.getReplicationLag(region),
      )

      const lags = await Promise.all(lagPromises)
      return Math.max(...lags)
    } catch (error) {
      this.logger.error('Data sync lag check failed', { error })
      return Infinity
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    const config = this.config.getFailoverConfig()

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck()
      } catch (error) {
        this.logger.error('Health check failed', { error })
      }
    }, config.healthCheckInterval)

    this.logger.info('Health monitoring started')
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      // Check primary region health
      const primaryHealth = await this.healthMonitor.getRegionHealth(
        this.currentPrimaryRegion,
      )

      if (primaryHealth.status === 'unhealthy') {
        this.logger.warn('Primary region unhealthy', {
          region: this.currentPrimaryRegion,
          reason: primaryHealth.message,
        })

        // Check if failover should be triggered
        await this.evaluateFailover()
      }

      // Monitor backup regions
      await this.monitorBackupRegions()

      // Send health metrics to CloudWatch
      await this.sendHealthMetrics()
    } catch (error) {
      this.logger.error('Health check execution failed', { error })
    }
  }

  /**
   * Evaluate if failover should be triggered
   */
  private async evaluateFailover(): Promise<void> {
    try {
      if (this.failoverState.status === 'failing_over') {
        this.logger.info('Failover already in progress')
        return
      }

      const config = this.config.getFailoverConfig()

      // Check if we should wait before triggering failover
      if (this.failoverState.lastFailover) {
        const timeSinceLastFailover =
          Date.now() - this.failoverState.lastFailover.getTime()
        if (timeSinceLastFailover < config.failoverCooldown) {
          this.logger.info('Failover cooldown active', {
            cooldownRemaining: config.failoverCooldown - timeSinceLastFailover,
          })
          return
        }
      }

      // Check failover readiness
      const readiness = await this.checkFailoverReadiness()
      if (!readiness.ready) {
        this.logger.warn('Failover not ready', { reason: readiness.message })
        return
      }

      // Select best backup region
      const bestBackupRegion = await this.selectBestBackupRegion()
      if (!bestBackupRegion) {
        this.logger.error('No suitable backup region available for failover')
        return
      }

      // Trigger failover
      await this.triggerFailover(bestBackupRegion, 'Primary region unhealthy')
    } catch (error) {
      this.logger.error('Failover evaluation failed', { error })
    }
  }

  /**
   * Select the best backup region for failover
   */
  private async selectBestBackupRegion(): Promise<string | null> {
    try {
      const backupHealth = await this.checkBackupRegionsHealth()
      if (!backupHealth.healthy) {
        return null
      }

      const regionScores: { region: string; score: number }[] = []

      for (const region of this.backupRegions) {
        const breaker = this.circuitBreakers.get(region)
        if (!breaker || breaker.isOpen()) continue

        let score = 100 // Base score

        // Check health status
        const health = await this.healthMonitor.getRegionHealth(region)
        if (health.status === 'healthy') {
          score += 50
        } else {
          score -= 100
          continue
        }

        // Check data sync lag
        const lag = await this.dataSyncManager.getReplicationLag(region)
        const maxLag = this.config.getFailoverConfig().maxDataSyncLag
        if (lag <= maxLag) {
          score += Math.max(0, 50 - (lag / maxLag) * 50)
        } else {
          score -= 50
        }

        // Check resource utilization (if available)
        const metrics = await this.getRegionMetrics(region)
        if (metrics) {
          // Prefer regions with lower resource utilization
          score += Math.max(0, 30 - metrics.cpuUtilization * 30)
          score += Math.max(0, 20 - metrics.memoryUtilization * 20)
        }

        regionScores.push({ region, score })
      }

      if (regionScores.length === 0) {
        return null
      }

      // Sort by score (highest first)
      regionScores.sort((a, b) => b.score - a.score)

      this.logger.info('Backup region scores', { regionScores })
      return regionScores[0].region
    } catch (error) {
      this.logger.error('Failed to select best backup region', { error })
      return null
    }
  }

  /**
   * Get region metrics
   */
  private async getRegionMetrics(
    region: string,
  ): Promise<RegionMetrics | null> {
    try {
      // This would typically fetch metrics from monitoring systems
      // For now, return mock data
      return {
        cpuUtilization: Math.random() * 0.8, // 0-80%
        memoryUtilization: Math.random() * 0.7, // 0-70%
        networkLatency: 50 + Math.random() * 100, // 50-150ms
        activeConnections: Math.floor(Math.random() * 1000),
      }
    } catch (error) {
      this.logger.error(`Failed to get metrics for region ${region}`, { error })
      return null
    }
  }

  /**
   * Trigger failover to backup region
   */
  private async triggerFailover(
    backupRegion: string,
    reason: string,
  ): Promise<void> {
    try {
      this.logger.info('Triggering failover', {
        from: this.currentPrimaryRegion,
        to: backupRegion,
        reason,
      })

      this.failoverState.status = 'failing_over'
      this.failoverState.reason = reason

      this.emit('failoverStarted', {
        from: this.currentPrimaryRegion,
        to: backupRegion,
        reason,
        timestamp: new Date(),
      })

      // Step 1: Prepare backup region
      await this.prepareBackupRegion(backupRegion)

      // Step 2: Sync data to ensure consistency
      await this.syncDataBeforeFailover(backupRegion)

      // Step 3: Update DNS routing
      await this.updateDNSRouting(backupRegion)

      // Step 4: Update load balancer configuration
      await this.updateLoadBalancer(backupRegion)

      // Step 5: Promote backup region to primary
      await this.promoteBackupRegion(backupRegion)

      // Step 6: Update configuration
      await this.updateConfiguration(backupRegion)

      // Step 7: Verify failover success
      await this.verifyFailoverSuccess(backupRegion)

      // Update failover state
      this.failoverState = {
        status: 'healthy',
        primaryRegion: backupRegion,
        backupRegion: this.currentPrimaryRegion,
        lastFailover: new Date(),
        failoverCount: this.failoverState.failoverCount + 1,
        reason: null,
      }

      this.currentPrimaryRegion = backupRegion

      this.logger.info('Failover completed successfully', {
        newPrimary: backupRegion,
        oldPrimary: this.failoverState.backupRegion,
      })

      // Send notifications
      await this.sendFailoverNotifications('success', backupRegion)

      // Emit success event
      this.emit('failoverCompleted', {
        newPrimary: backupRegion,
        oldPrimary: this.failoverState.backupRegion,
        timestamp: new Date(),
      })

      // Save failover state
      await this.saveFailoverState()
    } catch (error) {
      this.logger.error('Failover failed', { error })

      this.failoverState.status = 'healthy'
      this.failoverState.reason = `Failover failed: ${error.message}`

      // Send failure notifications
      await this.sendFailoverNotifications(
        'failed',
        backupRegion,
        error.message,
      )

      this.emit('failoverFailed', {
        targetRegion: backupRegion,
        error: error.message,
        timestamp: new Date(),
      })

      throw error
    }
  }

  /**
   * Prepare backup region for failover
   */
  private async prepareBackupRegion(region: string): Promise<void> {
    try {
      this.logger.info('Preparing backup region for failover', { region })

      // Scale up resources in backup region
      await this.scaleUpRegion(region)

      // Warm up caches
      await this.warmUpCaches(region)

      // Pre-deploy application if needed
      await this.preDeployApplication(region)

      this.logger.info('Backup region preparation completed', { region })
    } catch (error) {
      this.logger.error('Failed to prepare backup region', { region, error })
      throw error
    }
  }

  /**
   * Scale up resources in region
   */
  private async scaleUpRegion(region: string): Promise<void> {
    try {
      // This would typically interact with auto-scaling groups
      // For now, log the action
      this.logger.info(`Scaling up resources in ${region}`)

      // Simulate scaling operation
      await this.invokeLambdaFunction('scale-up-resources', { region })
    } catch (error) {
      this.logger.error(`Failed to scale up region ${region}`, { error })
      throw error
    }
  }

  /**
   * Warm up caches in region
   */
  private async warmUpCaches(region: string): Promise<void> {
    try {
      this.logger.info(`Warming up caches in ${region}`)

      // This would typically warm up CDN caches, application caches, etc.
      await this.invokeLambdaFunction('warm-up-caches', { region })
    } catch (error) {
      this.logger.error(`Failed to warm up caches in ${region}`, { error })
      // Non-critical, continue with failover
    }
  }

  /**
   * Pre-deploy application if needed
   */
  private async preDeployApplication(region: string): Promise<void> {
    try {
      this.logger.info(`Pre-deploying application in ${region}`)

      // Check if application is already deployed
      const isDeployed = await this.checkApplicationDeployment(region)

      if (!isDeployed) {
        await this.invokeLambdaFunction('deploy-application', { region })
      }
    } catch (error) {
      this.logger.error(`Failed to pre-deploy application in ${region}`, {
        error,
      })
      throw error
    }
  }

  /**
   * Check if application is deployed in region
   */
  private async checkApplicationDeployment(region: string): Promise<boolean> {
    try {
      // This would typically check if the application is running
      // For now, return true (assume deployed)
      return true
    } catch (error) {
      this.logger.error(`Failed to check application deployment in ${region}`, {
        error,
      })
      return false
    }
  }

  /**
   * Sync data before failover
   */
  private async syncDataBeforeFailover(region: string): Promise<void> {
    try {
      this.logger.info('Syncing data before failover', { region })

      // Force sync all critical data
      await this.dataSyncManager.forceSync('users', region)
      await this.dataSyncManager.forceSync('sessions', region)
      await this.dataSyncManager.forceSync('conversations', region)

      // Wait for sync to complete
      await this.waitForDataSync(region)

      this.logger.info('Data sync completed before failover', { region })
    } catch (error) {
      this.logger.error('Data sync failed before failover', { region, error })
      throw error
    }
  }

  /**
   * Wait for data synchronization to complete
   */
  private async waitForDataSync(region: string): Promise<void> {
    const maxWaitTime = 5 * 60 * 1000 // 5 minutes
    const checkInterval = 10000 // 10 seconds
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitTime) {
      const lag = await this.dataSyncManager.getReplicationLag(region)
      const maxLag = this.config.getFailoverConfig().maxDataSyncLag

      if (lag <= maxLag) {
        this.logger.info('Data sync lag within acceptable range', {
          region,
          lag,
        })
        return
      }

      this.logger.info('Waiting for data sync', { region, lag, maxLag })
      await this.sleep(checkInterval)
    }

    throw new Error(`Data sync timeout for region ${region}`)
  }

  /**
   * Update DNS routing
   */
  private async updateDNSRouting(region: string): Promise<void> {
    try {
      this.logger.info('Updating DNS routing', { region })

      const config = this.config.getDNSConfig()

      // Update Route 53 records
      await this.updateRoute53Records(region, config)

      // Update Cloudflare if configured
      if (config.cloudflareZoneId) {
        await this.updateCloudflareRecords(region, config)
      }

      this.logger.info('DNS routing updated', { region })
    } catch (error) {
      this.logger.error('Failed to update DNS routing', { region, error })
      throw error
    }
  }

  /**
   * Update Route 53 records
   */
  private async updateRoute53Records(
    region: string,
    config: any,
  ): Promise<void> {
    try {
      const changeBatch = {
        Changes: [
          {
            Action: 'UPSERT',
            ResourceRecordSet: {
              Name: config.domainName,
              Type: 'A',
              SetIdentifier: region,
              Weight: 100,
              TTL: 60,
              ResourceRecords: [
                {
                  Value: await this.getRegionIPAddress(region),
                },
              ],
            },
          },
        ],
      }

      const command = new ChangeResourceRecordSetsCommand({
        HostedZoneId: config.hostedZoneId,
        ChangeBatch: changeBatch,
      })

      await this.route53Client.send(command)

      this.logger.info('Route 53 records updated', { region })
    } catch (error) {
      this.logger.error('Failed to update Route 53 records', { region, error })
      throw error
    }
  }

  /**
   * Update Cloudflare records
   */
  private async updateCloudflareRecords(
    region: string,
    config: any,
  ): Promise<void> {
    try {
      // This would typically use Cloudflare API
      // For now, log the action
      this.logger.info(`Updating Cloudflare records for ${region}`)

      // Simulate API call
      await this.invokeLambdaFunction('update-cloudflare-dns', {
        zoneId: config.cloudflareZoneId,
        region,
        domain: config.domainName,
      })
    } catch (error) {
      this.logger.error('Failed to update Cloudflare records', {
        region,
        error,
      })
      throw error
    }
  }

  /**
   * Get region IP address
   */
  private async getRegionIPAddress(region: string): Promise<string> {
    try {
      // This would typically get the IP address of the load balancer or application
      // For now, return a mock IP
      const mockIPs: { [key: string]: string } = {
        'us-east-1': '52.86.123.45',
        'us-west-2': '54.68.234.56',
        'eu-central-1': '18.158.345.67',
        'ap-southeast-1': '13.228.456.78',
      }

      return mockIPs[region] || '127.0.0.1'
    } catch (error) {
      this.logger.error(`Failed to get IP address for ${region}`, { error })
      throw error
    }
  }

  /**
   * Update load balancer configuration
   */
  private async updateLoadBalancer(region: string): Promise<void> {
    try {
      this.logger.info('Updating load balancer configuration', { region })

      // Update ALB/NLB configuration
      await this.updateApplicationLoadBalancer(region)

      // Update CDN configuration if applicable
      await this.updateCDNConfiguration(region)

      this.logger.info('Load balancer configuration updated', { region })
    } catch (error) {
      this.logger.error('Failed to update load balancer configuration', {
        region,
        error,
      })
      throw error
    }
  }

  /**
   * Update application load balancer
   */
  private async updateApplicationLoadBalancer(region: string): Promise<void> {
    try {
      this.logger.info(`Updating application load balancer for ${region}`)

      // This would typically update ALB target groups, health checks, etc.
      await this.invokeLambdaFunction('update-alb-configuration', { region })
    } catch (error) {
      this.logger.error(`Failed to update ALB for ${region}`, { error })
      throw error
    }
  }

  /**
   * Update CDN configuration
   */
  private async updateCDNConfiguration(region: string): Promise<void> {
    try {
      this.logger.info(`Updating CDN configuration for ${region}`)

      // This would typically update CloudFront, Cloudflare, etc.
      await this.invokeLambdaFunction('update-cdn-configuration', { region })
    } catch (error) {
      this.logger.error(`Failed to update CDN for ${region}`, { error })
      // Non-critical, continue with failover
    }
  }

  /**
   * Promote backup region to primary
   */
  private async promoteBackupRegion(region: string): Promise<void> {
    try {
      this.logger.info('Promoting backup region to primary', { region })

      // Update region configuration
      await this.updateRegionConfiguration(region, 'primary')

      // Update database connections
      await this.updateDatabaseConnections(region)

      // Update cache configuration
      await this.updateCacheConfiguration(region)

      this.logger.info('Backup region promoted to primary', { region })
    } catch (error) {
      this.logger.error('Failed to promote backup region', { region, error })
      throw error
    }
  }

  /**
   * Update region configuration
   */
  private async updateRegionConfiguration(
    region: string,
    role: 'primary' | 'backup',
  ): Promise<void> {
    try {
      this.logger.info(`Updating region configuration for ${region} to ${role}`)

      // Update configuration in parameter store, secrets manager, etc.
      await this.invokeLambdaFunction('update-region-config', { region, role })
    } catch (error) {
      this.logger.error(`Failed to update region config for ${region}`, {
        error,
      })
      throw error
    }
  }

  /**
   * Update database connections
   */
  private async updateDatabaseConnections(region: string): Promise<void> {
    try {
      this.logger.info(`Updating database connections for ${region}`)

      // Update read/write splitting, connection pools, etc.
      await this.invokeLambdaFunction('update-db-connections', { region })
    } catch (error) {
      this.logger.error(`Failed to update database connections for ${region}`, {
        error,
      })
      throw error
    }
  }

  /**
   * Update cache configuration
   */
  private async updateCacheConfiguration(region: string): Promise<void> {
    try {
      this.logger.info(`Updating cache configuration for ${region}`)

      // Update Redis cluster configuration, cache invalidation, etc.
      await this.invokeLambdaFunction('update-cache-config', { region })
    } catch (error) {
      this.logger.error(`Failed to update cache configuration for ${region}`, {
        error,
      })
      throw error
    }
  }

  /**
   * Update configuration
   */
  private async updateConfiguration(region: string): Promise<void> {
    try {
      this.logger.info('Updating system configuration', { region })

      // Update application configuration
      await this.updateApplicationConfiguration(region)

      // Update infrastructure configuration
      await this.updateInfrastructureConfiguration(region)

      this.logger.info('Configuration updated', { region })
    } catch (error) {
      this.logger.error('Failed to update configuration', { region, error })
      throw error
    }
  }

  /**
   * Update application configuration
   */
  private async updateApplicationConfiguration(region: string): Promise<void> {
    try {
      this.logger.info(`Updating application configuration for ${region}`)

      // Update feature flags, service endpoints, etc.
      await this.invokeLambdaFunction('update-app-config', { region })
    } catch (error) {
      this.logger.error(`Failed to update application config for ${region}`, {
        error,
      })
      throw error
    }
  }

  /**
   * Update infrastructure configuration
   */
  private async updateInfrastructureConfiguration(
    region: string,
  ): Promise<void> {
    try {
      this.logger.info(`Updating infrastructure configuration for ${region}`)

      // Update auto-scaling policies, resource limits, etc.
      await this.invokeLambdaFunction('update-infra-config', { region })
    } catch (error) {
      this.logger.error(
        `Failed to update infrastructure config for ${region}`,
        { error },
      )
      throw error
    }
  }

  /**
   * Verify failover success
   */
  private async verifyFailoverSuccess(region: string): Promise<void> {
    try {
      this.logger.info('Verifying failover success', { region })

      const maxWaitTime = 5 * 60 * 1000 // 5 minutes
      const checkInterval = 10000 // 10 seconds
      const startTime = Date.now()

      while (Date.now() - startTime < maxWaitTime) {
        const isHealthy = await this.checkRegionHealth(region)

        if (isHealthy) {
          this.logger.info('Failover verification successful', { region })
          return
        }

        this.logger.info('Waiting for region to become healthy', { region })
        await this.sleep(checkInterval)
      }

      throw new Error(`Failover verification timeout for region ${region}`)
    } catch (error) {
      this.logger.error('Failover verification failed', { region, error })
      throw error
    }
  }

  /**
   * Monitor backup regions
   */
  private async monitorBackupRegions(): Promise<void> {
    try {
      for (const region of this.backupRegions) {
        const health = await this.healthMonitor.getRegionHealth(region)

        if (health.status === 'unhealthy') {
          this.logger.warn('Backup region unhealthy', {
            region,
            reason: health.message,
          })

          // Try to recover the region
          await this.attemptRegionRecovery(region)
        }
      }
    } catch (error) {
      this.logger.error('Backup region monitoring failed', { error })
    }
  }

  /**
   * Attempt to recover an unhealthy region
   */
  private async attemptRegionRecovery(region: string): Promise<void> {
    try {
      this.logger.info('Attempting region recovery', { region })

      // Reset circuit breaker
      const breaker = this.circuitBreakers.get(region)
      if (breaker) {
        breaker.reset()
      }

      // Try to restart services
      await this.restartRegionServices(region)

      this.logger.info('Region recovery attempt completed', { region })
    } catch (error) {
      this.logger.error('Region recovery failed', { region, error })
    }
  }

  /**
   * Restart region services
   */
  private async restartRegionServices(region: string): Promise<void> {
    try {
      this.logger.info(`Restarting services in ${region}`)

      // Restart application services
      await this.invokeLambdaFunction('restart-app-services', { region })

      // Restart database connections
      await this.invokeLambdaFunction('restart-db-connections', { region })

      // Clear caches
      await this.invokeLambdaFunction('clear-region-caches', { region })
    } catch (error) {
      this.logger.error(`Failed to restart services in ${region}`, { error })
      throw error
    }
  }

  /**
   * Send health metrics to CloudWatch
   */
  private async sendHealthMetrics(): Promise<void> {
    try {
      const metrics = [
        {
          MetricName: 'FailoverStatus',
          Value: this.failoverState.status === 'healthy' ? 1 : 0,
          Unit: 'Count',
          Dimensions: [
            { Name: 'Region', Value: this.currentPrimaryRegion },
            { Name: 'Environment', Value: this.config.getEnvironment() },
          ],
        },
        {
          MetricName: 'FailoverCount',
          Value: this.failoverState.failoverCount,
          Unit: 'Count',
          Dimensions: [
            { Name: 'Region', Value: this.currentPrimaryRegion },
            { Name: 'Environment', Value: this.config.getEnvironment() },
          ],
        },
      ]

      const command = new PutMetricDataCommand({
        Namespace: 'Pixelated/MultiRegion',
        MetricData: metrics,
      })

      await this.cloudWatchClient.send(command)
    } catch (error) {
      this.logger.error('Failed to send health metrics', { error })
    }
  }

  /**
   * Send failover notifications
   */
  private async sendFailoverNotifications(
    status: 'success' | 'failed',
    region: string,
    error?: string,
  ): Promise<void> {
    try {
      const message = {
        event: 'failover',
        status,
        region,
        timestamp: new Date().toISOString(),
        error,
        failoverState: this.failoverState,
      }

      // Send SNS notification
      await this.sendSNSNotification(message)

      // Send to SQS for further processing
      await this.sendSQSMessage(message)

      this.logger.info('Failover notifications sent', { status, region })
    } catch (error) {
      this.logger.error('Failed to send failover notifications', { error })
    }
  }

  /**
   * Send SNS notification
   */
  private async sendSNSNotification(message: any): Promise<void> {
    try {
      const topicArn = this.config.getFailoverConfig().snsTopicArn
      if (!topicArn) return

      const command = new PublishCommand({
        TopicArn: topicArn,
        Message: JSON.stringify(message),
        Subject: `Multi-Region Failover ${message.status.toUpperCase()}`,
      })

      await this.snsClient.send(command)
    } catch (error) {
      this.logger.error('Failed to send SNS notification', { error })
    }
  }

  /**
   * Send SQS message
   */
  private async sendSQSMessage(message: any): Promise<void> {
    try {
      const queueUrl = this.config.getFailoverConfig().sqsQueueUrl
      if (!queueUrl) return

      const command = new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(message),
        MessageAttributes: {
          eventType: { DataType: 'String', StringValue: 'failover' },
          status: { DataType: 'String', StringValue: message.status },
        },
      })

      await this.sqsClient.send(command)
    } catch (error) {
      this.logger.error('Failed to send SQS message', { error })
    }
  }

  /**
   * Invoke Lambda function
   */
  private async invokeLambdaFunction(
    functionName: string,
    payload: any,
  ): Promise<any> {
    try {
      const command = new InvokeCommand({
        FunctionName: functionName,
        Payload: JSON.stringify(payload),
        InvocationType: 'RequestResponse',
      })

      const response = await this.lambdaClient.send(command)

      if (response.FunctionError) {
        throw new Error(`Lambda function error: ${response.FunctionError}`)
      }

      if (response.Payload) {
        return JSON.parse(new TextDecoder().decode(response.Payload))
      }

      return null
    } catch (error) {
      this.logger.error(`Failed to invoke Lambda function ${functionName}`, {
        error,
      })
      throw error
    }
  }

  /**
   * Register event handlers
   */
  private registerEventHandlers(): void {
    this.healthMonitor.on('healthStatusChanged', async (data) => {
      if (
        data.region === this.currentPrimaryRegion &&
        data.status === 'unhealthy'
      ) {
        this.logger.warn(
          'Primary region health status changed to unhealthy',
          data,
        )
        await this.evaluateFailover()
      }
    })

    this.on('failoverStarted', (data) => {
      this.logger.info('Failover started event received', data)
    })

    this.on('failoverCompleted', (data) => {
      this.logger.info('Failover completed event received', data)
    })

    this.on('failoverFailed', (data) => {
      this.logger.error('Failover failed event received', data)
    })
  }

  /**
   * Load failover state from persistent storage
   */
  private async loadFailoverState(): Promise<void> {
    try {
      // This would typically load from DynamoDB, S3, or Parameter Store
      // For now, use in-memory state
      this.logger.info('Failover state loaded (using in-memory state)')
    } catch (error) {
      this.logger.error('Failed to load failover state', { error })
      // Continue with default state
    }
  }

  /**
   * Save failover state to persistent storage
   */
  private async saveFailoverState(): Promise<void> {
    try {
      // This would typically save to DynamoDB, S3, or Parameter Store
      // For now, log the state
      this.logger.info('Failover state saved (using in-memory state)', {
        state: this.failoverState,
      })
    } catch (error) {
      this.logger.error('Failed to save failover state', { error })
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Get current failover state
   */
  getFailoverState(): FailoverState {
    return { ...this.failoverState }
  }

  /**
   * Get failover history
   */
  getFailoverHistory(): FailoverEvent[] {
    return [...this.failoverHistory]
  }

  /**
   * Get current primary region
   */
  getCurrentPrimaryRegion(): string {
    return this.currentPrimaryRegion
  }

  /**
   * Manually trigger failover (for testing/emergencies)
   */
  async manualFailover(targetRegion: string, reason: string): Promise<void> {
    try {
      this.logger.info('Manual failover requested', { targetRegion, reason })

      if (targetRegion === this.currentPrimaryRegion) {
        throw new Error('Cannot failover to current primary region')
      }

      if (!this.backupRegions.includes(targetRegion)) {
        throw new Error('Target region is not a backup region')
      }

      await this.triggerFailover(targetRegion, `Manual failover: ${reason}`)
    } catch (error) {
      this.logger.error('Manual failover failed', { error })
      throw error
    }
  }

  /**
   * Shutdown the failover orchestrator
   */
  async shutdown(): Promise<void> {
    try {
      this.logger.info('Shutting down AutomatedFailoverOrchestrator...')

      this.isActive = false

      // Clear intervals
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval)
        this.healthCheckInterval = null
      }

      if (this.failoverTimeout) {
        clearTimeout(this.failoverTimeout)
        this.failoverTimeout = null
      }

      // Save final state
      await this.saveFailoverState()

      this.logger.info('AutomatedFailoverOrchestrator shutdown completed')

      this.emit('shutdown')
    } catch (error) {
      this.logger.error('Error during shutdown', { error })
      throw error
    }
  }
}

/**
 * Circuit Breaker implementation
 */
class CircuitBreaker {
  private name: string
  private failureThreshold: number
  private resetTimeout: number
  private monitoringPeriod: number
  private onStateChange?: (state: string) => void

  private state: 'closed' | 'open' | 'half-open' = 'closed'
  private failures = 0
  private lastFailureTime = 0
  private successCount = 0

  constructor(config: CircuitBreakerConfig) {
    this.name = config.name
    this.failureThreshold = config.failureThreshold
    this.resetTimeout = config.resetTimeout
    this.monitoringPeriod = config.monitoringPeriod
    this.onStateChange = config.onStateChange
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'half-open'
        this.onStateChange?.(this.state)
      } else {
        throw new Error(`Circuit breaker ${this.name} is open`)
      }
    }

    try {
      const result = await operation()

      if (this.state === 'half-open') {
        this.successCount++
        if (this.successCount >= 3) {
          // Require 3 successful calls to close
          this.state = 'closed'
          this.failures = 0
          this.successCount = 0
          this.onStateChange?.(this.state)
        }
      }

      return result
    } catch (error) {
      this.recordFailure()
      throw error
    }
  }

  private recordFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()

    if (this.failures >= this.failureThreshold) {
      this.state = 'open'
      this.onStateChange?.(this.state)
    }
  }

  isOpen(): boolean {
    return this.state === 'open'
  }

  reset(): void {
    this.state = 'closed'
    this.failures = 0
    this.successCount = 0
    this.lastFailureTime = 0
    this.onStateChange?.(this.state)
  }

  getState(): string {
    return this.state
  }
}

// Types
interface FailoverState {
  status: 'healthy' | 'failing_over' | 'degraded'
  primaryRegion: string
  backupRegion: string | null
  lastFailover: Date | null
  failoverCount: number
  reason: string | null
}

interface FailoverEvent {
  id: string
  timestamp: Date
  fromRegion: string
  toRegion: string
  status: 'started' | 'completed' | 'failed'
  reason: string
  duration?: number
  error?: string
}

interface CircuitBreakerConfig {
  name: string
  failureThreshold: number
  resetTimeout: number
  monitoringPeriod: number
  onStateChange?: (state: string) => void
}

interface RegionMetrics {
  cpuUtilization: number
  memoryUtilization: number
  networkLatency: number
  activeConnections: number
}

export { FailoverState, FailoverEvent, CircuitBreakerConfig, RegionMetrics }
