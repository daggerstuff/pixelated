/**
 * Advanced Performance Monitoring System for Pixelated Empathy
 * Real-time performance tracking, optimization, and alerting
 */

import type {
  PerformanceMetrics,
  OptimizationRecommendation,
} from '@/types/monitoring'

export interface PerformanceConfig {
  enableRealTimeMonitoring: boolean
  alertThresholds: {
    responseTime: number // ms
    memoryUsage: number // %
    cpuUsage: number // %
    errorRate: number // %
  }
  optimizationTargets: {
    responseTime: number
    memoryUsage: number
    cpuUsage: number
  }
  monitoringInterval: number // ms
}

export interface PerformanceAlert {
  id: string
  type: 'warning' | 'critical' | 'info'
  metric: string
  value: number
  threshold: number
  message: string
  timestamp: Date
  resolved: boolean
  resolution?: string
}

export interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical' | 'unknown'
  components: Record<
    string,
    {
      status: 'healthy' | 'warning' | 'critical'
      responseTime: number
      errorRate: number
      lastCheck: Date
    }
  >
  recommendations: string[]
}

/**
 * Advanced Performance Monitoring System
 */
class PerformanceMonitor {
  private config: PerformanceConfig
  private metrics: PerformanceMetrics[] = []
  private alerts: PerformanceAlert[] = []
  private optimizationHistory: OptimizationRecommendation[] = []
  private monitoringInterval: NodeJS.Timeout | null = null
  private alertCallbacks = new Map<string, Function[]>()

  constructor() {
    this.config = {
      enableRealTimeMonitoring: true,
      alertThresholds: {
        responseTime: 100,
        memoryUsage: 80,
        cpuUsage: 70,
        errorRate: 1,
      },
      optimizationTargets: {
        responseTime: 50,
        memoryUsage: 60,
        cpuUsage: 50,
      },
      monitoringInterval: 5000, // 5 seconds
    }
  }

  /**
   * Start real-time performance monitoring
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
    }

    this.monitoringInterval = setInterval(async () => {
      await this.collectMetrics()
      this.analyzePerformance()
      this.checkAlerts()
    }, this.config.monitoringInterval)

    console.log('Performance monitoring started')
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }
    console.log('Performance monitoring stopped')
  }

  private async collectMetrics(): Promise<void> {
    const metrics: PerformanceMetrics = {
      timestamp: new Date(),
      responseTime: await this.measureResponseTime(),
      memoryUsage: await this.measureMemoryUsage(),
      cpuUsage: await this.measureCpuUsage(),
      errorRate: await this.measureErrorRate(),
      throughput: await this.measureThroughput(),
      activeUsers: await this.getActiveUserCount(),
      systemLoad: await this.measureSystemLoad(),
    }

    this.metrics.push(metrics)

    // Keep only last 1000 metrics to prevent memory bloat
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000)
    }
  }

  private async measureResponseTime(): Promise<number> {
    const start = performance.now()

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 50))

    return performance.now() - start
  }

  private async measureMemoryUsage(): Promise<number> {
    if ('memory' in performance) {
      const memInfo = (performance as any).memory
      return (memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit) * 100
    }
    return Math.random() * 100 // Mock data
  }

  private async measureCpuUsage(): Promise<number> {
    // In real implementation, would use Performance Observer or Node.js process.cpuUsage()
    return Math.random() * 100 // Mock data
  }

  private async measureErrorRate(): Promise<number> {
    // Calculate error rate from recent requests
    const recentMetrics = this.metrics.slice(-10)
    if (recentMetrics.length === 0) return 0

    const totalErrors = recentMetrics.reduce(
      (sum, m) => sum + (m.errorCount || 0),
      0,
    )
    const totalRequests = recentMetrics.reduce(
      (sum, m) => sum + (m.requestCount || 1),
      0,
    )

    return totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0
  }

  private async measureThroughput(): Promise<number> {
    // Requests per second
    return Math.random() * 100 + 50 // Mock data
  }

  private async getActiveUserCount(): Promise<number> {
    // In real implementation, would get from WebSocket connections or database
    return Math.floor(Math.random() * 100) + 20
  }

  private async measureSystemLoad(): Promise<number> {
    // System load average
    return Math.random() * 2 // Mock data
  }

  private analyzePerformance(): void {
    if (this.metrics.length < 2) return

    const recent = this.metrics.slice(-10)
    const older = this.metrics.slice(-20, -10)

    // Compare recent vs older performance
    const recentAvg = this.calculateAverageMetrics(recent)
    const olderAvg = this.calculateAverageMetrics(older)

    // Generate optimization recommendations
    const recommendations = this.generateOptimizationRecommendations(
      recentAvg,
      olderAvg,
    )

    if (recommendations.length > 0) {
      this.optimizationHistory.push({
        id: `opt_${Date.now()}`,
        timestamp: new Date(),
        type: 'performance',
        description: 'Automatic performance optimization recommendations',
        recommendations,
        expectedImprovement: this.calculateExpectedImprovement(recommendations),
      })
    }
  }

  private calculateAverageMetrics(
    metrics: PerformanceMetrics[],
  ): Partial<PerformanceMetrics> {
    const sums = metrics.reduce(
      (acc, metric) => {
        acc.responseTime += metric.responseTime
        acc.memoryUsage += metric.memoryUsage
        acc.cpuUsage += metric.cpuUsage
        acc.errorRate += metric.errorRate
        acc.throughput += metric.throughput
        return acc
      },
      {
        responseTime: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        errorRate: 0,
        throughput: 0,
      },
    )

    const count = metrics.length
    return {
      responseTime: sums.responseTime / count,
      memoryUsage: sums.memoryUsage / count,
      cpuUsage: sums.cpuUsage / count,
      errorRate: sums.errorRate / count,
      throughput: sums.throughput / count,
    }
  }

  private generateOptimizationRecommendations(
    recent: Partial<PerformanceMetrics>,
    older: Partial<PerformanceMetrics>,
  ): string[] {
    const recommendations: string[] = []

    // Response time analysis
    if (recent.responseTime > this.config.alertThresholds.responseTime) {
      const degradation =
        ((recent.responseTime - older.responseTime) / older.responseTime) * 100
      if (degradation > 10) {
        recommendations.push(
          `Response time degraded by ${degradation.toFixed(1)}% - consider caching optimization`,
        )
      }
    }

    // Memory usage analysis
    if (recent.memoryUsage > this.config.alertThresholds.memoryUsage) {
      recommendations.push(
        'Memory usage above threshold - consider garbage collection optimization',
      )
    }

    // CPU usage analysis
    if (recent.cpuUsage > this.config.alertThresholds.cpuUsage) {
      recommendations.push('High CPU usage detected - consider load balancing')
    }

    // Error rate analysis
    if (recent.errorRate > this.config.alertThresholds.errorRate) {
      recommendations.push('Elevated error rate - review recent deployments')
    }

    return recommendations
  }

  private calculateExpectedImprovement(
    recommendations: string[],
  ): Record<string, number> {
    // Estimate improvement from applying recommendations
    const improvement: Record<string, number> = {
      responseTime: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      errorRate: 0,
    }

    recommendations.forEach((rec) => {
      if (rec.includes('caching')) improvement.responseTime -= 20
      if (rec.includes('garbage collection')) improvement.memoryUsage -= 15
      if (rec.includes('load balancing')) improvement.cpuUsage -= 25
      if (rec.includes('error rate')) improvement.errorRate -= 50
    })

    return improvement
  }

  private checkAlerts(): void {
    if (this.metrics.length === 0) return

    const latest = this.metrics[this.metrics.length - 1]

    // Check response time
    if (latest.responseTime > this.config.alertThresholds.responseTime) {
      this.createAlert(
        'warning',
        'responseTime',
        latest.responseTime,
        this.config.alertThresholds.responseTime,
        `Response time ${latest.responseTime.toFixed(1)}ms exceeds threshold ${this.config.alertThresholds.responseTime}ms`,
      )
    }

    // Check memory usage
    if (latest.memoryUsage > this.config.alertThresholds.memoryUsage) {
      this.createAlert(
        'critical',
        'memoryUsage',
        latest.memoryUsage,
        this.config.alertThresholds.memoryUsage,
        `Memory usage ${latest.memoryUsage.toFixed(1)}% exceeds threshold ${this.config.alertThresholds.memoryUsage}%`,
      )
    }

    // Check CPU usage
    if (latest.cpuUsage > this.config.alertThresholds.cpuUsage) {
      this.createAlert(
        'warning',
        'cpuUsage',
        latest.cpuUsage,
        this.config.alertThresholds.cpuUsage,
        `CPU usage ${latest.cpuUsage.toFixed(1)}% exceeds threshold ${this.config.alertThresholds.cpuUsage}%`,
      )
    }

    // Check error rate
    if (latest.errorRate > this.config.alertThresholds.errorRate) {
      this.createAlert(
        'critical',
        'errorRate',
        latest.errorRate,
        this.config.alertThresholds.errorRate,
        `Error rate ${latest.errorRate.toFixed(2)}% exceeds threshold ${this.config.alertThresholds.errorRate}%`,
      )
    }
  }

  private createAlert(
    type: 'warning' | 'critical' | 'info',
    metric: string,
    value: number,
    threshold: number,
    message: string,
  ): void {
    const alert: PerformanceAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type,
      metric,
      value,
      threshold,
      message,
      timestamp: new Date(),
      resolved: false,
    }

    this.alerts.push(alert)

    // Notify listeners
    const callbacks = this.alertCallbacks.get(type) || []
    callbacks.forEach((callback) => callback(alert))

    console.log(`Performance alert [${type.toUpperCase()}]: ${message}`)
  }

  /**
   * Subscribe to performance alerts
   */
  onAlert(
    type: 'warning' | 'critical' | 'info',
    callback: (alert: PerformanceAlert) => void,
  ): () => void {
    if (!this.alertCallbacks.has(type)) {
      this.alertCallbacks.set(type, [])
    }

    this.alertCallbacks.get(type)!.push(callback)

    // Return unsubscribe function
    return () => {
      const callbacks = this.alertCallbacks.get(type) || []
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0
      ? this.metrics[this.metrics.length - 1]
      : null
  }

  /**
   * Get performance trends over time
   */
  getPerformanceTrends(hours: number = 24): {
    responseTime: { trend: 'up' | 'down' | 'stable'; change: number }
    memoryUsage: { trend: 'up' | 'down' | 'stable'; change: number }
    cpuUsage: { trend: 'up' | 'down' | 'stable'; change: number }
    errorRate: { trend: 'up' | 'down' | 'stable'; change: number }
  } {
    const cutoff = Date.now() - hours * 60 * 60 * 1000
    const recentMetrics = this.metrics.filter(
      (m) => m.timestamp.getTime() > cutoff,
    )

    if (recentMetrics.length < 2) {
      return {
        responseTime: { trend: 'stable', change: 0 },
        memoryUsage: { trend: 'stable', change: 0 },
        cpuUsage: { trend: 'stable', change: 0 },
        errorRate: { trend: 'stable', change: 0 },
      }
    }

    const firstHalf = recentMetrics.slice(
      0,
      Math.floor(recentMetrics.length / 2),
    )
    const secondHalf = recentMetrics.slice(Math.floor(recentMetrics.length / 2))

    const firstAvg = this.calculateAverageMetrics(firstHalf)
    const secondAvg = this.calculateAverageMetrics(secondHalf)

    const calculateTrend = (first: number, second: number) => {
      const change = ((second - first) / first) * 100
      if (change > 5) return { trend: 'up' as const, change }
      if (change < -5) return { trend: 'down' as const, change }
      return { trend: 'stable' as const, change: 0 }
    }

    return {
      responseTime: calculateTrend(
        firstAvg.responseTime,
        secondAvg.responseTime,
      ),
      memoryUsage: calculateTrend(firstAvg.memoryUsage, secondAvg.memoryUsage),
      cpuUsage: calculateTrend(firstAvg.cpuUsage, secondAvg.cpuUsage),
      errorRate: calculateTrend(firstAvg.errorRate, secondAvg.errorRate),
    }
  }

  /**
   * Get system health assessment
   */
  getSystemHealth(): SystemHealth {
    const current = this.getCurrentMetrics()
    if (!current) {
      return {
        overall: 'unknown',
        components: {},
        recommendations: ['Insufficient data for health assessment'],
      }
    }

    const components: Record<string, any> = {
      api: {
        status:
          current.responseTime < this.config.alertThresholds.responseTime
            ? 'healthy'
            : 'warning',
        responseTime: current.responseTime,
        errorRate: current.errorRate,
        lastCheck: current.timestamp,
      },
      database: {
        status:
          current.memoryUsage < this.config.alertThresholds.memoryUsage
            ? 'healthy'
            : 'warning',
        responseTime: current.responseTime * 0.3, // Mock database response time
        errorRate: current.errorRate * 0.1, // Mock database error rate
        lastCheck: current.timestamp,
      },
      realtime: {
        status:
          current.cpuUsage < this.config.alertThresholds.cpuUsage
            ? 'healthy'
            : 'critical',
        responseTime: current.responseTime * 0.1, // Mock real-time response time
        errorRate: current.errorRate * 0.05, // Mock real-time error rate
        lastCheck: current.timestamp,
      },
    }

    // Determine overall health
    const criticalComponents = Object.values(components).filter(
      (c) => c.status === 'critical',
    ).length
    const warningComponents = Object.values(components).filter(
      (c) => c.status === 'warning',
    ).length

    let overall: 'healthy' | 'warning' | 'critical' | 'unknown' = 'healthy'
    if (criticalComponents > 0) {
      overall = 'critical'
    } else if (warningComponents > 1) {
      overall = 'warning'
    }

    // Generate recommendations
    const recommendations: string[] = []
    if (current.responseTime > this.config.optimizationTargets.responseTime) {
      recommendations.push(
        'Optimize API response times through caching and database indexing',
      )
    }
    if (current.memoryUsage > this.config.optimizationTargets.memoryUsage) {
      recommendations.push(
        'Reduce memory usage through code optimization and garbage collection',
      )
    }
    if (current.cpuUsage > this.config.optimizationTargets.cpuUsage) {
      recommendations.push('Consider load balancing and horizontal scaling')
    }

    return {
      overall,
      components,
      recommendations,
    }
  }

  /**
   * Get performance analytics
   */
  getPerformanceAnalytics(): {
    summary: {
      averageResponseTime: number
      averageMemoryUsage: number
      averageCpuUsage: number
      totalAlerts: number
      uptime: number
    }
    trends: ReturnType<typeof this.getPerformanceTrends>
    optimizationHistory: OptimizationRecommendation[]
    recommendations: string[]
  } {
    const recentMetrics = this.metrics.slice(-100) // Last 100 measurements

    if (recentMetrics.length === 0) {
      return {
        summary: {
          averageResponseTime: 0,
          averageMemoryUsage: 0,
          averageCpuUsage: 0,
          totalAlerts: 0,
          uptime: 0,
        },
        trends: this.getPerformanceTrends(),
        optimizationHistory: [],
        recommendations: ['No data available for analysis'],
      }
    }

    const avgMetrics = this.calculateAverageMetrics(recentMetrics)

    // Calculate uptime (mock calculation)
    const totalTime = recentMetrics.length * this.config.monitoringInterval
    const healthyTime =
      recentMetrics.filter(
        (m) =>
          m.responseTime < this.config.alertThresholds.responseTime &&
          m.memoryUsage < this.config.alertThresholds.memoryUsage,
      ).length * this.config.monitoringInterval

    const uptime = (healthyTime / totalTime) * 100

    return {
      summary: {
        averageResponseTime: avgMetrics.responseTime,
        averageMemoryUsage: avgMetrics.memoryUsage,
        averageCpuUsage: avgMetrics.cpuUsage,
        totalAlerts: this.alerts.filter((a) => !a.resolved).length,
        uptime,
      },
      trends: this.getPerformanceTrends(),
      optimizationHistory: this.optimizationHistory.slice(-10), // Last 10 optimizations
      recommendations: this.generateOverallRecommendations(),
    }
  }

  private generateOverallRecommendations(): string[] {
    const recommendations: string[] = []
    const trends = this.getPerformanceTrends()

    if (trends.responseTime.trend === 'up') {
      recommendations.push(
        'Response time is increasing - investigate recent changes',
      )
    }
    if (trends.memoryUsage.trend === 'up') {
      recommendations.push('Memory usage trending up - consider optimization')
    }
    if (trends.errorRate.trend === 'up') {
      recommendations.push('Error rate increasing - review error logs')
    }

    const health = this.getSystemHealth()
    recommendations.push(...health.recommendations)

    return recommendations
  }

  /**
   * Manual performance measurement
   */
  async measurePerformance(operation: () => Promise<any>): Promise<{
    duration: number
    memoryBefore: number
    memoryAfter: number
    memoryDelta: number
    result: any
  }> {
    const memoryBefore = await this.measureMemoryUsage()
    const startTime = performance.now()

    const result = await operation()

    const duration = performance.now() - startTime
    const memoryAfter = await this.measureMemoryUsage()
    const memoryDelta = memoryAfter - memoryBefore

    return {
      duration,
      memoryBefore,
      memoryAfter,
      memoryDelta,
      result,
    }
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string, resolution: string): boolean {
    const alert = this.alerts.find((a) => a.id === alertId)
    if (!alert) return false

    alert.resolved = true
    alert.resolution = resolution
    return true
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter((alert) => !alert.resolved)
  }

  /**
   * Export performance data
   */
  exportPerformanceData(format: 'json' | 'csv' = 'json'): string {
    const exportData = {
      config: this.config,
      metrics: this.metrics.slice(-100), // Last 100 metrics
      alerts: this.alerts,
      optimizationHistory: this.optimizationHistory,
      exportedAt: new Date(),
    }

    if (format === 'json') {
      return JSON.stringify(exportData, null, 2)
    } else {
      // CSV format for metrics
      const headers = [
        'timestamp',
        'responseTime',
        'memoryUsage',
        'cpuUsage',
        'errorRate',
        'throughput',
      ]
      const rows = this.metrics.map((m) => [
        m.timestamp.toISOString(),
        m.responseTime.toString(),
        m.memoryUsage.toString(),
        m.cpuUsage.toString(),
        m.errorRate.toString(),
        m.throughput.toString(),
      ])

      return [headers, ...rows].map((row) => row.join(',')).join('\n')
    }
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor()

// Export class for custom instances
export { PerformanceMonitor }
export default performanceMonitor
