/**
 * Edge Computing Manager
 *
 * Manages deployment and orchestration of edge computing nodes across
 * 50+ global locations with Cloudflare Workers, AWS Lambda@Edge, and
 * containerized edge services.
 */

import { EventEmitter } from 'events'

import { createBuildSafeLogger } from '../../logging/build-safe-logger'

import type {
  EdgeLocation,
  EdgeDeploymentConfig,
  EdgeNodeStatus,
} from './EdgeComputingManager.types'
import { DEFAULT_EDGE_LOCATIONS } from './EdgeComputingManager.locations'
import {
  generateWorkerScript,
  generateLambdaFunction,
  generateAzureFunction,
  generateGCPFunction,
} from './EdgeComputingManager.codegen'

// Re-export types for backward compatibility — index.ts and ConfigurationManager.ts import from here
export type { EdgeLocation, EdgeDeploymentConfig, EdgeNodeStatus }

const logger = createBuildSafeLogger('EdgeComputingManager')

export class EdgeComputingManager extends EventEmitter {
  private readonly config: EdgeDeploymentConfig
  private readonly edgeNodes: Map<string, EdgeNodeStatus> = new Map()
  private healthCheckInterval: NodeJS.Timeout | null = null
  private isInitialized = false

  // Predefined edge locations covering 50+ global locations
  private readonly DEFAULT_EDGE_LOCATIONS: EdgeLocation[] = DEFAULT_EDGE_LOCATIONS

  constructor(config: EdgeDeploymentConfig) {
    super()
    this.config = {
      ...config,
      locations:
        config.locations.length > 0
          ? config.locations
          : this.DEFAULT_EDGE_LOCATIONS,
    }
  }

  /**
   * Initialize edge computing manager
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Edge Computing Manager', {
        locations: this.config.locations.length,
      })

      // Initialize edge node statuses
      this.initializeEdgeNodeStatuses()

      // Start health monitoring
      this.startHealthMonitoring()

      this.isInitialized = true
      logger.info('Edge Computing Manager initialized successfully')

      this.emit('initialized', { locations: this.config.locations.length })
    } catch (error: unknown) {
      logger.error('Failed to initialize Edge Computing Manager', { error })
      throw new Error(`Initialization failed: ${(error as Error).message}`, {
        cause: error,
      })
    }
  }

  /**
   * Initialize edge node statuses
   */
  private initializeEdgeNodeStatuses(): void {
    for (const location of this.config.locations) {
      this.edgeNodes.set(location.id, {
        locationId: location.id,
        status: 'deploying',
        lastHealthCheck: new Date(),
        responseTime: 0,
        errorRate: 0,
        throughput: 0,
        activeConnections: 0,
        cacheHitRate: 0,
        aiModelStatus: location.aiModels.map((model) => ({
          model,
          loaded: false,
          inferenceTime: 0,
          accuracy: 0,
        })),
        metadata: {},
      })
    }
  }

  /**
   * Deploy edge nodes to all configured locations
   */
  async deployAllEdgeNodes(): Promise<EdgeNodeStatus[]> {
    if (!this.isInitialized) {
      throw new Error('Edge computing manager not initialized')
    }

    try {
      logger.info('Deploying edge nodes to all locations', {
        totalLocations: this.config.locations.length,
      })

      const deploymentPromises = this.config.locations.map(async (location) =>
        this.deployEdgeNode(location),
      )

      const results = await Promise.allSettled(deploymentPromises)

      const statuses: EdgeNodeStatus[] = []
      results.forEach((result, index) => {
        const location = this.config.locations[index]
        if (result.status === 'fulfilled') {
          statuses.push(result.value)
        } else {
          const failedStatus: EdgeNodeStatus = {
            locationId: location.id,
            status: 'failed',
            lastHealthCheck: new Date(),
            responseTime: 0,
            errorRate: 1,
            throughput: 0,
            activeConnections: 0,
            cacheHitRate: 0,
            aiModelStatus: location.aiModels.map((model) => ({
              model,
              loaded: false,
              inferenceTime: 0,
              accuracy: 0,
            })),
            metadata: { error: result.reason.message },
          }
          statuses.push(failedStatus)
          this.edgeNodes.set(location.id, failedStatus)
        }
      })

      this.emit('deployment-complete', { statuses })
      return statuses
    } catch (error: unknown) {
      logger.error('Edge node deployment failed', { error })
      throw new Error(`Deployment failed: ${(error as Error).message}`, {
        cause: error,
      })
    }
  }

  /**
   * Deploy edge node to specific location
   */
  private async deployEdgeNode(
    location: EdgeLocation,
  ): Promise<EdgeNodeStatus> {
    const startTime = Date.now()

    try {
      logger.info(`Deploying edge node to location: ${location.name}`, {
        location: location.id,
        provider: location.provider,
      })

      // Deploy based on provider
      let deploymentResult: unknown

      switch (location.provider) {
        case 'cloudflare':
          deploymentResult = await this.deployCloudflareWorker(location)
          break
        case 'aws':
          deploymentResult = await this.deployAWSLambdaEdge(location)
          break
        case 'azure':
          deploymentResult = await this.deployAzureEdge(location)
          break
        case 'gcp':
          deploymentResult = await this.deployGCPEdge(location)
          break
        default:
          throw new Error(
            `Unsupported edge provider: ${location.provider as string}`,
          )
      }

      // Create successful status
      const status: EdgeNodeStatus = {
        locationId: location.id,
        status: 'healthy',
        lastHealthCheck: new Date(),
        responseTime: 50, // Initial estimate
        errorRate: 0,
        throughput: 1000, // Initial estimate
        activeConnections: 0,
        cacheHitRate: 0.95, // Initial estimate
        aiModelStatus: location.aiModels.map((model) => ({
          model,
          loaded: true,
          inferenceTime: 25, // Initial estimate
          accuracy: 0.98, // Initial estimate
        })),
        metadata: {
          deploymentTime: Date.now() - startTime,
          provider: location.provider,
          ...(deploymentResult as Record<string, unknown>),
        },
      }

      this.edgeNodes.set(location.id, status)

      logger.info(`Edge node deployment completed: ${location.name}`, {
        location: location.id,
        duration: Date.now() - startTime,
      })

      this.emit('node-deployed', { location: location.id, status })
      return status
    } catch (error: unknown) {
      logger.error(`Edge node deployment failed: ${location.name}`, {
        location: location.id,
        error,
      })

      const failedStatus: EdgeNodeStatus = {
        locationId: location.id,
        status: 'failed',
        lastHealthCheck: new Date(),
        responseTime: 0,
        errorRate: 1,
        throughput: 0,
        activeConnections: 0,
        cacheHitRate: 0,
        aiModelStatus: location.aiModels.map((model) => ({
          model,
          loaded: false,
          inferenceTime: 0,
          accuracy: 0,
        })),
        metadata: { error: (error as Error).message },
      }

      this.edgeNodes.set(location.id, failedStatus)
      this.emit('node-deployment-failed', {
        location: location.id,
        error: (error as Error).message,
      })

      throw error
    }
  }

  /**
   * Deploy Cloudflare Worker
   */
  private async deployCloudflareWorker(
    location: EdgeLocation,
  ): Promise<{ workerId: string; scriptSize: number }> {
    try {
      logger.info(`Deploying Cloudflare Worker for location: ${location.name}`)

      // Cloudflare Worker deployment logic
      const workerScript = generateWorkerScript(location)

      // Simulate API call to Cloudflare
      await this.simulateCloudflareDeployment(location, workerScript)

      logger.info(`Cloudflare Worker deployed successfully: ${location.name}`)
      return {
        workerId: `worker-${location.id}`,
        scriptSize: workerScript.length,
      }
    } catch (error: unknown) {
      logger.error(`Cloudflare Worker deployment failed: ${location.name}`, {
        error,
      })
      throw new Error(
        `Cloudflare deployment failed: ${(error as Error).message}`,
        {
          cause: error,
        },
      )
    }
  }

  /**
   * Deploy AWS Lambda@Edge
   */
  private async deployAWSLambdaEdge(
    location: EdgeLocation,
  ): Promise<{ functionArn: string; version: string }> {
    try {
      logger.info(`Deploying AWS Lambda@Edge for location: ${location.name}`)

      // AWS Lambda@Edge deployment logic
      const lambdaFunction = generateLambdaFunction(location)

      // Simulate API call to AWS
      await this.simulateAWSLambdaDeployment(location, lambdaFunction)

      logger.info(`AWS Lambda@Edge deployed successfully: ${location.name}`)
      return {
        functionArn: `arn:aws:lambda:${location.region}:function:edge-${location.id}`,
        version: '1.0',
      }
    } catch (error: unknown) {
      logger.error(`AWS Lambda@Edge deployment failed: ${location.name}`, {
        error,
      })
      throw new Error(
        `AWS Lambda deployment failed: ${(error as Error).message}`,
        {
          cause: error,
        },
      )
    }
  }

  /**
   * Deploy Azure Edge
   */
  private async deployAzureEdge(
    location: EdgeLocation,
  ): Promise<{ functionId: string; region: string }> {
    try {
      logger.info(`Deploying Azure Edge for location: ${location.name}`)

      // Azure Edge deployment logic
      const edgeFunction = generateAzureFunction(location)

      // Simulate API call to Azure
      await this.simulateAzureDeployment(location, edgeFunction)

      logger.info(`Azure Edge deployed successfully: ${location.name}`)
      return { functionId: `function-${location.id}`, region: location.region }
    } catch (error: unknown) {
      logger.error(`Azure Edge deployment failed: ${location.name}`, { error })
      throw new Error(
        `Azure Edge deployment failed: ${(error as Error).message}`,
        {
          cause: error,
        },
      )
    }
  }

  /**
   * Deploy GCP Edge
   */
  private async deployGCPEdge(
    location: EdgeLocation,
  ): Promise<{ functionName: string; region: string }> {
    try {
      logger.info(`Deploying GCP Edge for location: ${location.name}`)

      // GCP Edge deployment logic
      const edgeFunction = generateGCPFunction(location)

      // Simulate API call to GCP
      await this.simulateGCPDeployment(location, edgeFunction)

      logger.info(`GCP Edge deployed successfully: ${location.name}`)
      return { functionName: `edge-${location.id}`, region: location.region }
    } catch (error: unknown) {
      logger.error(`GCP Edge deployment failed: ${location.name}`, { error })
      throw new Error(
        `GCP Edge deployment failed: ${(error as Error).message}`,
        {
          cause: error,
        },
      )
    }
  }

  // === Simulation methods ===

  private async simulateCloudflareDeployment(
    location: EdgeLocation,
    _script: string,
  ): Promise<void> {
    // Simulate API delay
    await new Promise((resolve) =>
      setTimeout(resolve, 1000 + Math.random() * 2000),
    )

    // Simulate occasional failures (5% failure rate)
    if (Math.random() < 0.05) {
      throw new Error(`Cloudflare API error for ${location.name}`)
    }

    logger.info(`Simulated Cloudflare deployment for: ${location.name}`)
  }

  private async simulateAWSLambdaDeployment(
    location: EdgeLocation,
    _functionCode: string,
  ): Promise<void> {
    // Simulate API delay
    await new Promise((resolve) =>
      setTimeout(resolve, 1500 + Math.random() * 2500),
    )

    // Simulate occasional failures (3% failure rate)
    if (Math.random() < 0.03) {
      throw new Error(`AWS Lambda API error for ${location.name}`)
    }

    logger.info(`Simulated AWS Lambda deployment for: ${location.name}`)
  }

  private async simulateAzureDeployment(
    location: EdgeLocation,
    _functionCode: string,
  ): Promise<void> {
    // Simulate API delay
    await new Promise((resolve) =>
      setTimeout(resolve, 1200 + Math.random() * 2000),
    )

    // Simulate occasional failures (4% failure rate)
    if (Math.random() < 0.04) {
      throw new Error(`Azure API error for ${location.name}`)
    }

    logger.info(`Simulated Azure deployment for: ${location.name}`)
  }

  private async simulateGCPDeployment(
    location: EdgeLocation,
    _functionCode: string,
  ): Promise<void> {
    // Simulate API delay
    await new Promise((resolve) =>
      setTimeout(resolve, 1300 + Math.random() * 2200),
    )

    // Simulate occasional failures (3.5% failure rate)
    if (Math.random() < 0.035) {
      throw new Error(`GCP API error for ${location.name}`)
    }

    logger.info(`Simulated GCP deployment for: ${location.name}`)
  }

  // === Health monitoring ===

  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }

    this.healthCheckInterval = setInterval(() => {
      void this.performHealthChecks()
    }, this.config.healthCheck.interval)

    logger.info('Edge node health monitoring started', {
      interval: this.config.healthCheck.interval,
    })
  }

  private async performHealthChecks(): Promise<void> {
    try {
      const healthCheckPromises = Array.from(this.edgeNodes.entries()).map(
        async ([locationId, status]) =>
          this.performHealthCheck(locationId, status),
      )

      await Promise.allSettled(healthCheckPromises)
    } catch (error: unknown) {
      logger.error('Health check cycle failed', { error })
    }
  }

  private async performHealthCheck(
    locationId: string,
    currentStatus: EdgeNodeStatus,
  ): Promise<void> {
    try {
      const location = this.config.locations.find(
        (loc) => loc.id === locationId,
      )
      if (!location) {
        logger.warn(`Location not found for health check: ${locationId}`)
        return
      }

      // Simulate health check
      const startTime = Date.now()

      // Simulate network latency
      await new Promise((resolve) =>
        setTimeout(resolve, location.network.latency),
      )

      const responseTime = Date.now() - startTime

      // Simulate occasional failures based on network conditions
      const isHealthy = Math.random() > location.network.latency / 1000 // Higher latency = higher failure chance

      // Update status
      const newStatus: EdgeNodeStatus = {
        ...currentStatus,
        lastHealthCheck: new Date(),
        responseTime,
        errorRate: isHealthy ? Math.random() * 0.01 : Math.random() * 0.1 + 0.1,
        throughput: isHealthy ? 800 + Math.random() * 400 : Math.random() * 200,
        activeConnections: Math.floor(Math.random() * 1000),
        cacheHitRate: 0.9 + Math.random() * 0.09,
        status: isHealthy ? 'healthy' : 'degraded',
        aiModelStatus: currentStatus.aiModelStatus.map((model) => ({
          ...model,
          inferenceTime: isHealthy
            ? 20 + Math.random() * 30
            : 100 + Math.random() * 200,
          accuracy: isHealthy
            ? 0.95 + Math.random() * 0.04
            : 0.8 + Math.random() * 0.15,
        })),
      }

      this.edgeNodes.set(locationId, newStatus)

      // Emit health status events
      if (!isHealthy && currentStatus.status === 'healthy') {
        this.emit('node-degraded', { locationId, responseTime })
      } else if (isHealthy && currentStatus.status !== 'healthy') {
        this.emit('node-recovered', { locationId, responseTime })
      }
    } catch (error: unknown) {
      logger.error(`Health check failed for location: ${locationId}`, { error })

      // Update status to failed
      const failedStatus: EdgeNodeStatus = {
        ...currentStatus,
        status: 'failed',
        lastHealthCheck: new Date(),

        errorRate: 1,
        metadata: {
          ...currentStatus.metadata,
          error: (error as Error).message,
        },
      }

      this.edgeNodes.set(locationId, failedStatus)
      this.emit('node-failed', { locationId, error: (error as Error).message })
    }
  }

  // === Public API ===

  /**
   * Get optimal edge node for user location
   */
  getOptimalEdgeNode(
    userLatitude: number,
    userLongitude: number,
  ): EdgeLocation | null {
    try {
      let optimalLocation: EdgeLocation | null = null
      let minDistance = Infinity

      for (const location of this.config.locations) {
        const distance = this.calculateDistance(
          userLatitude,
          userLongitude,
          location.coordinates.latitude,
          location.coordinates.longitude,
        )

        const status = this.edgeNodes.get(location.id)
        if (status?.status === 'healthy' && distance < minDistance) {
          minDistance = distance
          optimalLocation = location
        }
      }

      return optimalLocation
    } catch (error: unknown) {
      logger.error('Failed to find optimal edge node', { error })
      return null
    }
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371 // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1)
    const dLon = this.toRadians(lon2 - lon1)

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180)
  }

  /**
   * Get all edge node statuses
   */
  getAllNodeStatuses(): EdgeNodeStatus[] {
    return Array.from(this.edgeNodes.values())
  }

  /**
   * Get edge node status by location ID
   */
  getNodeStatus(locationId: string): EdgeNodeStatus | undefined {
    return this.edgeNodes.get(locationId)
  }

  /**
   * Get edge locations by region
   */
  getLocationsByRegion(region: string): EdgeLocation[] {
    return this.config.locations.filter((loc) => loc.region === region)
  }

  /**
   * Get edge locations by provider
   */
  getLocationsByProvider(provider: string): EdgeLocation[] {
    return this.config.locations.filter((loc) => loc.provider === provider)
  }

  /**
   * Get healthy edge nodes
   */
  getHealthyNodes(): EdgeNodeStatus[] {
    return Array.from(this.edgeNodes.values()).filter(
      (status) => status.status === 'healthy',
    )
  }

  /**
   * Get edge node statistics
   */
  getNodeStatistics(): {
    total: number
    healthy: number
    degraded: number
    failed: number
    deploying: number
    averageResponseTime: number
    averageCacheHitRate: number
  } {
    const statuses = Array.from(this.edgeNodes.values())

    const stats = {
      total: statuses.length,
      healthy: statuses.filter((s) => s.status === 'healthy').length,
      degraded: statuses.filter((s) => s.status === 'degraded').length,
      failed: statuses.filter((s) => s.status === 'failed').length,
      deploying: statuses.filter((s) => s.status === 'deploying').length,
      averageResponseTime: 0,
      averageCacheHitRate: 0,
    }

    if (stats.total > 0) {
      stats.averageResponseTime =
        statuses.reduce((sum, s) => sum + s.responseTime, 0) / stats.total
      stats.averageCacheHitRate =
        statuses.reduce((sum, s) => sum + s.cacheHitRate, 0) / stats.total
    }

    return stats
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      logger.info('Cleaning up Edge Computing Manager')

      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval)
        this.healthCheckInterval = null
      }

      this.edgeNodes.clear()
      this.isInitialized = false

      logger.info('Edge Computing Manager cleanup completed')
    } catch (error: unknown) {
      logger.error('Edge computing cleanup failed', { error })
      throw error
    }
  }
}

export default EdgeComputingManager
