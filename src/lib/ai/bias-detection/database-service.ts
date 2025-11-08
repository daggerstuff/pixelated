/**
 * Bias Detection Database Service
 *
 * Production-grade database operations for bias detection engine.
 * Handles all CRUD operations with proper error handling and HIPAA compliance.
 */

import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import type {
  BiasAnalysisResult,
  BiasAlert,
  BiasDashboardData,
  BiasSummaryStats,
  BiasTrendData,
  DemographicBreakdown,
} from './types'
import mongodb from '../../../config/mongodb.config'
import { ObjectId } from 'mongodb'

const logger = createBuildSafeLogger('BiasDetectionDatabase')

export class BiasDetectionDatabaseService {
  /**
   * Get database connection with validation
   */
  private async getDatabase() {
    try {
      // Check if mongodb client is available
      if (!mongodb) {
        throw new Error('MongoDB client not initialized')
      }

      const db = await mongodb.connect()

      // Validate the connection by attempting a simple operation
      await db.admin().ping()

      return db
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error('Database connection failed', {
        error: errorMessage,
        timestamp: new Date().toISOString(),
      })
      throw new Error(`Database connection failed: ${errorMessage}`, { cause: error })
    }
  }

  /**
   * Store bias analysis result in database
   */
  async storeAnalysisResult(
    result: BiasAnalysisResult,
    processingTimeMs?: number,
  ): Promise<void> {
    try {
      const db = await this.getDatabase()
      const collection = db.collection('bias_analyses')

      const document = {
        _id: new ObjectId(),
        ...result,
        processingTimeMs,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      await collection.insertOne(document)

      logger.debug('Analysis result stored successfully', {
        sessionId: result.sessionId,
        analysisId: document._id,
        processingTimeMs,
      })
    } catch (error: unknown) {
      logger.error('Failed to store analysis result', {
        error: error instanceof Error ? String(error) : String(error),
        sessionId: result.sessionId,
      })
      throw error
    }
  }

  /**
   * Store bias alert in database
   */
  async storeAlert(alert: BiasAlert, _analysisId?: string): Promise<void> {
    try {
      const db = await this.getDatabase()
      const collection = db.collection('bias_alerts')

      const document = {
        _id: new ObjectId(),
        ...alert,
        acknowledged: alert.acknowledged || false,
        resolvedAt: alert.resolvedAt || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      await collection.insertOne(document)

      logger.debug('Alert stored successfully', {
        alertId: alert.alertId,
        level: alert.level,
        acknowledged: alert.acknowledged,
      })
    } catch (error: unknown) {
      logger.error('Failed to store alert', {
        error: error instanceof Error ? String(error) : String(error),
        alertId: alert.alertId,
      })
      throw error
    }
  }

  /**
   * Get dashboard data from database
   */
  async getDashboardData(options?: {
    timeRange?: string
    includeDetails?: boolean
  }): Promise<BiasDashboardData> {
    try {
      const timeRange = options?.timeRange || '24h'
      const hoursBack = this.parseTimeRange(timeRange)
      const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000)

      // Get summary statistics
      const summary = await this.getSummaryStats(cutoffTime)

      // Get recent alerts
      const alerts = await this.getRecentAlerts(cutoffTime)

      // Get trend data
      const trends = await this.getTrendData(timeRange)

      // Get demographic breakdown
      const demographics = await this.getDemographicBreakdown(cutoffTime)

      // Get recent analyses if details requested
      const recentAnalyses = options?.includeDetails
        ? await this.getRecentAnalyses(cutoffTime, 10)
        : []

      // Generate recommendations based on data
      const recommendations = this.generateRecommendations(summary, alerts)

      return {
        summary,
        alerts,
        trends,
        demographics,
        recentAnalyses,
        recommendations,
      }
    } catch (error: unknown) {
      logger.error('Failed to get dashboard data', {
        error: error instanceof Error ? String(error) : String(error),
        timeRange: options?.timeRange,
      })
      throw error
    }
  }

  /**
   * Get summary statistics
   */
  private async getSummaryStats(cutoffTime: Date): Promise<BiasSummaryStats> {
    try {
      const db = await this.getDatabase()

      // Get total sessions in the time range
      const totalSessions = await db
        .collection('bias_analyses')
        .countDocuments({ createdAt: { $gte: cutoffTime } })

      // Get average bias score
      const avgResult = (await db
        .collection('bias_analyses')
        .aggregate([
          { $match: { createdAt: { $gte: cutoffTime } } },
          { $group: { _id: null, avgScore: { $avg: '$overallBiasScore' } } },
        ])
        .toArray()) as Array<{ avgScore: number }>

      const averageBiasScore =
        avgResult.length > 0 && avgResult[0]?.avgScore != null
          ? avgResult[0].avgScore
          : 0

      // Get alerts in the last 24 hours
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const alertsLast24h = await db
        .collection('bias_alerts')
        .countDocuments({ createdAt: { $gte: last24h } })

      // Get critical alerts
      const criticalIssues = await db.collection('bias_alerts').countDocuments({
        level: 'critical',
        createdAt: { $gte: cutoffTime },
      })

      // Calculate improvement rate (simplified)
      const improvementRate = Math.max(0, Math.min(1, 1 - averageBiasScore))

      // Calculate compliance score based on alerts and bias scores
      const complianceScore = Math.max(
        0,
        Math.min(100, 100 - averageBiasScore * 50 - criticalIssues * 5),
      )

      return {
        totalSessions,
        averageBiasScore,
        alertsLast24h,
        criticalIssues,
        improvementRate,
        complianceScore,
      }
    } catch (error: unknown) {
      logger.error('Failed to get summary stats', {
        error: error instanceof Error ? String(error) : String(error),
      })
      throw error
    }
  }

  /**
   * Get recent alerts
   */
  private async getRecentAlerts(
    cutoffTime: Date,
    limit: number = 50,
  ): Promise<BiasAlert[]> {
    try {
      const db = await this.getDatabase()
      const collection = db.collection('bias_alerts')

      const alerts = await collection
        .find({ createdAt: { $gte: cutoffTime } })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray()

      return alerts.map((alert) => ({
        alertId: alert['alertId'],
        timestamp: alert['timestamp'],
        level: alert['level'],
        type: alert['type'],
        message: alert['message'],
        sessionId: alert['sessionId'],
        acknowledged: alert['acknowledged'] || false,
        resolvedAt: alert['resolvedAt'] || undefined,
      }))
    } catch (error: unknown) {
      logger.error('Failed to get recent alerts', {
        error: error instanceof Error ? String(error) : String(error),
      })
      return []
    }
  }

  /**
   * Get trend data for charts
   */
  private async getTrendData(timeRange: string): Promise<BiasTrendData[]> {
    try {
      const db = await this.getDatabase()
      const collection = db.collection('bias_analyses')

      const hoursBack = this.parseTimeRange(timeRange)
      const points = Math.min(24, hoursBack) // Max 24 data points
      const intervalHours = Math.max(1, Math.floor(hoursBack / points))

      const trends: BiasTrendData[] = []

      for (let i = points - 1; i >= 0; i--) {
        const endTime = new Date(
          Date.now() - i * intervalHours * 60 * 60 * 1000,
        )
        const startTime = new Date(
          endTime.getTime() - intervalHours * 60 * 60 * 1000,
        )

        // Get analyses for this time period
        const analyses = await collection
          .find({
            createdAt: {
              $gte: startTime,
              $lt: endTime,
            },
          })
          .toArray()

        const alertCount = await db.collection('bias_alerts').countDocuments({
          createdAt: {
            $gte: startTime,
            $lt: endTime,
          },
        })

        // Calculate average bias score for this period
        const avgScore =
          analyses.length > 0
            ? analyses.reduce(
                (sum, analysis) => sum + analysis['overallBiasScore'],
                0,
              ) / analyses.length
            : 0

        // Get demographic breakdown for this period
        const demographicBreakdown: Record<string, number> = {}
        analyses.forEach((analysis) => {
          const demo = analysis['demographics']
          if (demo) {
            // (Previously unused) key could be used for grouping if needed
            // No-op: placeholder for future demographic aggregation
          }
        })

        trends.push({
          date: endTime,
          biasScore: avgScore,
          sessionCount: analyses.length,
          alertCount,
          demographicBreakdown,
        })
      }

      return trends
    } catch (error: unknown) {
      logger.error('Failed to get trend data', {
        error: error instanceof Error ? String(error) : String(error),
        timeRange,
      })
      return []
    }
  }

  /**
   * Get demographic breakdown
   */
  private async getDemographicBreakdown(
    cutoffTime: Date,
  ): Promise<DemographicBreakdown> {
    try {
      const db = await this.getDatabase()

      const analyses = await db
        .collection('bias_analyses')
        .find({ createdAt: { $gte: cutoffTime } })
        .toArray()

      const age: Record<string, number> = {}
      const gender: Record<string, number> = {}
      const ethnicity: Record<string, number> = {}
      const language: Record<string, number> = {}
      const intersectional: Array<{
        groups: string[]
        representation: number
        biasScore: number
        sampleSize: number
      }> = []

      analyses.forEach((analysis) => {
        const demo = analysis['demographics']
        if (demo) {
          // Count demographics
          Object.assign(age, { [demo.age]: (age[demo.age] ?? 0) + 1 })
          Object.assign(gender, {
            [demo.gender]: (gender[demo.gender] ?? 0) + 1,
          })
          Object.assign(ethnicity, {
            [demo.ethnicity]: (ethnicity[demo.ethnicity] ?? 0) + 1,
          })
          // Precompute a stable key for this demographic intersection
          const intersectionKey = [demo.age, demo.gender, demo.ethnicity]
            .sort()
            .join('|')
          const existingIntersection = intersectional.find(
            (item) => item.groups.sort().join('|') === intersectionKey,
          )

          if (existingIntersection) {
            existingIntersection.sampleSize++
            // Recalculate representation as the fraction of total analyses
            existingIntersection.representation =
              existingIntersection.sampleSize / analyses.length
            // Update the running average of the bias score for this intersection
            existingIntersection.biasScore =
              (existingIntersection.biasScore *
                (existingIntersection.sampleSize - 1) +
                analysis['overallBiasScore']) /
              existingIntersection.sampleSize
          } else {
            intersectional.push({
              groups: [demo.age, demo.gender, demo.ethnicity],
              // Initial representation is one sample out of the total
              representation: 1 / analyses.length,
              biasScore: analysis['overallBiasScore'],
              sampleSize: 1,
            })
          }
        }
      })

      return {
        age,
        gender,
        ethnicity,
        language,
        intersectional,
      }
    } catch (error: unknown) {
      logger.error('Failed to get demographic breakdown', {
        error: error instanceof Error ? String(error) : String(error),
      })
      return {
        age: {},
        gender: {},
        ethnicity: {},
        language: {},
        intersectional: [],
      }
    }
  }

  /**
   * Get recent analyses
   */
  private async getRecentAnalyses(
    cutoffTime: Date,
    limit: number,
  ): Promise<BiasAnalysisResult[]> {
    try {
      const db = await this.getDatabase()
      const collection = db.collection('bias_analyses')

      const analyses = await collection
        .find({ createdAt: { $gte: cutoffTime } })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray()

      return analyses.map((analysis) => ({
        sessionId: analysis['sessionId'],
        timestamp: analysis['timestamp'],
        overallBiasScore: analysis['overallBiasScore'],
        layerResults: analysis['layerResults'],
        demographics: analysis['demographics'],
        recommendations: analysis['recommendations'] || [],
        alertLevel: analysis['alertLevel'],
        explanation: analysis['explanation'],
        confidence: analysis['confidence'],
      }))
    } catch (error: unknown) {
      logger.error('Failed to get recent analyses', {
        error: error instanceof Error ? String(error) : String(error),
      })
      return []
    }
  }

  /**
   * Generate recommendations based on current data
   */
  private generateRecommendations(
    summary: BiasSummaryStats,
    _alerts: BiasAlert[],
  ): Array<{
    id: string
    priority: 'low' | 'medium' | 'high' | 'critical'
    title: string
    description: string
    action: string
    estimatedImpact: string
  }> {
    const recommendations: Array<{
      id: string
      priority: 'low' | 'medium' | 'high' | 'critical'
      title: string
      description: string
      action: string
      estimatedImpact: string
    }> = []

    if (summary.criticalIssues > 0) {
      recommendations.push({
        id: 'critical-alerts',
        priority: 'critical' as const,
        title: 'Critical Bias Alerts Detected',
        description: `${summary.criticalIssues} critical bias issues require immediate attention`,
        action: 'Review and address critical alerts immediately',
        estimatedImpact:
          'High - Prevents potential harm and compliance violations',
      })
    }

    if (summary.averageBiasScore > 0.6) {
      recommendations.push({
        id: 'high-bias-score',
        priority: 'high' as const,
        title: 'High Average Bias Score',
        description: `Average bias score of ${summary.averageBiasScore.toFixed(3)} exceeds recommended threshold`,
        action: 'Review training data and model parameters',
        estimatedImpact: 'Medium - Improves overall system fairness',
      })
    }

    if (summary.improvementRate < 0.05) {
      recommendations.push({
        id: 'stagnant-improvement',
        priority: 'medium' as const,
        title: 'Limited Bias Reduction Progress',
        description:
          'Bias scores have not improved significantly in recent period',
        action: 'Implement additional bias mitigation strategies',
        estimatedImpact: 'Medium - Ensures continuous improvement',
      })
    }

    return recommendations
  }

  /**
   * Parse time range string to hours
   */
  private parseTimeRange(timeRange: string): number {
    switch (timeRange) {
      case '1h':
        return 1
      case '6h':
        return 6
      case '24h':
        return 24
      case '7d':
        return 24 * 7
      case '30d':
        return 24 * 30
      default:
        return 24
    }
  }

  /**
   * Get session analysis by ID
   */
  async getSessionAnalysis(
    sessionId: string,
  ): Promise<BiasAnalysisResult | null> {
    try {
      const db = await this.getDatabase()
      const collection = db.collection('bias_analyses')

      const analysis = await collection.findOne({ sessionId })

      if (!analysis) {
        return null
      }

      return {
        sessionId: analysis['sessionId'],
        timestamp: analysis['timestamp'],
        overallBiasScore: analysis['overallBiasScore'],
        layerResults: analysis['layerResults'],
        demographics: analysis['demographics'],
        recommendations: analysis['recommendations'] || [],
        alertLevel: analysis['alertLevel'],
        explanation: analysis['explanation'],
        confidence: analysis['confidence'],
      }
    } catch (error: unknown) {
      logger.error('Failed to get session analysis', {
        error: error instanceof Error ? String(error) : String(error),
        sessionId,
      })
      return null
    }
  }

  /**
   * Record system metrics
   */
  async recordSystemMetrics(metrics: {
    responseTimeMs: number
    memoryUsageMb: number
    cpuUsagePercent: number
    activeConnections: number
    cacheHitRate: number
    pythonServiceStatus: 'up' | 'down' | 'degraded'
    databaseStatus: 'up' | 'down' | 'degraded'
    overallHealth: 'healthy' | 'degraded' | 'critical'
    errorCount: number
    errorRate: number
  }): Promise<void> {
    try {
      const db = await this.getDatabase()
      const collection = db.collection('system_metrics')

      const document = {
        _id: new ObjectId(),
        ...metrics,
        timestamp: new Date(),
        createdAt: new Date(),
      }

      await collection.insertOne(document)

      logger.debug('System metrics recorded successfully', {
        overallHealth: metrics.overallHealth,
        responseTimeMs: metrics.responseTimeMs,
      })
    } catch (error: unknown) {
      logger.error('Failed to record system metrics', {
        error: error instanceof Error ? String(error) : String(error),
      })
      // Don't throw - system metrics recording should not break the main flow
    }
  }

  /**
   * Record audit log entry
   */
  async recordAuditLog(entry: {
    sessionId?: string
    userId?: string
    action: string
    resource?: string
    details?: unknown
    ipAddress?: string
    userAgent?: string
    dataAccessed?: string[]
    retentionPeriodDays?: number
  }): Promise<void> {
    try {
      const db = await this.getDatabase()
      const collection = db.collection('audit_logs')

      const document = {
        _id: new ObjectId(),
        ...entry,
        timestamp: new Date(),
        createdAt: new Date(),
        retentionExpiry: entry.retentionPeriodDays
          ? new Date(
              Date.now() + entry.retentionPeriodDays * 24 * 60 * 60 * 1000,
            )
          : null,
      }

      await collection.insertOne(document)

      logger.debug('Audit log entry recorded successfully', {
        action: entry.action,
        userId: entry.userId,
        sessionId: entry.sessionId,
      })
    } catch (error: unknown) {
      logger.error('Failed to record audit log', {
        error: error instanceof Error ? String(error) : String(error),
        action: entry.action,
      })
      // Don't throw - audit logging should not break the main flow
    }
  }
}

// Singleton instance
export const biasDetectionDb = new BiasDetectionDatabaseService()
