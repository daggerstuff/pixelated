/**
 * Health Monitor
 *
 * Monitors health and performance of multi-region infrastructure with
 * automated alerting, metrics collection, and health score calculation.
 */

import { EventEmitter } from 'events'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const logger = createBuildSafeLogger('HealthMonitor')
import { RegionConfig } from './MultiRegionDeploymentManager'

export interface HealthCheckConfig {
  interval: number
  timeout: number
  retries: number
  thresholds: {
    cpu: number
    memory: number
    disk: number
    responseTime: number
    errorRate: number
    availability: number
  }
}

export interface HealthMetrics {
  regionId: string
  timestamp: Date
  cpuUtilization: number
  memoryUtilization: number
  diskUtilization: number
  responseTime: number
  errorRate: number
  availability: number
  activeConnections: number
  requestCount: number
  throughput: number
}

export interface HealthScore {
  regionId: string
  overallScore: number
  componentScores: {
    performance: number
    availability: number
    capacity: number
    security: number
  }
  status: 'healthy' | 'degraded' | 'critical'
  lastUpdated: Date
  trends: {
    '1h': number
    '24h': number
    '7d': number
  }
}

export interface HealthAlert {
  id: string
  regionId: string
  type: 'performance' | 'availability' | 'capacity' | 'security'
  severity: 'info' | 'warning' | 'error' | 'critical'
  message: string
  metrics: HealthMetrics
  threshold: number
  timestamp: Date
  acknowledged: boolean
}

export class HealthMonitor extends EventEmitter {
  private config: HealthCheckConfig
  private regions: RegionConfig[] = []
  private healthMetrics: Map<string, HealthMetrics[]> = new Map()
  private healthScores: Map<string, HealthScore> = new Map()
  private activeAlerts: Map<string, HealthAlert> = new Map()
  private isInitialized = false
  private healthCheckInterval: NodeJS.Timeout | null = null
  private metricsRetentionInterval: NodeJS.Timeout | null = null

  constructor(config: HealthCheckConfig) {
    super()
    this.config = config
  }

  /**
   * Initialize health monitor
   */
  async initialize(regions: RegionConfig[]): Promise<void> {
    try {
      logger.info('Initializing Health Monitor', { regions: regions.length })

      this.regions = regions

      // Initialize health data structures
      this.initializeHealthData()

      // Start health monitoring
      this.startHealthMonitoring()

      // Start metrics retention cleanup
      this.startMetricsRetention()

      this.isInitialized = true
      logger.info('Health Monitor initialized successfully')

      this.emit('initialized', { regions: regions.length })
    } catch (error) {
      logger.error('Failed to initialize Health Monitor', { error })
      throw new Error(`Initialization failed: ${error.message}`, {
        cause: error,
      })
    }
  }

  /**
   * Initialize health data structures
   */
  private initializeHealthData(): void {
    for (const region of this.regions) {
      this.healthMetrics.set(region.id, [])
      this.healthScores.set(region.id, this.createInitialHealthScore(region.id))
    }
  }

  /**
   * Create initial health score for region
   */
  private createInitialHealthScore(regionId: string): HealthScore {
    return {
      regionId,
      overallScore: 100,
      componentScores: {
        performance: 100,
        availability: 100,
        capacity: 100,
        security: 100,
      },
      status: 'healthy',
      lastUpdated: new Date(),
      trends: {
        '1h': 100,
        '24h': 100,
        '7d': 100,
      },
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }

    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks()
    }, this.config.interval)

    logger.info('Health monitoring started', { interval: this.config.interval })
  }

  /**
   * Start metrics retention cleanup
   */
  private startMetricsRetention(): void {
    if (this.metricsRetentionInterval) {
      clearInterval(this.metricsRetentionInterval)
    }

    // Clean up old metrics every hour
    this.metricsRetentionInterval = setInterval(() => {
      this.cleanupOldMetrics()
    }, 3600000)

    logger.info('Metrics retention cleanup started')
  }

  /**
   * Perform health checks on all regions
   */
  private async performHealthChecks(): Promise<void> {
    try {
      const checkPromises = this.regions.map((region) =>
        this.performRegionHealthCheck(region),
      )

      await Promise.allSettled(checkPromises)
    } catch (error) {
      logger.error('Health check cycle failed', { error })
    }
  }

  /**
   * Perform health check on specific region
   */
  private async performRegionHealthCheck(region: RegionConfig): Promise<void> {
    try {
      logger.debug(`Performing health check for region: ${region.name}`)

      // Collect metrics
      const metrics = await this.collectHealthMetrics(region)

      // Store metrics
      this.storeHealthMetrics(region.id, metrics)

      // Calculate health score
      const healthScore = this.calculateHealthScore(region.id, metrics)

      // Update health score
      this.updateHealthScore(region.id, healthScore)

      // Check for alerts
      await this.checkForAlerts(region.id, metrics, healthScore)

      logger.debug(`Health check completed for region: ${region.name}`, {
        overallScore: healthScore.overallScore,
        status: healthScore.status,
      })
    } catch (error) {
      logger.error(`Health check failed for region: ${region.name}`, { error })

      // Create degraded health score on failure
      const failedScore: HealthScore = {
        regionId: region.id,
        overallScore: 0,
        componentScores: {
          performance: 0,
          availability: 0,
          capacity: 0,
          security: 0,
        },
        status: 'critical',
        lastUpdated: new Date(),
        trends: this.healthScores.get(region.id)?.trends || {
          '1h': 0,
          '24h': 0,
          '7d': 0,
        },
      }

      this.updateHealthScore(region.id, failedScore)
      this.emit('health-check-failed', {
        regionId: region.id,
        error: error.message,
      })
    }
  }

  /**
   * Collect health metrics for region
   */
  private async collectHealthMetrics(
    region: RegionConfig,
  ): Promise<HealthMetrics> {
    try {
      // Simulate collecting metrics from various sources
      // In a real implementation, this would collect from:
      // - Cloud provider APIs (AWS CloudWatch, GCP Monitoring, Azure Monitor)
      // - Application metrics (Prometheus, DataDog, New Relic)
      // - Custom health endpoints
      // - Log analysis systems

      const metrics: HealthMetrics = {
        regionId: region.id,
        timestamp: new Date(),
        cpuUtilization: this.simulateMetric(20, 80, region.id),
        memoryUtilization: this.simulateMetric(30, 70, region.id),
        diskUtilization: this.simulateMetric(40, 60, region.id),
        responseTime: this.simulateMetric(50, 200, region.id),
        errorRate: this.simulateMetric(0, 5, region.id),
        availability: this.simulateMetric(95, 100, region.id),
        activeConnections: Math.floor(Math.random() * 1000),
        requestCount: Math.floor(Math.random() * 10000),
        throughput: Math.floor(Math.random() * 1000),
      }

      // Add some realistic variations based on region characteristics
      if (region.provider === 'aws') {
        metrics.responseTime += Math.random() * 20 - 10 // ±10ms variation
      } else if (region.provider === 'gcp') {
        metrics.cpuUtilization += Math.random() * 10 - 5 // ±5% variation
      }

      return metrics
    } catch (error) {
      logger.error(
        `Failed to collect health metrics for region: ${region.name}`,
        { error },
      )
      throw error
    }
  }

  /**
   * Simulate metric value with realistic patterns
   */
  private simulateMetric(min: number, max: number, _seed: string): number {
    // Use region ID as seed for consistent but varying metrics
    const baseValue = min + (max - min) * 0.5
    const variation = (max - min) * 0.3

    // Add some time-based variation
    const timeVariation = Math.sin(Date.now() / 60000) * variation * 0.2

    // Add random noise
    const randomNoise = (Math.random() - 0.5) * variation * 0.1

    const value = baseValue + timeVariation + randomNoise

    return Math.max(min, Math.min(max, value))
  }

  /**
   * Store health metrics
   */
  private storeHealthMetrics(regionId: string, metrics: HealthMetrics): void {
    const metricsHistory = this.healthMetrics.get(regionId) || []
    metricsHistory.push(metrics)

    // Keep only last 1000 metrics per region (about 8.3 hours at 30-second intervals)
    if (metricsHistory.length > 1000) {
      metricsHistory.shift()
    }

    this.healthMetrics.set(regionId, metricsHistory)
  }

  /**
   * Calculate health score from metrics
   */
  private calculateHealthScore(
    regionId: string,
    currentMetrics: HealthMetrics,
  ): HealthScore {
    const metricsHistory = this.healthMetrics.get(regionId) || []

    // Calculate component scores
    const performanceScore = this.calculatePerformanceScore(
      currentMetrics,
      metricsHistory,
    )
    const availabilityScore = this.calculateAvailabilityScore(
      currentMetrics,
      metricsHistory,
    )
    const capacityScore = this.calculateCapacityScore(
      currentMetrics,
      metricsHistory,
    )
    const securityScore = this.calculateSecurityScore(
      currentMetrics,
      metricsHistory,
    )

    // Calculate overall score (weighted average)
    const overallScore = Math.round(
      performanceScore * 0.4 +
      availabilityScore * 0.3 +
      capacityScore * 0.2 +
      securityScore * 0.1,
    )

    // Determine status
    let status: 'healthy' | 'degraded' | 'critical'
    if (overallScore >= 80) {
      status = 'healthy'
    } else if (overallScore >= 60) {
      status = 'degraded'
    } else {
      status = 'critical'
    }

    // Calculate trends
    const trends = this.calculateTrends(metricsHistory)

    return {
      regionId,
      overallScore,
      componentScores: {
        performance: performanceScore,
        availability: availabilityScore,
        capacity: capacityScore,
        security: securityScore,
      },
      status,
      lastUpdated: new Date(),
      trends,
    }
  }

  /**
   * Calculate performance score
   */
  private calculatePerformanceScore(
    current: HealthMetrics,
    history: HealthMetrics[],
  ): number {
    let score = 100

    // Response time impact
    if (current.responseTime > this.config.thresholds.responseTime) {
      const excess = current.responseTime - this.config.thresholds.responseTime
      score -= Math.min(30, (excess / this.config.thresholds.responseTime) * 30)
    }

    // CPU utilization impact
    if (current.cpuUtilization > this.config.thresholds.cpu) {
      const excess = current.cpuUtilization - this.config.thresholds.cpu
      score -= Math.min(20, (excess / (100 - this.config.thresholds.cpu)) * 20)
    }

    // Memory utilization impact
    if (current.memoryUtilization > this.config.thresholds.memory) {
      const excess = current.memoryUtilization - this.config.thresholds.memory
      score -= Math.min(
        20,
        (excess / (100 - this.config.thresholds.memory)) * 20,
      )
    }

    // Throughput impact (higher is better)
    const avgThroughput =
      history.length > 0
        ? history.slice(-10).reduce((sum, m) => sum + m.throughput, 0) / 10
        : current.throughput

    if (current.throughput < avgThroughput * 0.8) {
      score -= 10
    }

    return Math.max(0, Math.round(score))
  }

  /**
   * Calculate availability score
   */
  private calculateAvailabilityScore(
    current: HealthMetrics,
    _history: HealthMetrics[],
  ): number {
    let score = 100

    // Availability impact
    if (current.availability < this.config.thresholds.availability) {
      const deficit = this.config.thresholds.availability - current.availability
      score -= Math.min(
        50,
        (deficit / this.config.thresholds.availability) * 50,
      )
    }

    // Error rate impact
    if (current.errorRate > this.config.thresholds.errorRate) {
      const excess = current.errorRate - this.config.thresholds.errorRate
      score -= Math.min(
        30,
        (excess / (5 - this.config.thresholds.errorRate)) * 30,
      )
    }

    // Response time impact on availability
    if (current.responseTime > this.config.thresholds.responseTime * 2) {
      score -= 20
    }

    return Math.max(0, Math.round(score))
  }

  /**
   * Calculate capacity score
   */
  private calculateCapacityScore(
    current: HealthMetrics,
    history: HealthMetrics[],
  ): number {
    let score = 100

    // Disk utilization impact
    if (current.diskUtilization > this.config.thresholds.disk) {
      const excess = current.diskUtilization - this.config.thresholds.disk
      score -= Math.min(40, (excess / (100 - this.config.thresholds.disk)) * 40)
    }

    // Connection count impact (relative to recent history)
    const avgConnections =
      history.length > 0
        ? history.slice(-10).reduce((sum, m) => sum + m.activeConnections, 0) /
        10
        : current.activeConnections

    if (current.activeConnections > avgConnections * 1.5) {
      score -= 20 // High connection count may indicate capacity issues
    }

    // Memory utilization impact on capacity
    if (current.memoryUtilization > 90) {
      score -= 30 // Critical memory usage
    }

    return Math.max(0, Math.round(score))
  }

  /**
   * Calculate security score
   */
  private calculateSecurityScore(
    current: HealthMetrics,
    history: HealthMetrics[],
  ): number {
    let score = 100

    // Error rate impact on security (high error rates may indicate attacks)
    if (current.errorRate > 2) {
      score -= 20
    }

    // Sudden spike in connections may indicate attack
    const avgConnections =
      history.length > 0
        ? history.slice(-10).reduce((sum, m) => sum + m.activeConnections, 0) /
        10
        : current.activeConnections

    if (current.activeConnections > avgConnections * 3) {
      score -= 30
    }

    // High CPU during low throughput may indicate crypto mining or other malicious activity
    if (
      current.cpuUtilization > 80 &&
      current.throughput < avgConnections * 0.5
    ) {
      score -= 25
    }

    return Math.max(0, Math.round(score))
  }

  /**
   * Calculate health trends
   */
  private calculateTrends(history: HealthMetrics[]): {
    '1h': number
    '24h': number
    '7d': number
  } {
    const now = new Date()

    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const recentMetrics = history.filter((m) => m.timestamp > oneHourAgo)
    const dayMetrics = history.filter((m) => m.timestamp > oneDayAgo)
    const weekMetrics = history.filter((m) => m.timestamp > sevenDaysAgo)

    const calculateAverageScore = (metrics: HealthMetrics[]): number => {
      if (metrics.length === 0) return 100

      const scores = metrics.map((m) => {
        // Simple composite score from key metrics
        const availabilityScore = m.availability
        const performanceScore = Math.max(0, 100 - m.responseTime / 2)
        const errorScore = Math.max(0, 100 - m.errorRate * 20)

        return (availabilityScore + performanceScore + errorScore) / 3
      })

      return scores.reduce((sum, score) => sum + score, 0) / scores.length
    }

    return {
      '1h': Math.round(calculateAverageScore(recentMetrics)),
      '24h': Math.round(calculateAverageScore(dayMetrics)),
      '7d': Math.round(calculateAverageScore(weekMetrics)),
    }
  }

  /**
   * Update health score
   */
  private updateHealthScore(regionId: string, healthScore: HealthScore): void {
    const previousScore = this.healthScores.get(regionId)
    this.healthScores.set(regionId, healthScore)

    // Emit events for significant changes
    if (previousScore) {
      if (previousScore.status !== healthScore.status) {
        this.emit('health-status-changed', {
          regionId,
          previousStatus: previousScore.status,
          newStatus: healthScore.status,
          score: healthScore.overallScore,
        })
      }

      if (
        Math.abs(previousScore.overallScore - healthScore.overallScore) > 20
      ) {
        this.emit('health-score-changed', {
          regionId,
          previousScore: previousScore.overallScore,
          newScore: healthScore.overallScore,
          status: healthScore.status,
        })
      }
    }
  }

  /**
   * Check for health alerts
   */
  private async checkForAlerts(
    regionId: string,
    metrics: HealthMetrics,
    healthScore: HealthScore,
  ): Promise<void> {
    try {
      const alerts: HealthAlert[] = []

      // Check CPU utilization
      if (metrics.cpuUtilization > this.config.thresholds.cpu) {
        alerts.push(
          this.createAlert(
            regionId,
            'performance',
            'warning',
            `High CPU utilization: ${metrics.cpuUtilization.toFixed(1)}%`,
            metrics,
            this.config.thresholds.cpu,
          ),
        )
      }

      // Check memory utilization
      if (metrics.memoryUtilization > this.config.thresholds.memory) {
        alerts.push(
          this.createAlert(
            regionId,
            'performance',
            'warning',
            `High memory utilization: ${metrics.memoryUtilization.toFixed(1)}%`,
            metrics,
            this.config.thresholds.memory,
          ),
        )
      }

      // Check availability
      if (metrics.availability < this.config.thresholds.availability) {
        const severity = metrics.availability < 90 ? 'error' : 'warning'
        alerts.push(
          this.createAlert(
            regionId,
            'availability',
            severity,
            `Low availability: ${metrics.availability.toFixed(1)}%`,
            metrics,
            this.config.thresholds.availability,
          ),
        )
      }

      // Check error rate
      if (metrics.errorRate > this.config.thresholds.errorRate) {
        const severity = metrics.errorRate > 5 ? 'error' : 'warning'
        alerts.push(
          this.createAlert(
            regionId,
            'availability',
            severity,
            `High error rate: ${metrics.errorRate.toFixed(2)}%`,
            metrics,
            this.config.thresholds.errorRate,
          ),
        )
      }

      // Check overall health score
      if (healthScore.status === 'critical') {
        alerts.push(
          this.createAlert(
            regionId,
            'capacity',
            'critical',
            `Critical health score: ${healthScore.overallScore}`,
            metrics,
            60,
          ),
        )
      } else if (healthScore.status === 'degraded') {
        alerts.push(
          this.createAlert(
            regionId,
            'capacity',
            'warning',
            `Degraded health score: ${healthScore.overallScore}`,
            metrics,
            80,
          ),
        )
      }

      // Store and emit alerts
      for (const alert of alerts) {
        this.activeAlerts.set(alert.id, alert)
        this.emit('health-alert', alert)
      }

      if (alerts.length > 0) {
        logger.info(
          `Generated ${alerts.length} health alerts for region: ${regionId}`,
        )
      }
    } catch (error) {
      logger.error(
        `Failed to check for health alerts for region: ${regionId}`,
        { error },
      )
    }
  }

  /**
   * Create health alert
   */
  private createAlert(
    regionId: string,
    type: HealthAlert['type'],
    severity: HealthAlert['severity'],
    message: string,
    metrics: HealthMetrics,
    threshold: number,
  ): HealthAlert {
    return {
      id: `alert-${regionId}-${type}-${Date.now()}`,
      regionId,
      type,
      severity,
      message,
      metrics,
      threshold,
      timestamp: new Date(),
      acknowledged: false,
    }
  }

  /**
   * Get current health score for region
   */
  getHealthScore(regionId: string): HealthScore | undefined {
    return this.healthScores.get(regionId)
  }

  /**
   * Get all health scores
   */
  getAllHealthScores(): HealthScore[] {
    return Array.from(this.healthScores.values())
  }

  /**
   * Get health metrics history for region
   */
  getHealthMetricsHistory(
    regionId: string,
    limit: number = 100,
  ): HealthMetrics[] {
    const metrics = this.healthMetrics.get(regionId) || []
    return metrics.slice(-limit)
  }

  /**
   * Get active health alerts
   */
  getActiveAlerts(): HealthAlert[] {
    return Array.from(this.activeAlerts.values())
  }

  /**
   * Get alerts by region
   */
  getAlertsByRegion(regionId: string): HealthAlert[] {
    return Array.from(this.activeAlerts.values()).filter(
      (alert) => alert.regionId === regionId,
    )
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId)
    if (alert) {
      alert.acknowledged = true
      logger.info(`Alert acknowledged: ${alertId}`)
      this.emit('alert-acknowledged', { alertId })
      return true
    }
    return false
  }

  /**
   * Clear resolved alerts
   */
  clearResolvedAlerts(): number {
    const now = new Date()
    let clearedCount = 0

    for (const [alertId, alert] of this.activeAlerts.entries()) {
      // Clear alerts older than 1 hour that are acknowledged or low severity
      const age = now.getTime() - alert.timestamp.getTime()
      const shouldClear =
        age > 3600000 && (alert.acknowledged || alert.severity === 'info')

      if (shouldClear) {
        this.activeAlerts.delete(alertId)
        clearedCount++
      }
    }

    if (clearedCount > 0) {
      logger.info(`Cleared ${clearedCount} resolved alerts`)
    }

    return clearedCount
  }

  /**
   * Get health summary
   */
  getHealthSummary(): {
    totalRegions: number
    healthyRegions: number
    degradedRegions: number
    criticalRegions: number
    activeAlerts: number
    averageHealthScore: number
  } {
    const healthScores = Array.from(this.healthScores.values())

    const summary = {
      totalRegions: healthScores.length,
      healthyRegions: healthScores.filter((h) => h.status === 'healthy').length,
      degradedRegions: healthScores.filter((h) => h.status === 'degraded')
        .length,
      criticalRegions: healthScores.filter((h) => h.status === 'critical')
        .length,
      activeAlerts: this.activeAlerts.size,
      averageHealthScore: 0,
    }

    if (healthScores.length > 0) {
      summary.averageHealthScore = Math.round(
        healthScores.reduce((sum, h) => sum + h.overallScore, 0) /
        healthScores.length,
      )
    }

    return summary
  }

  /**
   * Cleanup old metrics
   */
  private cleanupOldMetrics(): void {
    try {
      const now = new Date()
      const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 days

      for (const [regionId, metrics] of this.healthMetrics.entries()) {
        const filteredMetrics = metrics.filter(
          (m) => now.getTime() - m.timestamp.getTime() < maxAge,
        )

        if (filteredMetrics.length < metrics.length) {
          this.healthMetrics.set(regionId, filteredMetrics)
          logger.debug(
            `Cleaned up ${metrics.length - filteredMetrics.length} old metrics for region: ${regionId}`,
          )
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup old metrics', { error })
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      logger.info('Cleaning up Health Monitor')

      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval)
        this.healthCheckInterval = null
      }

      if (this.metricsRetentionInterval) {
        clearInterval(this.metricsRetentionInterval)
        this.metricsRetentionInterval = null
      }

      this.healthMetrics.clear()
      this.healthScores.clear()
      this.activeAlerts.clear()
      this.isInitialized = false

      logger.info('Health Monitor cleanup completed')
    } catch (error) {
      logger.error('Health Monitor cleanup failed', { error })
      throw error
    }
  }
}

export default HealthMonitor
