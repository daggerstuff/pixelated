/**
 * AI-Enhanced Monitoring and Alerting System
 * Provides real-time monitoring with AI-powered insights and intelligent alerting
 */

import { EventEmitter } from 'events'
import { Redis } from 'ioredis'
import { MongoClient } from 'mongodb'
import * as tf from '@tensorflow/tfjs'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'
// Removed unused type imports to satisfy lint rules

const logger = createBuildSafeLogger('ai-enhanced-monitoring')

export interface MonitoringConfig {
  enabled: boolean
  aiInsightsEnabled: boolean
  alertThresholds: {
    critical: number
    high: number
    medium: number
    low: number
  }
  monitoringIntervals: {
    realTime: number
    batch: number
    anomalyDetection: number
  }
  notificationChannels: NotificationChannelConfig[]
  aiModelConfig: {
    modelPath: string
    confidenceThreshold: number
    predictionWindow: number
  }
}

export interface NotificationChannelConfig {
  name: string
  type: 'email' | 'slack' | 'webhook' | 'sms' | 'dashboard'
  enabled: boolean
  priority: number
  config: Record<string, unknown>
}

export interface SecurityMetrics {
  timestamp: Date
  threatCount: number
  blockedRequests: number
  anomalyScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  topThreats: string[]
  systemHealth: {
    cpu: number
    memory: number
    responseTime: number
    errorRate: number
  }
}

export interface AIInsight {
  insightId: string
  type: 'anomaly' | 'trend' | 'prediction' | 'recommendation'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  confidence: number
  dataPoints: Record<string, unknown>
  recommendedActions: string[]
  timestamp: Date
}

export interface Alert {
  alertId: string
  type: 'threat' | 'anomaly' | 'system' | 'ai_insight'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  source: string
  metrics: SecurityMetrics
  aiInsights?: AIInsight[]
  notifiedChannels: string[]
  acknowledged: boolean
  createdAt: Date
  updatedAt: Date
}

export class AIEnhancedMonitoringService extends EventEmitter {
  private redis!: Redis
  private mongoClient!: MongoClient
  private config: MonitoringConfig
  private anomalyDetectionModel: tf.Sequential | null = null
  private metricsBuffer: SecurityMetrics[] = []
  private alertBuffer: Alert[] = []
  private monitoringIntervals: NodeJS.Timeout[] = []
  private isMonitoring: boolean = false

  constructor(config: MonitoringConfig) {
    super()
    this.config = config
    this.initializeServices()
  }

  private async initializeServices(): Promise<void> {
    try {
      this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
      this.mongoClient = new MongoClient(
        process.env.MONGODB_URI || 'mongodb://localhost:27017/threat_detection',
      )

      await this.mongoClient.connect()

      if (this.config.aiInsightsEnabled) {
        await this.initializeAIModel()
      }

      logger.info('AI-enhanced monitoring service initialized')
      this.emit('monitoring_initialized')
    } catch (error) {
      logger.error('Failed to initialize monitoring service:', { error })
      throw error
    }
  }

  private async initializeAIModel(): Promise<void> {
    try {
      // Initialize anomaly detection model
      this.anomalyDetectionModel = tf.sequential({
        layers: [
          tf.layers.dense({ units: 64, activation: 'relu', inputShape: [10] }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({ units: 32, activation: 'relu' }),
          tf.layers.dense({ units: 16, activation: 'relu' }),
          tf.layers.dense({ units: 1, activation: 'sigmoid' }),
        ],
      })

      this.anomalyDetectionModel.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy'],
      })

      logger.info('AI anomaly detection model initialized')
    } catch (error) {
      logger.error('Failed to initialize AI model:', { error })
      // Continue without AI model if initialization fails
      this.anomalyDetectionModel = null
    }
  }

  /**
   * Start monitoring with AI-enhanced insights
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      logger.warn('Monitoring is already running')
      return
    }

    try {
      this.isMonitoring = true

      // Start real-time monitoring
      this.startRealTimeMonitoring()

      // Start batch monitoring
      this.startBatchMonitoring()

      // Start anomaly detection if AI is enabled
      if (this.config.aiInsightsEnabled && this.anomalyDetectionModel) {
        this.startAnomalyDetection()
      }

      logger.info('AI-enhanced monitoring started')
      this.emit('monitoring_started')
    } catch (error) {
      logger.error('Failed to start monitoring:', { error })
      throw error
    }
  }

  /**
   * Stop monitoring
   */
  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) {
      logger.warn('Monitoring is not running')
      return
    }

    try {
      this.isMonitoring = false

      // Clear all monitoring intervals
      this.monitoringIntervals.forEach((interval) => clearInterval(interval))
      this.monitoringIntervals = []

      logger.info('AI-enhanced monitoring stopped')
      this.emit('monitoring_stopped')
    } catch (error) {
      logger.error('Failed to stop monitoring:', { error })
      throw error
    }
  }

  /**
   * Collect and analyze security metrics with AI insights
   */
  async collectSecurityMetrics(): Promise<SecurityMetrics> {
    try {
      // Collect raw metrics from various sources
      const rawMetrics = await this.collectRawMetrics()

      // Process metrics
      const processedMetrics = await this.processMetrics(rawMetrics)

      // Generate AI insights if enabled
      let aiInsights: AIInsight[] = []
      if (this.config.aiInsightsEnabled && this.anomalyDetectionModel) {
        aiInsights = await this.generateAIInsights(processedMetrics)
      }

      // Store metrics
      await this.storeMetrics(processedMetrics, aiInsights)

      // Check for alerts
      await this.checkForAlerts(processedMetrics, aiInsights)

      this.emit('metrics_collected', { metrics: processedMetrics, aiInsights })

      return processedMetrics
    } catch (error) {
      logger.error('Failed to collect security metrics:', { error })
      throw error
    }
  }

  private async collectRawMetrics(): Promise<Record<string, unknown>> {
    try {
      // Collect metrics from Redis
      const redisMetrics = await this.collectRedisMetrics()

      // Collect metrics from MongoDB
      const dbMetrics = await this.collectDatabaseMetrics()

      // Collect system metrics
      const systemMetrics = await this.collectSystemMetrics()

      // Collect threat detection metrics
      const threatMetrics = await this.collectThreatMetrics()

      return {
        redis: redisMetrics,
        database: dbMetrics,
        system: systemMetrics,
        threats: threatMetrics,
        timestamp: new Date(),
      }
    } catch (error) {
      logger.error('Failed to collect raw metrics:', { error })
      throw error
    }
  }

  private async collectRedisMetrics(): Promise<Record<string, unknown>> {
    try {
      const info = await this.redis.info()
      // Prefixed with '_' because the returned memory usage value is not used directly
      // but may be useful for future enhancements. This avoids lint errors for unused vars.
      const _memory = await this.redis.memory('USAGE', '*')

      return {
        connectedClients: parseInt(
          info.match(/connected_clients:(\d+)/)?.[1] || '0',
        ),
        usedMemory: parseInt(info.match(/used_memory:(\d+)/)?.[1] || '0'),
        keyspaceHits: parseInt(info.match(/keyspace_hits:(\d+)/)?.[1] || '0'),
        keyspaceMisses: parseInt(
          info.match(/keyspace_misses:(\d+)/)?.[1] || '0',
        ),
        commandsProcessed: parseInt(
          info.match(/total_commands_processed:(\d+)/)?.[1] || '0',
        ),
      }
    } catch (error) {
      logger.error('Failed to collect Redis metrics:', { error })
      return {}
    }
  }

  private async collectDatabaseMetrics(): Promise<Record<string, unknown>> {
    try {
      const db = this.mongoClient.db('threat_detection')

      // Count recent threats
      const recentThreats = await db
        .collection('threat_responses')
        .countDocuments({
          createdAt: { $gte: new Date(Date.now() - 3600000) }, // Last hour
        })

      // Count total threats
      const totalThreats = await db
        .collection('threat_responses')
        .countDocuments()

      // Count blocked requests
      const blockedRequests = await db
        .collection('threat_responses')
        .countDocuments({
          'actions.actionType': 'block',
          'createdAt': { $gte: new Date(Date.now() - 3600000) },
        })

      return {
        recentThreats,
        totalThreats,
        blockedRequests,
        databaseSize: await db.stats().then((stats) => stats.dataSize),
      }
    } catch (error) {
      logger.error('Failed to collect database metrics:', { error })
      return {}
    }
  }

  private async collectSystemMetrics(): Promise<Record<string, unknown>> {
    try {
      // Get system metrics (simplified for this implementation)
      const cpuUsage = process.cpuUsage()
      const memoryUsage = process.memoryUsage()

      return {
        cpu: cpuUsage.user / 1000000, // Convert to seconds
        memory: memoryUsage.heapUsed / 1024 / 1024, // Convert to MB
        uptime: process.uptime(),
        nodeVersion: process.version,
      }
    } catch (error) {
      logger.error('Failed to collect system metrics:', { error })
      return {}
    }
  }

  private async collectThreatMetrics(): Promise<Record<string, unknown>> {
    try {
      const db = this.mongoClient.db('threat_detection')

      // Get threat severity distribution
      const severityDistribution = await db
        .collection('threat_responses')
        .aggregate([
          {
            $group: {
              _id: '$severity',
              count: { $sum: 1 },
            },
          },
        ])
        .toArray()

      // Get top threat sources
      const topThreats = await db
        .collection('threat_responses')
        .aggregate([
          {
            $group: {
              _id: '$source',
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 5 },
        ])
        .toArray()

      return {
        severityDistribution,
        topThreats: topThreats.map((t) => t._id),
        totalThreats: severityDistribution.reduce(
          (sum, item) => sum + item.count,
          0,
        ),
      }
    } catch (error) {
      logger.error('Failed to collect threat metrics:', { error })
      return {}
    }
  }

  private async processMetrics(
    rawMetrics: Record<string, unknown>,
  ): Promise<SecurityMetrics> {
    try {
      const threats = rawMetrics.threats as Record<string, unknown>
      const system = rawMetrics.system as Record<string, unknown>
      const redis = rawMetrics.redis as Record<string, unknown>

      // Calculate anomaly score using AI if available
      let anomalyScore = 0
      if (this.anomalyDetectionModel) {
        anomalyScore = await this.calculateAnomalyScore(rawMetrics)
      }

      // Determine risk level
      const riskLevel = this.determineRiskLevel(threats, anomalyScore)

      return {
        timestamp: new Date(),
        threatCount: (threats.totalThreats as number) || 0,
        blockedRequests: (threats.blockedRequests as number) || 0,
        anomalyScore,
        riskLevel,
        topThreats: (threats.topThreats as string[]) || [],
        systemHealth: {
          cpu: (system.cpu as number) || 0,
          memory: (system.memory as number) || 0,
          responseTime: (redis.commandsProcessed as number) || 0,
          errorRate: this.calculateErrorRate(threats),
        },
      }
    } catch (error) {
      logger.error('Failed to process metrics:', { error })
      throw error
    }
  }

  private async calculateAnomalyScore(
    metrics: Record<string, unknown>,
  ): Promise<number> {
    if (!this.anomalyDetectionModel) {
      return 0
    }

    try {
      // Extract features for anomaly detection
      const features = this.extractAnomalyFeatures(metrics)

      // Predict anomaly score
      const prediction = tf.tidy(() => {
        const inputTensor = tf.tensor2d([features])
        return this.anomalyDetectionModel!.predict(inputTensor) as tf.Tensor
      })
      const score = await prediction.data()
      prediction.dispose()
      return score[0]
    } catch (error) {
      logger.error('Failed to calculate anomaly score:', { error })
      return 0
    }
  }

  private extractAnomalyFeatures(metrics: Record<string, unknown>): number[] {
    const threats = metrics.threats as Record<string, unknown>
    const system = metrics.system as Record<string, unknown>
    const redis = metrics.redis as Record<string, unknown>

    return [
      (threats.totalThreats as number) || 0,
      (threats.blockedRequests as number) || 0,
      (system.cpu as number) || 0,
      (system.memory as number) || 0,
      (redis.connectedClients as number) || 0,
      (redis.usedMemory as number) || 0,
      (redis.keyspaceHits as number) || 0,
      (redis.keyspaceMisses as number) || 0,
      (redis.commandsProcessed as number) || 0,
      (Date.now() % 86400000) / 3600000, // Hour of day (0-24)
    ]
  }

  private determineRiskLevel(
    threats: Record<string, unknown>,
    anomalyScore: number,
  ): SecurityMetrics['riskLevel'] {
    const threatCount = (threats.totalThreats as number) || 0
    const blockedRequests = (threats.blockedRequests as number) || 0

    if (threatCount > 100 || blockedRequests > 50 || anomalyScore > 0.8) {
      return 'critical'
    } else if (threatCount > 50 || blockedRequests > 20 || anomalyScore > 0.6) {
      return 'high'
    } else if (threatCount > 10 || blockedRequests > 5 || anomalyScore > 0.4) {
      return 'medium'
    } else {
      return 'low'
    }
  }

  private calculateErrorRate(threats: Record<string, unknown>): number {
    // Simplified error rate calculation
    const totalThreats = (threats.totalThreats as number) || 0
    const blockedRequests = (threats.blockedRequests as number) || 0

    return totalThreats > 0 ? blockedRequests / totalThreats : 0
  }

  private async generateAIInsights(
    metrics: SecurityMetrics,
  ): Promise<AIInsight[]> {
    const insights: AIInsight[] = []

    try {
      // Generate anomaly insights
      if (metrics.anomalyScore > 0.7) {
        insights.push({
          insightId: `anomaly_${Date.now()}`,
          type: 'anomaly',
          severity: 'high',
          title: 'High Anomaly Score Detected',
          description: `Anomaly score of ${(metrics.anomalyScore * 100).toFixed(1)}% indicates unusual activity patterns.`,
          confidence: metrics.anomalyScore,
          dataPoints: { anomalyScore: metrics.anomalyScore },
          recommendedActions: [
            'investigate_recent_activity',
            'increase_monitoring',
          ],
          timestamp: new Date(),
        })
      }

      // Generate trend insights
      if (this.metricsBuffer.length > 10) {
        const trendInsight = await this.generateTrendInsight(metrics)
        if (trendInsight) {
          insights.push(trendInsight)
        }
      }

      // Generate prediction insights
      const predictionInsight = await this.generatePredictionInsight(metrics)
      if (predictionInsight) {
        insights.push(predictionInsight)
      }

      return insights
    } catch (error) {
      logger.error('Failed to generate AI insights:', { error })
      return []
    }
  }

  private async generateTrendInsight(
    currentMetrics: SecurityMetrics,
  ): Promise<AIInsight | null> {
    try {
      if (this.metricsBuffer.length < 5) {
        return null
      }

      // Analyze trend in threat count
      const recentThreats = this.metricsBuffer
        .slice(-5)
        .map((m) => m.threatCount)
      const avgThreats =
        recentThreats.reduce((sum, count) => sum + count, 0) /
        recentThreats.length

      if (currentMetrics.threatCount > avgThreats * 1.5) {
        return {
          insightId: `trend_${Date.now()}`,
          type: 'trend',
          severity: 'medium',
          title: 'Increasing Threat Activity',
          description: `Threat count increased by ${(((currentMetrics.threatCount - avgThreats) / avgThreats) * 100).toFixed(1)}% compared to recent average.`,
          confidence: 0.8,
          dataPoints: {
            currentThreats: currentMetrics.threatCount,
            averageThreats: avgThreats,
            increasePercentage:
              ((currentMetrics.threatCount - avgThreats) / avgThreats) * 100,
          },
          recommendedActions: [
            'review_security_policies',
            'update_threat_signatures',
          ],
          timestamp: new Date(),
        }
      }

      return null
    } catch (error) {
      logger.error('Failed to generate trend insight:', { error })
      return null
    }
  }

  private async generatePredictionInsight(
    metrics: SecurityMetrics,
  ): Promise<AIInsight | null> {
    try {
      // Simple prediction based on current metrics
      if (metrics.riskLevel === 'high' || metrics.riskLevel === 'critical') {
        return {
          insightId: `prediction_${Date.now()}`,
          type: 'prediction',
          severity: metrics.riskLevel === 'critical' ? 'critical' : 'high',
          title: 'Elevated Risk Predicted',
          description: `Based on current metrics, elevated risk level is likely to continue. Consider proactive security measures.`,
          confidence: metrics.anomalyScore,
          dataPoints: {
            currentRiskLevel: metrics.riskLevel,
            anomalyScore: metrics.anomalyScore,
          },
          recommendedActions: [
            'increase_monitoring',
            'review_access_controls',
            'prepare_incident_response',
          ],
          timestamp: new Date(),
        }
      }

      return null
    } catch (error) {
      logger.error('Failed to generate prediction insight:', { error })
      return null
    }
  }

  private async storeMetrics(
    metrics: SecurityMetrics,
    aiInsights: AIInsight[],
  ): Promise<void> {
    try {
      const db = this.mongoClient.db('threat_detection')

      // Store metrics
      await db.collection('security_metrics').insertOne({
        ...metrics,
        aiInsights: aiInsights.map((insight) => insight.insightId),
      })

      // Store AI insights
      if (aiInsights.length > 0) {
        await db.collection('ai_insights').insertMany(aiInsights)
      }

      // Update metrics buffer
      this.metricsBuffer.push(metrics)
      if (this.metricsBuffer.length > 100) {
        this.metricsBuffer = this.metricsBuffer.slice(-100)
      }
    } catch (error) {
      logger.error('Failed to store metrics:', { error })
      throw error
    }
  }

  private async checkForAlerts(
    metrics: SecurityMetrics,
    aiInsights: AIInsight[],
  ): Promise<void> {
    try {
      const alerts: Alert[] = []

      // Check for threat-based alerts
      if (metrics.threatCount > this.config.alertThresholds.critical) {
        alerts.push(
          this.createAlert(
            'threat',
            'critical',
            'High Threat Count',
            `${metrics.threatCount} threats detected in the last period`,
            metrics,
          ),
        )
      }

      // Check for anomaly-based alerts
      if (metrics.anomalyScore > 0.8) {
        alerts.push(
          this.createAlert(
            'anomaly',
            'high',
            'High Anomaly Score',
            `Anomaly score of ${(metrics.anomalyScore * 100).toFixed(1)}% detected`,
            metrics,
          ),
        )
      }

      // Check for system-based alerts
      if (metrics.systemHealth.cpu > 80 || metrics.systemHealth.memory > 80) {
        alerts.push(
          this.createAlert(
            'system',
            'medium',
            'High System Resource Usage',
            `CPU: ${metrics.systemHealth.cpu.toFixed(1)}%, Memory: ${metrics.systemHealth.memory.toFixed(1)}%`,
            metrics,
          ),
        )
      }

      // Check for AI insight alerts
      for (const insight of aiInsights) {
        if (insight.severity === 'high' || insight.severity === 'critical') {
          alerts.push(
            this.createAlert(
              'ai_insight',
              insight.severity,
              insight.title,
              insight.description,
              metrics,
              [insight],
            ),
          )
        }
      }

      // Process alerts
      for (const alert of alerts) {
        await this.processAlert(alert)
      }
    } catch (error) {
      logger.error('Failed to check for alerts:', { error })
    }
  }

  private createAlert(
    type: Alert['type'],
    severity: Alert['severity'],
    title: string,
    description: string,
    metrics: SecurityMetrics,
    aiInsights: AIInsight[] = [],
  ): Alert {
    return {
      alertId: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      type,
      severity,
      title,
      description,
      source: 'ai_enhanced_monitoring',
      metrics,
      aiInsights,
      notifiedChannels: [],
      acknowledged: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }

  private async processAlert(alert: Alert): Promise<void> {
    try {
      // Store alert
      await this.storeAlert(alert)

      // Send notifications
      await this.sendAlertNotifications(alert)

      this.emit('alert_generated', alert)
      logger.info('Alert generated', {
        alertId: alert.alertId,
        severity: alert.severity,
      })
    } catch (error) {
      logger.error('Failed to process alert:', {
        error,
        alertId: alert.alertId,
      })
    }
  }

  private async storeAlert(alert: Alert): Promise<void> {
    try {
      const db = this.mongoClient.db('threat_detection')
      await db.collection('alerts').insertOne(alert)

      // Update alert buffer
      this.alertBuffer.push(alert)
      if (this.alertBuffer.length > 100) {
        this.alertBuffer = this.alertBuffer.slice(-100)
      }
    } catch (error) {
      logger.error('Failed to store alert:', { error, alertId: alert.alertId })
      throw error
    }
  }

  private async sendAlertNotifications(alert: Alert): Promise<void> {
    try {
      const activeChannels = this.config.notificationChannels.filter(
        (channel) => channel.enabled,
      )

      for (const channel of activeChannels) {
        if (this.shouldNotifyChannel(channel, alert)) {
          await this.sendNotification(channel, alert)
          alert.notifiedChannels.push(channel.name)
        }
      }

      // Update alert with notified channels
      await this.updateAlert(alert)
    } catch (error) {
      logger.error('Failed to send alert notifications:', {
        error,
        alertId: alert.alertId,
      })
    }
  }

  private shouldNotifyChannel(
    channel: NotificationChannelConfig,
    alert: Alert,
  ): boolean {
    // Check if channel priority matches alert severity
    const severityPriority = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    }

    return channel.priority <= severityPriority[alert.severity]
  }

  private async sendNotification(
    channel: NotificationChannelConfig,
    alert: Alert,
  ): Promise<void> {
    try {
      switch (channel.type) {
        case 'email':
          await this.sendEmailNotification(channel, alert)
          break
        case 'slack':
          await this.sendSlackNotification(channel, alert)
          break
        case 'webhook':
          await this.sendWebhookNotification(channel, alert)
          break
        case 'sms':
          await this.sendSMSNotification(channel, alert)
          break
        case 'dashboard':
          await this.updateDashboard(channel, alert)
          break
      }
    } catch (error) {
      logger.error(`Failed to send ${channel.type} notification:`, {
        error,
        alertId: alert.alertId,
      })
    }
  }

  private async sendEmailNotification(
    channel: NotificationChannelConfig,
    alert: Alert,
  ): Promise<void> {
    // Implement email notification logic
    logger.info(
      `Email notification would be sent for alert ${alert.alertId} to channel ${channel.name}`,
    )
  }

  private async sendSlackNotification(
    channel: NotificationChannelConfig,
    alert: Alert,
  ): Promise<void> {
    // Implement Slack notification logic
    logger.info(
      `Slack notification would be sent for alert ${alert.alertId} to channel ${channel.name}`,
    )
  }

  private async sendWebhookNotification(
    channel: NotificationChannelConfig,
    alert: Alert,
  ): Promise<void> {
    // Implement webhook notification logic
    logger.info(
      `Webhook notification would be sent for alert ${alert.alertId} to channel ${channel.name}`,
    )
  }

  private async sendSMSNotification(
    channel: NotificationChannelConfig,
    alert: Alert,
  ): Promise<void> {
    // Implement SMS notification logic
    logger.info(
      `SMS notification would be sent for alert ${alert.alertId} to channel ${channel.name}`,
    )
  }

  private async updateDashboard(
    channel: NotificationChannelConfig,
    alert: Alert,
  ): Promise<void> {
    // Implement dashboard update logic
    logger.info(
      `Dashboard would be updated for alert ${alert.alertId} on channel ${channel.name}`,
    )
  }

  private async updateAlert(alert: Alert): Promise<void> {
    try {
      const db = this.mongoClient.db('threat_detection')
      alert.updatedAt = new Date()

      await db
        .collection('alerts')
        .updateOne({ alertId: alert.alertId }, { $set: alert })
    } catch (error) {
      logger.error('Failed to update alert:', { error, alertId: alert.alertId })
      throw error
    }
  }

  /**
   * Get current security metrics
   */
  async getCurrentMetrics(): Promise<SecurityMetrics> {
    try {
      return await this.collectSecurityMetrics()
    } catch (error) {
      logger.error('Failed to get current metrics:', { error })
      throw error
    }
  }

  /**
   * Get recent alerts
   */
  async getRecentAlerts(limit: number = 50): Promise<Alert[]> {
    try {
      const db = this.mongoClient.db('threat_detection')
      const alerts = await db
        .collection('alerts')
        .find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray()

      return alerts as unknown as Alert[]
    } catch (error) {
      logger.error('Failed to get recent alerts:', { error })
      return []
    }
  }

  /**
   * Get AI insights
   */
  async getAIInsights(limit: number = 20): Promise<AIInsight[]> {
    try {
      const db = this.mongoClient.db('threat_detection')
      const insights = await db
        .collection('ai_insights')
        .find({})
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray()

      return insights as unknown as AIInsight[]
    } catch (error) {
      logger.error('Failed to get AI insights:', { error })
      return []
    }
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(
    alertId: string,
    acknowledgedBy: string,
  ): Promise<boolean> {
    try {
      const db = this.mongoClient.db('threat_detection')
      const result = await db.collection('alerts').updateOne(
        { alertId },
        {
          $set: {
            acknowledged: true,
            acknowledgedBy,
            acknowledgedAt: new Date(),
            updatedAt: new Date(),
          },
        },
      )

      return result.modifiedCount > 0
    } catch (error) {
      logger.error('Failed to acknowledge alert:', { error, alertId })
      return false
    }
  }

  /**
   * Get monitoring health status
   */
  async getHealthStatus(): Promise<{
    healthy: boolean
    aiModelLoaded: boolean
    metricsCollected: number
    alertsGenerated: number
    lastMetricsTimestamp?: Date
  }> {
    try {
      const db = this.mongoClient.db('threat_detection')

      const [metricsCount, alertsCount, lastMetric] = await Promise.all([
        db.collection('security_metrics').countDocuments(),
        db.collection('alerts').countDocuments(),
        db
          .collection('security_metrics')
          .findOne({}, { sort: { timestamp: -1 } }),
      ])

      return {
        healthy: this.isMonitoring,
        aiModelLoaded: this.anomalyDetectionModel !== null,
        metricsCollected: metricsCount,
        alertsGenerated: alertsCount,
        lastMetricsTimestamp: lastMetric?.timestamp,
      }
    } catch (error) {
      logger.error('Failed to get health status:', { error })
      return {
        healthy: false,
        aiModelLoaded: false,
        metricsCollected: 0,
        alertsGenerated: 0,
      }
    }
  }

  private startRealTimeMonitoring(): void {
    const interval = setInterval(async () => {
      if (!this.isMonitoring) {
        return
      }

      try {
        await this.collectSecurityMetrics()
      } catch (error) {
        logger.error('Real-time monitoring error:', { error })
      }
    }, this.config.monitoringIntervals.realTime)

    this.monitoringIntervals.push(interval)
  }

  private startBatchMonitoring(): void {
    const interval = setInterval(async () => {
      if (!this.isMonitoring) {
        return
      }

      try {
        // Perform batch analysis and reporting
        await this.performBatchAnalysis()
      } catch (error) {
        logger.error('Batch monitoring error:', { error })
      }
    }, this.config.monitoringIntervals.batch)

    this.monitoringIntervals.push(interval)
  }

  private startAnomalyDetection(): void {
    const interval = setInterval(async () => {
      if (!this.isMonitoring) {
        return
      }

      try {
        // Perform anomaly detection on recent metrics
        await this.performAnomalyDetection()
      } catch (error) {
        logger.error('Anomaly detection error:', { error })
      }
    }, this.config.monitoringIntervals.anomalyDetection)

    this.monitoringIntervals.push(interval)
  }

  private async performBatchAnalysis(): Promise<void> {
    try {
      // Generate batch reports
      const recentMetrics = await this.getRecentMetrics(100)

      if (recentMetrics.length > 10) {
        // Generate trend analysis
        const trendAnalysis = this.analyzeTrends(recentMetrics)

        // Generate performance report
        const performanceReport = this.generatePerformanceReport(recentMetrics)

        this.emit('batch_analysis_completed', {
          trendAnalysis,
          performanceReport,
        })
      }
    } catch (error) {
      logger.error('Batch analysis error:', { error })
    }
  }

  private async performAnomalyDetection(): Promise<void> {
    try {
      const recentMetrics = await this.getRecentMetrics(50)

      if (recentMetrics.length > 10 && this.anomalyDetectionModel) {
        for (const metrics of recentMetrics.slice(-10)) {
          const anomalyScore = await this.calculateAnomalyScore({
            threats: {
              totalThreats: metrics.threatCount,
              blockedRequests: metrics.blockedRequests,
            },
            system: {
              cpu: metrics.systemHealth.cpu,
              memory: metrics.systemHealth.memory,
            },
            redis: { commandsProcessed: metrics.systemHealth.responseTime },
          })

          if (anomalyScore > 0.7) {
            logger.warn('Anomaly detected', {
              anomalyScore,
              timestamp: metrics.timestamp,
              threatCount: metrics.threatCount,
            })
          }
        }
      }
    } catch (error) {
      logger.error('Anomaly detection error:', { error })
    }
  }

  private async getRecentMetrics(limit: number): Promise<SecurityMetrics[]> {
    try {
      const db = this.mongoClient.db('threat_detection')
      const metrics = await db
        .collection('security_metrics')
        .find({})
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray()

      return metrics as unknown as SecurityMetrics[]
    } catch (error) {
      logger.error('Failed to get recent metrics:', { error })
      return []
    }
  }

  private analyzeTrends(metrics: SecurityMetrics[]): Record<string, unknown> {
    // Simple trend analysis
    const threatTrend = this.calculateTrend(metrics.map((m) => m.threatCount))
    const anomalyTrend = this.calculateTrend(metrics.map((m) => m.anomalyScore))

    return {
      threatTrend,
      anomalyTrend,
      period: 'last_100_metrics',
      analysisTimestamp: new Date(),
    }
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) {
      return 0
    }

    const recent = values.slice(-10)
    const older = values.slice(-20, -10)

    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length
    const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length

    return olderAvg > 0 ? (recentAvg - olderAvg) / olderAvg : 0
  }

  private generatePerformanceReport(
    metrics: SecurityMetrics[],
  ): Record<string, unknown> {
    const responseTimes = metrics.map((m) => m.systemHealth.responseTime)
    const errorRates = metrics.map((m) => m.systemHealth.errorRate)

    return {
      avgResponseTime:
        responseTimes.reduce((sum, val) => sum + val, 0) / responseTimes.length,
      maxResponseTime: Math.max(...responseTimes),
      minResponseTime: Math.min(...responseTimes),
      avgErrorRate:
        errorRates.reduce((sum, val) => sum + val, 0) / errorRates.length,
      reportTimestamp: new Date(),
    }
  }

  public async analyzePattern(_data: any): Promise<any> {
    // Basic pattern analysis implementation
    return {
      patterns: [],
      confidence: 0.5,
      timestamp: new Date(),
    }
  }

  public async predictAnomaly(_data: any): Promise<any> {
    // Basic anomaly prediction implementation
    return {
      isAnomaly: false,
      score: 0.1,
      confidence: 0.9,
      timestamp: new Date(),
    }
  }

  async shutdown(): Promise<void> {
    try {
      await this.stopMonitoring()

      if (this.redis) {
        await this.redis.quit()
      }

      if (this.mongoClient) {
        await this.mongoClient.close()
      }

      logger.info('AI-enhanced monitoring service shutdown completed')
      this.emit('monitoring_shutdown')
    } catch (error) {
      logger.error('Failed to shutdown monitoring service:', { error })
      throw error
    }
  }
}

