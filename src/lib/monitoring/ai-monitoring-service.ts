import { Redis } from 'ioredis'
import { OpenAI } from 'openai'
import { EventEmitter } from 'events'

export interface Alert {
  id: string
  timestamp: Date
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: string
  title: string
  description: string
  metrics: Record<string, number>
  source: string
  aiInsights?: string
  recommendations?: string[]
}

export interface AnomalyDetectionConfig {
  enabled: boolean
  sensitivity: 'low' | 'medium' | 'high'
  windowSize: number // in minutes
  threshold: number
  patterns: string[]
}

export interface AlertingConfig {
  enabled: boolean
  channels: {
    slack?: boolean
    email?: boolean
    webhook?: boolean
  }
  escalation: {
    critical: number // minutes before escalation
    high: number
    medium: number
  }
}

export interface MonitoringConfig {
  anomalyDetection: AnomalyDetectionConfig
  alerting: AlertingConfig
  aiAnalysis: {
    enabled: boolean
    model: string
    maxTokens: number
  }
}

export class AIMonitoringService extends EventEmitter {
  private redis: Redis
  private openai: OpenAI
  private config: MonitoringConfig
  private activeAlerts: Map<string, Alert> = new Map()
  private metricsHistory: Map<string, number[]> = new Map()
  private isRunning = false

  constructor(redis: Redis, openai: OpenAI, config: MonitoringConfig) {
    super()
    this.redis = redis
    this.openai = openai
    this.config = config
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return
    }

    this.isRunning = true
    this.emit('started')

    // Start monitoring loop
    this.monitoringLoop()

    // Subscribe to Redis pub/sub for real-time metrics
    this.redis.subscribe('metrics:updates', (err) => {
      if (err) {
        this.emit('error', err)
      }
    })

    this.redis.on('message', (channel, message) => {
      if (channel === 'metrics:updates') {
        this.handleMetricUpdate(JSON.parse(message))
      }
    })
  }

  async stop(): Promise<void> {
    this.isRunning = false
    this.emit('stopped')
  }

  private async monitoringLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.analyzeMetrics()
        await this.checkAnomalies()
        await this.generateAIInsights()

        // Sleep for 30 seconds
        await new Promise((resolve) => setTimeout(resolve, 30000))
      } catch (error) {
        this.emit('error', error)
        await new Promise((resolve) => setTimeout(resolve, 5000))
      }
    }
  }

  private async handleMetricUpdate(metricData: unknown): Promise<void> {
    // Type guard to ensure metricData has the expected structure
    if (typeof metricData !== 'object' || metricData === null) {
      throw new Error('Invalid metric data format')
    }

    const data = metricData as Record<string, unknown>
    const { metric, value, timestamp, tags } = data as {
      metric: string
      value: number
      timestamp: number
      tags?: string[]
    }

    // Store in metrics history
    if (!this.metricsHistory.has(metric)) {
      this.metricsHistory.set(metric, [])
    }

    const history = this.metricsHistory.get(metric)!
    history.push(value)

    // Keep only last 1000 values
    if (history.length > 1000) {
      history.shift()
    }

    // Emit metric update event
    this.emit('metricUpdate', { metric, value, timestamp, tags })
  }

  private async analyzeMetrics(): Promise<void> {
    // Analyze each metric
    for (const [metric, history] of this.metricsHistory) {
      if (history.length < 10) {
        continue // Need enough data points
      }

      const recentValues = history.slice(-Math.min(50, history.length))
      const avg =
        recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length
      const stdDev = Math.sqrt(
        recentValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) /
          recentValues.length,
      )

      // Check for anomalies
      const latestValue = history[history.length - 1]
      const zScore = Math.abs((latestValue - avg) / stdDev)

      if (zScore > this.config.anomalyDetection.threshold) {
        await this.createAnomalyAlert(metric, latestValue, avg, zScore)
      }
    }
  }

  private async checkAnomalies(): Promise<void> {
    // Check for pattern-based anomalies
    const { patterns } = this.config.anomalyDetection

    for (const pattern of patterns) {
      const matchingMetrics = Array.from(this.metricsHistory.keys()).filter(
        (metric) => metric.includes(pattern),
      )

      for (const metric of matchingMetrics) {
        const history = this.metricsHistory.get(metric)!
        if (history.length < 5) {
          continue
        }

        // Check for sudden spikes or drops
        const recent = history.slice(-5)
        const older = history.slice(-10, -5)

        if (older.length === 0) {
          continue
        }

        const recentAvg =
          recent.reduce((sum, val) => sum + val, 0) / recent.length
        const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length

        const changeRatio = Math.abs(recentAvg - olderAvg) / olderAvg

        if (changeRatio > 0.5) {
          // 50% change
          await this.createPatternAlert(
            metric,
            recentAvg,
            olderAvg,
            changeRatio,
          )
        }
      }
    }
  }

  private async createAnomalyAlert(
    metric: string,
    value: number,
    expected: number,
    zScore: number,
  ): Promise<void> {
    const severity = this.calculateSeverity(zScore)
    const alert: Alert = {
      id: `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      severity,
      category: 'anomaly',
      title: `Anomaly detected in ${metric}`,
      description: `Value ${value} is ${zScore.toFixed(2)} standard deviations from expected (${expected.toFixed(2)})`,
      metrics: { [metric]: value, zScore, expected },
      source: 'ai-monitoring',
    }

    await this.processAlert(alert)
  }

  private async createPatternAlert(
    metric: string,
    recentAvg: number,
    olderAvg: number,
    changeRatio: number,
  ): Promise<void> {
    const severity = this.calculateSeverityFromChange(changeRatio)
    const alert: Alert = {
      id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      severity,
      category: 'pattern',
      title: `Pattern change detected in ${metric}`,
      description: `Average changed from ${olderAvg.toFixed(2)} to ${recentAvg.toFixed(2)} (${(changeRatio * 100).toFixed(1)}% change)`,
      metrics: { [metric]: recentAvg, changeRatio, olderAvg },
      source: 'ai-monitoring',
    }

    await this.processAlert(alert)
  }

  private calculateSeverity(zScore: number): Alert['severity'] {
    if (zScore > 3) {
      return 'critical'
    }
    if (zScore > 2.5) {
      return 'high'
    }
    if (zScore > 2) {
      return 'medium'
    }
    return 'low'
  }

  private calculateSeverityFromChange(changeRatio: number): Alert['severity'] {
    if (changeRatio > 1.0) {
      return 'critical'
    } // 100%+ change
    if (changeRatio > 0.75) {
      return 'high'
    } // 75%+ change
    if (changeRatio > 0.5) {
      return 'medium'
    } // 50%+ change
    return 'low'
  }

  private async generateAIInsights(): Promise<void> {
    if (!this.config.aiAnalysis.enabled) {
      return
    }

    // Get recent alerts
    const recentAlerts = Array.from(this.activeAlerts.values())
      .filter(
        (alert) => Date.now() - alert.timestamp.getTime() < 24 * 60 * 60 * 1000,
      ) // Last 24 hours
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    if (recentAlerts.length === 0) {
      return
    }

    try {
      const prompt = `
        Analyze the following monitoring alerts and provide insights:

        ${recentAlerts
          .map(
            (alert) => `
          Alert: ${alert.title}
          Severity: ${alert.severity}
          Description: ${alert.description}
          Metrics: ${JSON.stringify(alert.metrics, null, 2)}
        `,
          )
          .join('\n')}

        Provide:
        1. Overall assessment of the system health
        2. Potential root causes for the alerts
        3. Recommended actions
        4. Future prevention strategies
      `

      const response = await this.openai.chat.completions.create({
        model: this.config.aiAnalysis.model,
        messages: [
          {
            role: 'system',
            content:
              'You are an AI monitoring assistant that analyzes system alerts and provides actionable insights.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: this.config.aiAnalysis.maxTokens,
        temperature: 0.7,
      })

      const insights =
        response.choices[0]?.message?.content || 'No insights generated'

      // Update alerts with AI insights
      for (const alert of recentAlerts) {
        alert.aiInsights = insights
        alert.recommendations = this.extractRecommendations(insights)
      }

      this.emit('aiInsights', { insights, alertCount: recentAlerts.length })
    } catch (error) {
      this.emit('error', error)
    }
  }

  private extractRecommendations(insights: string): string[] {
    const recommendations: string[] = []
    const lines = insights.split('\n')

    for (const line of lines) {
      if (
        line.toLowerCase().includes('recommend') ||
        line.toLowerCase().includes('should') ||
        line.toLowerCase().includes('action')
      ) {
        recommendations.push(line.trim())
      }
    }

    return recommendations.slice(0, 5) // Limit to top 5 recommendations
  }

  private async processAlert(alert: Alert): Promise<void> {
    // Store alert
    this.activeAlerts.set(alert.id, alert)

    // Emit alert event
    this.emit('alert', alert)

    // Send notifications based on severity
    if (this.config.alerting.enabled) {
      await this.sendNotifications(alert)
    }

    // Store in Redis for persistence
    await this.redis.setex(
      `alert:${alert.id}`,
      7 * 24 * 60 * 60, // 7 days
      JSON.stringify(alert),
    )

    // Check for escalation
    this.checkEscalation(alert)
  }

  private async sendNotifications(alert: Alert): Promise<void> {
    const notifications = []

    if (this.config.alerting.channels.slack) {
      notifications.push(this.sendSlackNotification(alert))
    }

    if (this.config.alerting.channels.email) {
      notifications.push(this.sendEmailNotification(alert))
    }

    if (this.config.alerting.channels.webhook) {
      notifications.push(this.sendWebhookNotification(alert))
    }

    await Promise.allSettled(notifications)
  }

  private async sendSlackNotification(alert: Alert): Promise<void> {
    // Implementation for Slack notifications
    this.emit('notification', { type: 'slack', alert })
  }

  private async sendEmailNotification(alert: Alert): Promise<void> {
    // Implementation for email notifications
    this.emit('notification', { type: 'email', alert })
  }

  private async sendWebhookNotification(alert: Alert): Promise<void> {
    // Implementation for webhook notifications
    this.emit('notification', { type: 'webhook', alert })
  }

  private checkEscalation(alert: Alert): void {
    const escalationTime = this.config.alerting.escalation[alert.severity]
    if (escalationTime > 0) {
      setTimeout(
        () => {
          this.emit('escalation', alert)
        },
        escalationTime * 60 * 1000,
      )
    }
  }

  // Public methods
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values())
  }

  getMetricsHistory(metric: string): number[] {
    return this.metricsHistory.get(metric) || []
  }

  updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig }
    this.emit('configUpdated', this.config)
  }
}
