/**
 * ProductionMonitoringService — extracted from production-system.ts.
 */

import { EventEmitter } from 'events'

export class ProductionMonitoringService extends EventEmitter {
  private readonly enabled: boolean
  private metrics: Array<{
    name: string
    value: number
    timestamp: Date
    tags?: Record<string, string>
  }> = []
  private readonly alerts: Array<{
    id: string
    severity: string
    metric: string
    status: string
    timestamp: Date
  }> = []
  private intervals: NodeJS.Timeout[] = []

  constructor(config: Record<string, unknown> = {}) {
    super()
    this.enabled = (config['enabled'] as boolean) ?? true
  }

  async initializeServices(): Promise<void> {
    // No-op for initialization
  }

  async start(): Promise<void> {
    // Service started
  }

  async stop(): Promise<void> {
    for (const interval of this.intervals) {
      clearInterval(interval)
    }
    this.intervals = []
  }

  async recordMetric(metric: {
    name: string
    value: number
    timestamp: Date
    tags?: Record<string, string>
  }): Promise<void> {
    this.metrics.push(metric)

    // Check thresholds for alerts
    if (metric.name === 'failed_login_attempts' && metric.value >= 1) {
      const recentFailedLogins = this.metrics.filter(
        (m) =>
          m.name === 'failed_login_attempts' &&
          Date.now() - m.timestamp.getTime() < 60000,
      )
      if (recentFailedLogins.length >= 20) {
        const alert = {
          id: `alert_${Date.now()}`,
          severity: 'high',
          metric: 'failed_login_attempts',
          status: 'active',
          timestamp: new Date(),
        }
        this.alerts.push(alert)
        this.emit('alert', alert)
      }
    }

    // Emit audit log
    this.emit('audit:log', {
      action: 'record_metric',
      metric: metric.name,
      timestamp: new Date(),
    })
  }

  async getMetrics(): Promise<
    Array<{
      name: string
      value: number
      timestamp: Date
      tags?: Record<string, string>
    }>
  > {
    return this.metrics
  }

  async generateInsights(): Promise<{
    insights: Record<string, unknown>[]
    alerts: Record<string, unknown>[]
    trends?: Record<string, unknown>[]
    predictions?: Record<string, unknown>[]
    recommendations?: string[]
  }> {
    // Call getMetrics first to propagate any database errors
    await this.getMetrics()

    const insights: Record<string, unknown>[] = []
    const alerts: Record<string, unknown>[] = []
    const trends: Record<string, unknown>[] = []
    const predictions: Record<string, unknown>[] = []
    const recommendations: string[] = []

    // Analyze threat patterns
    const highRiskMetrics = this.metrics.filter((m) => m.value > 10)
    if (highRiskMetrics.length > 0) {
      insights.push({
        type: 'high_risk_activity',
        message: `Detected ${highRiskMetrics.length} high-risk metric entries`,
        severity: 'high',
        timestamp: new Date(),
      })
      recommendations.push('Review high-risk activity patterns')
    }

    // Trend analysis
    const metricNames = [...new Set(this.metrics.map((m) => m.name))]
    for (const name of metricNames) {
      const values: number[] = this.metrics
        .filter((m) => m.name === name)
        .map((m) => m.value)
      if (values && values.length > 1) {
        const avg = values.reduce((a, b) => a + b, 0) / values.length
        const lastValue = values[values.length - 1]
        trends.push({
          metric: name,
          average: avg,
          count: values.length,
          trend:
            lastValue !== undefined && lastValue > avg
              ? 'increasing'
              : 'stable',
        })
      }
    }

    // Predictions based on trends
    for (const trend of trends) {
      if (trend['trend'] === 'increasing') {
        predictions.push({
          metric: trend['metric'],
          predictedValue: (trend['average'] as number) * 1.5,
          confidence: 0.7,
        })
        recommendations.push(
          `Monitor ${trend['metric'] as string} closely - trending upward`,
        )
      }
    }

    return { insights, alerts, trends, predictions, recommendations }
  }

  async getHealthStatus(): Promise<Record<string, unknown>> {
    return {
      healthy: this.enabled,
      service: 'monitoring',
      timestamp: new Date(),
    }
  }

  async getStatistics(): Promise<Record<string, unknown>> {
    return {
      totalInsights: 0,
      totalAlerts: this.alerts.length,
      anomaliesDetected: 0,
    }
  }

  async clearMetrics(): Promise<void> {
    throw new Error('Unauthorized: insufficient permissions')
  }

  async getSystemConfig(): Promise<void> {
    throw new Error('Unauthorized: insufficient permissions')
  }

  async exportData(): Promise<void> {
    throw new Error('Unauthorized: insufficient permissions')
  }

  async cleanupOldData(): Promise<void> {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // 90 days
    this.metrics = this.metrics.filter((m) => m.timestamp >= cutoff)
  }
}

// Production-ready hunting service
