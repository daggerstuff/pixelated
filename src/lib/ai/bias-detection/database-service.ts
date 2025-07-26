/**
 * Bias Detection Database Service
 *
 * Production-grade database operations for bias detection engine.
 * Handles all CRUD operations with proper error handling and HIPAA compliance.
 */

import { supabase } from '../../supabase/client'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import type {
  BiasAnalysisResult,
  BiasAlert,
  BiasDashboardData,
  BiasSummaryStats,
  BiasTrendData,
  DemographicBreakdown,
  ParticipantDemographics,
} from './types'

const logger = createBuildSafeLogger('BiasDetectionDatabase')

export class BiasDetectionDatabaseService {
  /**
   * Store bias analysis result in database
   */
  async storeAnalysisResult(
    result: BiasAnalysisResult,
    processingTimeMs?: number,
    userId?: string,
  ): Promise<void> {
    try {
      const { error } = await supabase.from('bias_analyses').insert({
        session_id: result.sessionId,
        timestamp: result.timestamp.toISOString(),
        overall_bias_score: result.overallBiasScore,
        alert_level: result.alertLevel,
        confidence: result.confidence,
        preprocessing_result: result.layerResults.preprocessing,
        model_level_result: result.layerResults.modelLevel,
        interactive_result: result.layerResults.interactive,
        evaluation_result: result.layerResults.evaluation,
        participant_demographics: result.demographics,
        recommendations: result.recommendations,
        processing_time_ms: processingTimeMs,
        user_id: userId,
      })

      if (error) {
        throw new Error(`Failed to store analysis result: ${error.message}`)
      }

      logger.debug('Analysis result stored successfully', {
        sessionId: result.sessionId,
        processingTimeMs,
      })
    } catch (error) {
      logger.error('Failed to store analysis result', {
        error: error instanceof Error ? error.message : String(error),
        sessionId: result.sessionId,
      })
      throw error
    }
  }

  /**
   * Store bias alert in database
   */
  async storeAlert(alert: BiasAlert, analysisId?: string): Promise<void> {
    try {
      const { error } = await supabase.from('bias_alerts').insert({
        alert_id: alert.alertId,
        session_id: alert.sessionId,
        analysis_id: analysisId,
        level: alert.level,
        type: alert.type,
        message: alert.message,
        timestamp: alert.timestamp.toISOString(),
        acknowledged: alert.acknowledged,
      })

      if (error) {
        throw new Error(`Failed to store alert: ${error.message}`)
      }

      logger.debug('Alert stored successfully', {
        alertId: alert.alertId,
        level: alert.level,
      })
    } catch (error) {
      logger.error('Failed to store alert', {
        error: error instanceof Error ? error.message : String(error),
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
    } catch (error) {
      logger.error('Failed to get dashboard data', {
        error: error instanceof Error ? error.message : String(error),
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
      // Get total sessions and average bias score
      const { data: sessionStats, error: sessionError } = await supabase
        .from('bias_analyses')
        .select('overall_bias_score, alert_level')
        .gte('timestamp', cutoffTime.toISOString())

      if (sessionError) {
        throw new Error(`Failed to get session stats: ${sessionError.message}`)
      }

      const totalSessions = sessionStats?.length || 0
      const averageBiasScore =
        totalSessions > 0
          ? sessionStats.reduce((sum, s) => sum + s.overall_bias_score, 0) /
            totalSessions
          : 0

      // Get alert counts
      const { data: alertStats, error: alertError } = await supabase
        .from('bias_alerts')
        .select('level')
        .gte('timestamp', cutoffTime.toISOString())

      if (alertError) {
        throw new Error(`Failed to get alert stats: ${alertError.message}`)
      }

      const alertsLast24h = alertStats?.length || 0
      const criticalIssues =
        alertStats?.filter((a) => a.level === 'critical').length || 0

      // Get total alerts (all time) - not currently used in summary but kept for future use
      const { count: _totalAlerts, error: totalAlertsError } = await supabase
        .from('bias_alerts')
        .select('*', { count: 'exact', head: true })

      if (totalAlertsError) {
        throw new Error(
          `Failed to get total alerts: ${totalAlertsError.message}`,
        )
      }

      // Calculate improvement rate (simplified - compare with previous period)
      const previousCutoff = new Date(
        cutoffTime.getTime() - (Date.now() - cutoffTime.getTime()),
      )
      const { data: previousStats, error: previousError } = await supabase
        .from('bias_analyses')
        .select('overall_bias_score')
        .gte('timestamp', previousCutoff.toISOString())
        .lt('timestamp', cutoffTime.toISOString())

      if (previousError) {
        logger.warn(
          'Failed to get previous period stats for improvement rate',
          {
            error: previousError.message,
          },
        )
      }

      const previousAverage =
        previousStats && previousStats.length > 0
          ? previousStats.reduce((sum, s) => sum + s.overall_bias_score, 0) /
            previousStats.length
          : averageBiasScore

      const improvementRate =
        previousAverage > 0
          ? Math.max(0, (previousAverage - averageBiasScore) / previousAverage)
          : 0

      // Calculate compliance score (simplified)
      const complianceScore = Math.max(0, 1 - averageBiasScore)

      return {
        totalSessions,
        averageBiasScore,
        alertsLast24h,
        criticalIssues,
        improvementRate,
        complianceScore,
      }
    } catch (error) {
      logger.error('Failed to get summary stats', {
        error: error instanceof Error ? error.message : String(error),
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
      const { data, error } = await supabase
        .from('bias_alerts')
        .select('*')
        .gte('timestamp', cutoffTime.toISOString())
        .order('timestamp', { ascending: false })
        .limit(limit)

      if (error) {
        throw new Error(`Failed to get recent alerts: ${error.message}`)
      }

      return (data || []).map((row) => {
        const alert: BiasAlert = {
          alertId: row.alert_id,
          sessionId: row.session_id,
          level: row.level as 'low' | 'medium' | 'high' | 'critical',
          type: row.type,
          message: row.message,
          timestamp: new Date(row.timestamp),
          acknowledged: row.acknowledged,
        }
        if (row.resolved_at) {
          alert.resolvedAt = new Date(row.resolved_at)
        }
        return alert
      })
    } catch (error) {
      logger.error('Failed to get recent alerts', {
        error: error instanceof Error ? error.message : String(error),
      })
      return []
    }
  }

  /**
   * Get trend data for charts
   */
  private async getTrendData(timeRange: string): Promise<BiasTrendData[]> {
    try {
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
        const { data: analyses, error: analysesError } = await supabase
          .from('bias_analyses')
          .select('overall_bias_score, participant_demographics')
          .gte('timestamp', startTime.toISOString())
          .lt('timestamp', endTime.toISOString())

        if (analysesError) {
          logger.warn('Failed to get trend data for period', {
            error: analysesError.message,
            startTime,
            endTime,
          })
          continue
        }

        // Get alerts for this time period
        const { data: alerts, error: alertsError } = await supabase
          .from('bias_alerts')
          .select('level')
          .gte('timestamp', startTime.toISOString())
          .lt('timestamp', endTime.toISOString())

        if (alertsError) {
          logger.warn('Failed to get alert trend data for period', {
            error: alertsError.message,
            startTime,
            endTime,
          })
        }

        const sessionCount = analyses?.length || 0
        const biasScore =
          sessionCount > 0
            ? analyses.reduce((sum, a) => sum + a.overall_bias_score, 0) /
              sessionCount
            : 0
        const alertCount = alerts?.length || 0

        // Calculate demographic breakdown
        const demographicBreakdown: Record<string, number> = {}
        if (analyses && analyses.length > 0) {
          analyses.forEach((analysis) => {
            const demographics =
              analysis.participant_demographics as ParticipantDemographics
            if (demographics?.gender) {
              demographicBreakdown[demographics.gender] =
                (demographicBreakdown[demographics.gender] || 0) + 1
            }
          })
        }

        trends.push({
          date: endTime,
          biasScore,
          sessionCount,
          alertCount,
          demographicBreakdown,
        })
      }

      return trends
    } catch (error) {
      logger.error('Failed to get trend data', {
        error: error instanceof Error ? error.message : String(error),
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
      const { data, error } = await supabase
        .from('bias_analyses')
        .select('participant_demographics')
        .gte('timestamp', cutoffTime.toISOString())

      if (error) {
        throw new Error(`Failed to get demographic data: ${error.message}`)
      }

      const demographics: DemographicBreakdown = {
        age: {},
        gender: {},
        ethnicity: {},
        language: {},
        intersectional: [],
      }

      data?.forEach((row) => {
        const demo = row.participant_demographics as ParticipantDemographics

        if (demo.age) {
          demographics.age[demo.age] = (demographics.age[demo.age] || 0) + 1
        }
        if (demo.gender) {
          demographics.gender[demo.gender] =
            (demographics.gender[demo.gender] || 0) + 1
        }
        if (demo.ethnicity) {
          demographics.ethnicity[demo.ethnicity] =
            (demographics.ethnicity[demo.ethnicity] || 0) + 1
        }
        if (demo.primaryLanguage) {
          demographics.language[demo.primaryLanguage] =
            (demographics.language[demo.primaryLanguage] || 0) + 1
        }
      })

      return demographics
    } catch (error) {
      logger.error('Failed to get demographic breakdown', {
        error: error instanceof Error ? error.message : String(error),
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
      const { data, error } = await supabase
        .from('bias_analyses')
        .select('*')
        .gte('timestamp', cutoffTime.toISOString())
        .order('timestamp', { ascending: false })
        .limit(limit)

      if (error) {
        throw new Error(`Failed to get recent analyses: ${error.message}`)
      }

      return (data || []).map((row) => ({
        sessionId: row.session_id,
        timestamp: new Date(row.timestamp),
        overallBiasScore: row.overall_bias_score,
        alertLevel: row.alert_level as 'low' | 'medium' | 'high' | 'critical',
        confidence: row.confidence,
        layerResults: {
          preprocessing: row.preprocessing_result,
          modelLevel: row.model_level_result,
          interactive: row.interactive_result,
          evaluation: row.evaluation_result,
        },
        demographics: row.participant_demographics as ParticipantDemographics,
        recommendations: row.recommendations || [],
      }))
    } catch (error) {
      logger.error('Failed to get recent analyses', {
        error: error instanceof Error ? error.message : String(error),
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
    const recommendations = []

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
      const { data, error } = await supabase
        .from('bias_analyses')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null
        }
        throw new Error(`Failed to get session analysis: ${error.message}`)
      }

      return {
        sessionId: data.session_id,
        timestamp: new Date(data.timestamp),
        overallBiasScore: data.overall_bias_score,
        alertLevel: data.alert_level as 'low' | 'medium' | 'high' | 'critical',
        confidence: data.confidence,
        layerResults: {
          preprocessing: data.preprocessing_result,
          modelLevel: data.model_level_result,
          interactive: data.interactive_result,
          evaluation: data.evaluation_result,
        },
        demographics: data.participant_demographics as ParticipantDemographics,
        recommendations: data.recommendations || [],
      }
    } catch (error) {
      logger.error('Failed to get session analysis', {
        error: error instanceof Error ? error.message : String(error),
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
      const { error } = await supabase.from('bias_system_metrics').insert({
        response_time_ms: metrics.responseTimeMs,
        memory_usage_mb: metrics.memoryUsageMb,
        cpu_usage_percent: metrics.cpuUsagePercent,
        active_connections: metrics.activeConnections,
        cache_hit_rate: metrics.cacheHitRate,
        python_service_status: metrics.pythonServiceStatus,
        database_status: metrics.databaseStatus,
        overall_health: metrics.overallHealth,
        error_count: metrics.errorCount,
        error_rate: metrics.errorRate,
      })

      if (error) {
        throw new Error(`Failed to record system metrics: ${error.message}`)
      }
    } catch (error) {
      logger.error('Failed to record system metrics', {
        error: error instanceof Error ? error.message : String(error),
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
      const { error } = await supabase.from('bias_audit_logs').insert({
        session_id: entry.sessionId,
        user_id: entry.userId,
        action: entry.action,
        resource: entry.resource,
        details: entry.details,
        ip_address: entry.ipAddress,
        user_agent: entry.userAgent,
        data_accessed: entry.dataAccessed,
        retention_period_days: entry.retentionPeriodDays || 2555, // 7 years default
      })

      if (error) {
        throw new Error(`Failed to record audit log: ${error.message}`)
      }
    } catch (error) {
      logger.error('Failed to record audit log', {
        error: error instanceof Error ? error.message : String(error),
        action: entry.action,
      })
      // Don't throw - audit logging should not break the main flow
    }
  }
}

// Singleton instance
export const biasDetectionDb = new BiasDetectionDatabaseService()
