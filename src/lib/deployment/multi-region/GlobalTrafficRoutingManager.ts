/**
 * Global Traffic Routing Manager
 *
 * Manages intelligent traffic routing across multiple regions with
 * latency optimization, health-based routing, and compliance-aware
 * traffic distribution.
 */

import { EventEmitter } from 'events'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const logger = createBuildSafeLogger('GlobalTrafficRoutingManager')

import { RegionConfig } from './MultiRegionDeploymentManager'

export interface RoutingConfig {
  strategy:
  | 'latency-based'
  | 'health-based'
  | 'compliance-based'
  | 'weighted-round-robin'
  healthThreshold: number
  latencyThreshold: number
  complianceRequirements: string[]
  weights: Record<string, number>
  fallbackRegions: string[]
  cacheTtl: number
}

export interface RouteTarget {
  regionId: string
  endpoint: string
  priority: number
  healthScore: number
  latency: number
  complianceStatus: boolean
  capacity: number
  currentLoad: number
}

export interface RoutingDecision {
  target: RouteTarget
  reason: string
  latency: number
  healthScore: number
  compliance: string[]
  timestamp: Date
}

export interface TrafficMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageLatency: number
  p50Latency: number
  p95Latency: number
  p99Latency: number
  requestsByRegion: Record<string, number>
  errorRateByRegion: Record<string, number>
}

export class GlobalTrafficRoutingManager extends EventEmitter {
  private config: RoutingConfig
  private routeTargets: Map<string, RouteTarget> = new Map()
  private routingCache: Map<string, RoutingDecision> = new Map()
  private metrics: TrafficMetrics
  private isInitialized = false
  private metricsInterval: NodeJS.Timeout | null = null

  constructor(config: RoutingConfig) {
    super()
    this.config = config
    this.metrics = this.initializeMetrics()
  }

  /**
   * Initialize the traffic routing manager
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Global Traffic Routing Manager', {
        strategy: this.config.strategy,
        regions: this.routeTargets.size,
      })

      // Initialize route targets
      await this.initializeRouteTargets()

      // Start metrics collection
      this.startMetricsCollection()

      this.isInitialized = true
      logger.info('Global Traffic Routing Manager initialized successfully')

      this.emit('initialized', { strategy: this.config.strategy })
    } catch (error) {
      logger.error('Failed to initialize Global Traffic Routing Manager', {
        error,
      })
      throw new Error(`Initialization failed: ${error.message}`, {
        cause: error,
      })
    }
  }

  /**
   * Initialize route targets from configuration
   */
  private async initializeRouteTargets(): Promise<void> {
    try {
      // This would typically load from configuration or service discovery
      const regions = this.loadRegionConfiguration()

      for (const region of regions) {
        const target: RouteTarget = {
          regionId: region.id,
          endpoint: `https://api-${region.id}.pixelated.com`,
          priority: region.priority,
          healthScore: 100,
          latency: 50,
          complianceStatus: true,
          capacity: region.capacity.maxInstances,
          currentLoad: 0,
        }

        this.routeTargets.set(region.id, target)
      }

      logger.info(`Initialized ${this.routeTargets.size} route targets`)
    } catch (error) {
      logger.error('Failed to initialize route targets', { error })
      throw error
    }
  }

  /**
   * Load region configuration
   */
  private loadRegionConfiguration(): RegionConfig[] {
    // This would typically come from configuration management
    return [
      {
        id: 'us-east-1',
        name: 'US East (N. Virginia)',
        provider: 'aws',
        location: 'us-east',
        availabilityZones: ['us-east-1a', 'us-east-1b', 'us-east-1c'],
        priority: 1,
        complianceRequirements: ['SOC2', 'HIPAA'],
        capacity: {
          minInstances: 2,
          maxInstances: 20,
          desiredInstances: 10,
        },
        networking: {
          vpcCidr: '10.1.0.0/16',
          subnetCidrs: ['10.1.1.0/24', '10.1.2.0/24', '10.1.3.0/24'],
          securityGroups: ['sg-12345'],
        },
      },
      {
        id: 'eu-central-1',
        name: 'EU Central (Frankfurt)',
        provider: 'aws',
        location: 'eu-central',
        availabilityZones: ['eu-central-1a', 'eu-central-1b', 'eu-central-1c'],
        priority: 1,
        complianceRequirements: ['GDPR', 'SOC2'],
        capacity: {
          minInstances: 2,
          maxInstances: 20,
          desiredInstances: 10,
        },
        networking: {
          vpcCidr: '10.2.0.0/16',
          subnetCidrs: ['10.2.1.0/24', '10.2.2.0/24', '10.2.3.0/24'],
          securityGroups: ['sg-67890'],
        },
      },
      {
        id: 'ap-southeast-1',
        name: 'AP Southeast (Singapore)',
        provider: 'aws',
        location: 'apac-singapore',
        availabilityZones: [
          'ap-southeast-1a',
          'ap-southeast-1b',
          'ap-southeast-1c',
        ],
        priority: 1,
        complianceRequirements: [],
        capacity: {
          minInstances: 2,
          maxInstances: 20,
          desiredInstances: 10,
        },
        networking: {
          vpcCidr: '10.3.0.0/16',
          subnetCidrs: ['10.3.1.0/24', '10.3.2.0/24', '10.3.3.0/24'],
          securityGroups: ['sg-54321'],
        },
      },
    ]
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): TrafficMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      p50Latency: 0,
      p95Latency: 0,
      p99Latency: 0,
      requestsByRegion: {},
      errorRateByRegion: {},
    }
  }

  /**
   * Route traffic to optimal target based on strategy
   */
  async routeTraffic(
    userLocation: { latitude: number; longitude: number },
    requestType: string = 'api',
    complianceRequirements: string[] = [],
  ): Promise<RoutingDecision> {
    if (!this.isInitialized) {
      throw new Error('Traffic routing manager not initialized')
    }

    try {
      const cacheKey = this.generateCacheKey(
        userLocation,
        requestType,
        complianceRequirements,
      )

      // Check cache first
      const cachedDecision = this.routingCache.get(cacheKey)
      if (cachedDecision && this.isCacheValid(cachedDecision)) {
        this.updateMetrics(cachedDecision)
        return cachedDecision
      }

      // Make routing decision
      const decision = await this.makeRoutingDecision(
        userLocation,
        requestType,
        complianceRequirements,
      )

      // Cache the decision
      this.routingCache.set(cacheKey, decision)

      // Update metrics
      this.updateMetrics(decision)

      this.emit('traffic-routed', {
        target: decision.target.regionId,
        reason: decision.reason,
        latency: decision.latency,
      })

      return decision
    } catch (error) {
      logger.error('Traffic routing failed', {
        error,
        userLocation,
        requestType,
      })

      // Fallback to default region
      const fallbackDecision = this.getFallbackDecision()
      this.emit('traffic-routing-failed', {
        error: error.message,
        fallback: fallbackDecision.target.regionId,
      })

      return fallbackDecision
    }
  }

  /**
   * Generate cache key for routing decision
   */
  private generateCacheKey(
    userLocation: { latitude: number; longitude: number },
    requestType: string,
    complianceRequirements: string[],
  ): string {
    const locationHash = `${Math.round(userLocation.latitude * 100)}_${Math.round(userLocation.longitude * 100)}`
    const complianceHash = complianceRequirements.sort().join(',')
    return `${locationHash}_${requestType}_${complianceHash}`
  }

  /**
   * Check if cached decision is still valid
   */
  private isCacheValid(decision: RoutingDecision): boolean {
    const now = new Date()
    const cacheAge = now.getTime() - decision.timestamp.getTime()
    return cacheAge < this.config.cacheTtl
  }

  /**
   * Make routing decision based on configured strategy
   */
  private async makeRoutingDecision(
    userLocation: { latitude: number; longitude: number },
    requestType: string,
    complianceRequirements: string[],
  ): Promise<RoutingDecision> {
    switch (this.config.strategy) {
      case 'latency-based':
        return this.makeLatencyBasedDecision(
          userLocation,
          requestType,
          complianceRequirements,
        )
      case 'health-based':
        return this.makeHealthBasedDecision(
          userLocation,
          requestType,
          complianceRequirements,
        )
      case 'compliance-based':
        return this.makeComplianceBasedDecision(
          userLocation,
          requestType,
          complianceRequirements,
        )
      case 'weighted-round-robin':
        return this.makeWeightedRoundRobinDecision(
          userLocation,
          requestType,
          complianceRequirements,
        )
      default:
        throw new Error(`Unsupported routing strategy: ${this.config.strategy}`)
    }
  }

  /**
   * Make latency-based routing decision
   */
  private async makeLatencyBasedDecision(
    userLocation: { latitude: number; longitude: number },
    requestType: string,
    complianceRequirements: string[],
  ): Promise<RoutingDecision> {
    const eligibleTargets = this.getEligibleTargets(complianceRequirements)

    if (eligibleTargets.length === 0) {
      throw new Error('No eligible targets for latency-based routing')
    }

    // Calculate latency for each target
    const targetsWithLatency = await Promise.all(
      eligibleTargets.map(async (target) => ({
        target,
        latency: await this.calculateLatency(userLocation, target),
      })),
    )

    // Filter by latency threshold
    const filteredTargets = targetsWithLatency.filter(
      (t) => t.latency <= this.config.latencyThreshold,
    )

    if (filteredTargets.length === 0) {
      // Use closest target if none meet threshold
      const closestTarget = targetsWithLatency.reduce((min, current) =>
        current.latency < min.latency ? current : min,
      )

      return {
        target: closestTarget.target,
        reason: 'Closest target (no targets meet latency threshold)',
        latency: closestTarget.latency,
        healthScore: closestTarget.target.healthScore,
        compliance: this.getComplianceStatus(closestTarget.target),
        timestamp: new Date(),
      }
    }

    // Select target with lowest latency
    const bestTarget = filteredTargets.reduce((min, current) =>
      current.latency < min.latency ? current : min,
    )

    return {
      target: bestTarget.target,
      reason: 'Lowest latency target',
      latency: bestTarget.latency,
      healthScore: bestTarget.target.healthScore,
      compliance: this.getComplianceStatus(bestTarget.target),
      timestamp: new Date(),
    }
  }

  /**
   * Make health-based routing decision
   */
  private async makeHealthBasedDecision(
    userLocation: { latitude: number; longitude: number },
    requestType: string,
    complianceRequirements: string[],
  ): Promise<RoutingDecision> {
    const eligibleTargets = this.getEligibleTargets(complianceRequirements)

    if (eligibleTargets.length === 0) {
      throw new Error('No eligible targets for health-based routing')
    }

    // Filter by health threshold
    const healthyTargets = eligibleTargets.filter(
      (t) => t.healthScore >= this.config.healthThreshold,
    )

    if (healthyTargets.length === 0) {
      // Use healthiest target if none meet threshold
      const healthiestTarget = eligibleTargets.reduce((max, current) =>
        current.healthScore > max.healthScore ? current : max,
      )

      return {
        target: healthiestTarget,
        reason: 'Healthiest target (no targets meet health threshold)',
        latency: 0, // Will be calculated later
        healthScore: healthiestTarget.healthScore,
        compliance: this.getComplianceStatus(healthiestTarget),
        timestamp: new Date(),
      }
    }

    // Among healthy targets, select based on lowest latency
    const targetsWithLatency = await Promise.all(
      healthyTargets.map(async (target) => ({
        target,
        latency: await this.calculateLatency(userLocation, target),
      })),
    )

    const bestTarget = targetsWithLatency.reduce((min, current) =>
      current.latency < min.latency ? current : min,
    )

    return {
      target: bestTarget.target,
      reason: 'Healthiest target with lowest latency',
      latency: bestTarget.latency,
      healthScore: bestTarget.target.healthScore,
      compliance: this.getComplianceStatus(bestTarget.target),
      timestamp: new Date(),
    }
  }

  /**
   * Make compliance-based routing decision
   */
  private async makeComplianceBasedDecision(
    userLocation: { latitude: number; longitude: number },
    requestType: string,
    complianceRequirements: string[],
  ): Promise<RoutingDecision> {
    const eligibleTargets = this.getEligibleTargets(complianceRequirements)

    if (eligibleTargets.length === 0) {
      throw new Error('No eligible targets for compliance-based routing')
    }

    // Prioritize targets that meet all compliance requirements
    const compliantTargets = eligibleTargets.filter((t) =>
      this.meetsAllComplianceRequirements(t, complianceRequirements),
    )

    if (compliantTargets.length === 0) {
      // Fall back to latency-based selection
      return this.makeLatencyBasedDecision(
        userLocation,
        requestType,
        complianceRequirements,
      )
    }

    // Among compliant targets, select based on lowest latency
    const targetsWithLatency = await Promise.all(
      compliantTargets.map(async (target) => ({
        target,
        latency: await this.calculateLatency(userLocation, target),
      })),
    )

    const bestTarget = targetsWithLatency.reduce((min, current) =>
      current.latency < min.latency ? current : min,
    )

    return {
      target: bestTarget.target,
      reason: 'Compliant target with lowest latency',
      latency: bestTarget.latency,
      healthScore: bestTarget.target.healthScore,
      compliance: complianceRequirements,
      timestamp: new Date(),
    }
  }

  /**
   * Make weighted round-robin routing decision
   */
  private async makeWeightedRoundRobinDecision(
    userLocation: { latitude: number; longitude: number },
    requestType: string,
    complianceRequirements: string[],
  ): Promise<RoutingDecision> {
    const eligibleTargets = this.getEligibleTargets(complianceRequirements)

    if (eligibleTargets.length === 0) {
      throw new Error('No eligible targets for weighted round-robin routing')
    }

    // Apply weights to targets
    const weightedTargets = eligibleTargets.map((target) => ({
      target,
      weight: this.config.weights[target.regionId] || 1,
      latency: 0, // Will be calculated for selected target
    }))

    // Select target based on weights
    const totalWeight = weightedTargets.reduce((sum, wt) => sum + wt.weight, 0)
    const randomWeight = Math.random() * totalWeight

    let currentWeight = 0
    let selectedTarget = weightedTargets[0]

    for (const wt of weightedTargets) {
      currentWeight += wt.weight
      if (randomWeight <= currentWeight) {
        selectedTarget = wt
        break
      }
    }

    // Calculate latency for selected target
    selectedTarget.latency = await this.calculateLatency(
      userLocation,
      selectedTarget.target,
    )

    return {
      target: selectedTarget.target,
      reason: 'Weighted round-robin selection',
      latency: selectedTarget.latency,
      healthScore: selectedTarget.target.healthScore,
      compliance: this.getComplianceStatus(selectedTarget.target),
      timestamp: new Date(),
    }
  }

  /**
   * Get eligible targets based on compliance requirements
   */
  private getEligibleTargets(complianceRequirements: string[]): RouteTarget[] {
    const targets = Array.from(this.routeTargets.values())

    if (complianceRequirements.length === 0) {
      return targets
    }

    return targets.filter((target) =>
      this.meetsComplianceRequirements(target, complianceRequirements),
    )
  }

  /**
   * Check if target meets compliance requirements
   */
  private meetsComplianceRequirements(
    target: RouteTarget,
    requirements: string[],
  ): boolean {
    if (requirements.length === 0) return true

    const region = this.loadRegionConfiguration().find(
      (r) => r.id === target.regionId,
    )
    if (!region) return false

    return requirements.every((req) =>
      region.complianceRequirements.includes(req),
    )
  }

  /**
   * Check if target meets all compliance requirements
   */
  private meetsAllComplianceRequirements(
    target: RouteTarget,
    requirements: string[],
  ): boolean {
    const region = this.loadRegionConfiguration().find(
      (r) => r.id === target.regionId,
    )
    if (!region) return false

    return requirements.every((req) =>
      region.complianceRequirements.includes(req),
    )
  }

  /**
   * Get compliance status for target
   */
  private getComplianceStatus(target: RouteTarget): string[] {
    const region = this.loadRegionConfiguration().find(
      (r) => r.id === target.regionId,
    )
    return region?.complianceRequirements || []
  }

  /**
   * Calculate latency to target (simulated)
   */
  private async calculateLatency(
    userLocation: { latitude: number; longitude: number },
    target: RouteTarget,
  ): Promise<number> {
    // This would typically use real latency measurements or CDN data
    // For now, we'll simulate based on geographic distance

    const region = this.loadRegionConfiguration().find(
      (r) => r.id === target.regionId,
    )
    if (!region) return 100 // Default latency

    // Simulate region coordinates (in real implementation, these would be actual coordinates)
    const regionCoordinates = this.getRegionCoordinates(region.location)
    const distance = this.calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      regionCoordinates.latitude,
      regionCoordinates.longitude,
    )

    // Convert distance to simulated latency (km to ms)
    const baseLatency = distance * 0.1 // 0.1ms per km
    const networkFactor = Math.random() * 0.2 + 0.9 // 0.9-1.1x variation
    const congestionFactor = 1 + (target.currentLoad / target.capacity) * 0.5 // Congestion penalty

    return Math.round(baseLatency * networkFactor * congestionFactor)
  }

  /**
   * Get region coordinates (simulated)
   */
  private getRegionCoordinates(location: string): {
    latitude: number
    longitude: number
  } {
    const coordinates: Record<string, { latitude: number; longitude: number }> =
    {
      'us-east': { latitude: 39.0438, longitude: -77.4874 },
      'us-west': { latitude: 45.8399, longitude: -119.7006 },
      'eu-central': { latitude: 50.1109, longitude: 8.6821 },
      'eu-west': { latitude: 53.3498, longitude: -6.2603 },
      'apac-singapore': { latitude: 1.3521, longitude: 103.8198 },
      'apac-tokyo': { latitude: 35.6762, longitude: 139.6503 },
    }

    return coordinates[location] || { latitude: 0, longitude: 0 }
  }

  /**
   * Calculate distance between two points using Haversine formula
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
   * Get fallback decision
   */
  private getFallbackDecision(): RoutingDecision {
    const fallbackRegion = this.config.fallbackRegions[0]
    const target = this.routeTargets.get(fallbackRegion)

    if (!target) {
      // Use first available target
      const firstTarget = Array.from(this.routeTargets.values())[0]
      return {
        target: firstTarget,
        reason: 'Fallback to first available target',
        latency: 0,
        healthScore: firstTarget.healthScore,
        compliance: this.getComplianceStatus(firstTarget),
        timestamp: new Date(),
      }
    }

    return {
      target,
      reason: 'Fallback to configured fallback region',
      latency: 0,
      healthScore: target.healthScore,
      compliance: this.getComplianceStatus(target),
      timestamp: new Date(),
    }
  }

  /**
   * Update metrics with routing decision
   */
  private updateMetrics(decision: RoutingDecision): void {
    this.metrics.totalRequests++
    this.metrics.requestsByRegion[decision.target.regionId] =
      (this.metrics.requestsByRegion[decision.target.regionId] || 0) + 1

    if (decision.target.healthScore >= 80) {
      this.metrics.successfulRequests++
    } else {
      this.metrics.failedRequests++
      this.metrics.errorRateByRegion[decision.target.regionId] =
        (this.metrics.errorRateByRegion[decision.target.regionId] || 0) + 1
    }

    // Update latency metrics
    this.updateLatencyMetrics(decision.latency)
  }

  /**
   * Update latency metrics
   */
  private updateLatencyMetrics(latency: number): void {
    // Simple running average (in production, use proper percentile calculations)
    this.metrics.averageLatency = (this.metrics.averageLatency + latency) / 2

    // Update percentiles (simplified)
    if (this.metrics.p50Latency === 0) {
      this.metrics.p50Latency = latency
      this.metrics.p95Latency = latency * 1.5
      this.metrics.p99Latency = latency * 2
    } else {
      this.metrics.p50Latency = (this.metrics.p50Latency + latency) / 2
      this.metrics.p95Latency = (this.metrics.p95Latency + latency * 1.5) / 2
      this.metrics.p99Latency = (this.metrics.p99Latency + latency * 2) / 2
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval)
    }

    this.metricsInterval = setInterval(() => {
      this.collectMetrics()
    }, 60000) // Collect metrics every minute

    logger.info('Traffic routing metrics collection started')
  }

  /**
   * Collect and process metrics
   */
  private collectMetrics(): void {
    try {
      // Calculate error rates
      for (const region in this.metrics.errorRateByRegion) {
        const requests = this.metrics.requestsByRegion[region] || 0
        const errors = this.metrics.errorRateByRegion[region]
        this.metrics.errorRateByRegion[region] =
          requests > 0 ? errors / requests : 0
      }

      // Emit metrics for monitoring
      this.emit('metrics-collected', {
        totalRequests: this.metrics.totalRequests,
        successRate:
          this.metrics.totalRequests > 0
            ? this.metrics.successfulRequests / this.metrics.totalRequests
            : 0,
        averageLatency: this.metrics.averageLatency,
        requestsByRegion: this.metrics.requestsByRegion,
      })

      logger.info('Traffic routing metrics collected', {
        totalRequests: this.metrics.totalRequests,
        successRate:
          this.metrics.totalRequests > 0
            ? this.metrics.successfulRequests / this.metrics.totalRequests
            : 0,
      })
    } catch (error) {
      logger.error('Metrics collection failed', { error })
    }
  }

  /**
   * Update target health score
   */
  updateTargetHealth(regionId: string, healthScore: number): void {
    const target = this.routeTargets.get(regionId)
    if (target) {
      target.healthScore = Math.max(0, Math.min(100, healthScore))
      logger.info(`Updated health score for region: ${regionId}`, {
        healthScore,
      })

      this.emit('target-health-updated', { regionId, healthScore })
    }
  }

  /**
   * Update target latency
   */
  updateTargetLatency(regionId: string, latency: number): void {
    const target = this.routeTargets.get(regionId)
    if (target) {
      target.latency = Math.max(0, latency)
      logger.info(`Updated latency for region: ${regionId}`, { latency })
    }
  }

  /**
   * Update target load
   */
  updateTargetLoad(regionId: string, currentLoad: number): void {
    const target = this.routeTargets.get(regionId)
    if (target) {
      target.currentLoad = Math.max(0, Math.min(target.capacity, currentLoad))
      logger.debug(`Updated load for region: ${regionId}`, { currentLoad })
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): TrafficMetrics {
    return { ...this.metrics }
  }

  /**
   * Get routing statistics
   */
  getRoutingStatistics(): {
    totalDecisions: number
    cacheHitRate: number
    averageLatency: number
    strategy: string
    activeTargets: number
  } {
    const totalDecisions = this.metrics.totalRequests
    const cacheHits = Array.from(this.routingCache.values()).length

    return {
      totalDecisions,
      cacheHitRate: totalDecisions > 0 ? cacheHits / totalDecisions : 0,
      averageLatency: this.metrics.averageLatency,
      strategy: this.config.strategy,
      activeTargets: this.routeTargets.size,
    }
  }

  /**
   * Clear routing cache
   */
  clearRoutingCache(): void {
    this.routingCache.clear()
    logger.info('Routing cache cleared')
  }

  /**
   * Get route targets
   */
  getRouteTargets(): RouteTarget[] {
    return Array.from(this.routeTargets.values())
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      logger.info('Cleaning up Global Traffic Routing Manager')

      if (this.metricsInterval) {
        clearInterval(this.metricsInterval)
        this.metricsInterval = null
      }

      this.routingCache.clear()
      this.routeTargets.clear()
      this.isInitialized = false

      logger.info('Global Traffic Routing Manager cleanup completed')
    } catch (error) {
      logger.error('Traffic routing cleanup failed', { error })
      throw error
    }
  }
}

export default GlobalTrafficRoutingManager
