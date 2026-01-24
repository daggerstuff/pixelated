/**
 * Alert Utilities Module
 * 
 * Provides utility functions for alert management, severity calculation,
 * escalation logic, and reporting.
 */

import type { RedisClientType } from 'redis'

export interface AlertData {
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  source: string
  metadata?: Record<string, unknown>
}

export interface Alert extends AlertData {
  id: string
  status: 'active' | 'investigating' | 'escalated' | 'resolved'
  createdAt: string
  updatedAt?: string
  escalationCount: number
  escalatedAt?: string
  resolvedAt?: string
  resolvedBy?: string
  resolutionNotes?: string
}

export interface AlertStatistics {
  total: number
  active: number
  resolved: number
  bySeverity: {
    critical: number
    high: number
    medium: number
    low: number
  }
  bySource: Record<string, number>
  avgResolutionTime: number
}

export interface AlertReport {
  summary: string
  alerts: Alert[]
  metrics: AlertStatistics
  recommendations: string[]
  generatedAt: string
}

/**
 * Calculate alert severity based on threat data
 */
export function calculateAlertSeverity(threatData: {
  severity: string
  confidence: number
  impact: string
  velocity: string
}): 'low' | 'medium' | 'high' | 'critical' {
  const { severity, confidence, impact, velocity } = threatData

  let baseScore = 0

  // Base severity score
  switch (severity.toLowerCase()) {
    case 'critical':
      baseScore += 40
      break
    case 'high':
      baseScore += 30
      break
    case 'medium':
      baseScore += 20
      break
    case 'low':
      baseScore += 10
      break
  }

  // Confidence multiplier
  baseScore *= confidence

  // Impact modifier
  if (impact.includes('data_breach') || impact.includes('system_compromise')) {
    baseScore += 40
  } else if (impact.includes('service_disruption')) {
    baseScore += 10
  }

  // Velocity modifier
  if (velocity === 'rapid') {
    baseScore += 15
  } else if (velocity === 'moderate') {
    baseScore += 5
  }

  // Determine final severity
  if (baseScore >= 70) return 'critical'
  if (baseScore >= 50) return 'high'
  if (baseScore >= 25) return 'medium'
  return 'low'
}

/**
 * Determine if an alert should be escalated
 */
export function shouldEscalateAlert(alert: Alert): boolean {
  const now = new Date()
  const createdAt = new Date(alert.createdAt)
  const timeSinceCreation = now.getTime() - createdAt.getTime()

  // Don't escalate if already escalated recently
  if (alert.escalatedAt) {
    const lastEscalated = new Date(alert.escalatedAt)
    const timeSinceEscalation = now.getTime() - lastEscalated.getTime()
    if (timeSinceEscalation < 15 * 60 * 1000) { // 15 minutes
      return false
    }
  }

  // Escalation rules based on severity and time
  const escalationRules = {
    critical: { minutes: 5, maxEscalations: 3 },
    high: { minutes: 15, maxEscalations: 2 },
    medium: { minutes: 30, maxEscalations: 1 },
    low: { minutes: 60, maxEscalations: 1 }
  }

  const rule = escalationRules[alert.severity]
  if (!rule) return false

  // Check if enough time has passed
  if (timeSinceCreation < rule.minutes * 60 * 1000) {
    return false
  }

  // Check if we've reached max escalations
  if (alert.escalationCount >= rule.maxEscalations) {
    return false
  }

  // Check if alert is still active
  if (alert.status !== 'active' && alert.status !== 'investigating') {
    return false
  }

  return true
}

/**
 * Get alert statistics from Redis
 */
export async function getAlertStatistics(redis: RedisClientType): Promise<AlertStatistics> {
  try {
    const stats = await redis.hGetAll('alert:statistics')
    if (!stats) {
      throw new Error('No statistics found');
    }

    return {
      total: parseInt(stats.total || '0', 10),
      active: parseInt(stats.active || '0', 10),
      resolved: parseInt(stats.resolved || '0', 10),
      bySeverity: {
        critical: parseInt(stats.critical || '0', 10),
        high: parseInt(stats.high || '0', 10),
        medium: parseInt(stats.medium || '0', 10),
        low: parseInt(stats.low || '0', 10)
      },
      bySource: {
        'rate_limiting': parseInt(stats.rate_limiting || '0', 10),
        'behavioral_analysis': parseInt(stats.behavioral_analysis || '0', 10),
        'threat_intelligence': parseInt(stats.threat_intelligence || '0', 10),
        'system_monitoring': parseInt(stats.system_monitoring || '0', 10)
      },
      avgResolutionTime: parseInt(stats.avgResolutionTime || '0', 10)
    }
  } catch (error) {
    console.error('Error getting alert statistics:', error)
    return {
      total: 0,
      active: 0,
      resolved: 0,
      bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
      bySource: {},
      avgResolutionTime: 0
    }
  }
}

/**
 * Generate alert report
 */
export async function generateAlertReport(
  alerts: Alert[],
  options: {
    timeRange: string
    includeMetrics: boolean
    includeRecommendations: boolean
  }
): Promise<AlertReport> {
  const { timeRange, includeMetrics: _includeMetrics, includeRecommendations } = options

  const report: AlertReport = {
    summary: `Alert report for ${timeRange} with ${alerts.length} total alerts`,
    alerts,
    metrics: {
      total: alerts.length,
      active: alerts.filter(a => a.status === 'active').length,
      resolved: alerts.filter(a => a.status === 'resolved').length,
      bySeverity: {
        critical: alerts.filter(a => a.severity === 'critical').length,
        high: alerts.filter(a => a.severity === 'high').length,
        medium: alerts.filter(a => a.severity === 'medium').length,
        low: alerts.filter(a => a.severity === 'low').length
      },
      bySource: {},
      avgResolutionTime: 0
    },
    recommendations: [],
    generatedAt: new Date().toISOString()
  }

  // Calculate bySource statistics
  const sourceCounts: Record<string, number> = {}
  alerts.forEach(alert => {
    sourceCounts[alert.source] = (sourceCounts[alert.source] || 0) + 1
  })
  report.metrics.bySource = sourceCounts

  // Calculate average resolution time for resolved alerts
  const resolvedAlerts = alerts.filter(a => a.status === 'resolved' && a.resolvedAt)
  if (resolvedAlerts.length > 0) {
    const totalResolutionTime = resolvedAlerts.reduce((sum, alert) => {
      const created = new Date(alert.createdAt).getTime()
      const resolved = new Date(alert.resolvedAt!).getTime()
      return sum + (resolved - created)
    }, 0)
    report.metrics.avgResolutionTime = Math.floor(totalResolutionTime / resolvedAlerts.length)
  }

  // Generate recommendations if requested
  if (includeRecommendations) {
    report.recommendations = generateRecommendations(alerts, report.metrics)
  }

  return report
}

/**
 * Generate recommendations based on alert patterns
 */
function generateRecommendations(alerts: Alert[], metrics: AlertStatistics): string[] {
  const recommendations: string[] = []

  // High critical alert frequency
  if (metrics.bySeverity.critical > metrics.total * 0.3) {
    recommendations.push('High frequency of critical alerts detected. Consider implementing automated response mechanisms.')
  }

  // Long resolution times
  if (metrics.avgResolutionTime > 3600000) { // 1 hour
    recommendations.push('Average resolution time exceeds 1 hour. Review alert response procedures.')
  }

  // High active alert count
  if (metrics.active > metrics.total * 0.6) {
    recommendations.push('High number of active alerts. Consider increasing monitoring staff or automating responses.')
  }

  // Specific source recommendations
  if (metrics.bySource.rate_limiting > 10) {
    recommendations.push('Multiple rate limiting alerts. Review API usage patterns and consider rate limit adjustments.')
  }

  if (metrics.bySource.behavioral_analysis > 5) {
    recommendations.push('Multiple behavioral analysis alerts. Consider enhancing user behavior monitoring.')
  }

  // Default recommendation if no specific patterns
  if (recommendations.length === 0) {
    recommendations.push('Monitor alert trends and adjust thresholds as needed.')
  }

  return recommendations
}

/**
 * Update alert statistics in Redis
 */
export async function updateAlertStatistics(redis: RedisClientType, alert: Alert, previousStatus?: string): Promise<void> {
  try {
    // const stats = await redis.hGetAll('alert:statistics')

    // Increment total if this is a new alert
    if (!previousStatus) {
      await redis.hIncrBy('alert:statistics', 'total', 1)
    }

    // Update status counters
    if (previousStatus !== alert.status) {
      if (previousStatus) {
        await redis.hIncrBy('alert:statistics', previousStatus, -1)
      }
      await redis.hIncrBy('alert:statistics', alert.status, 1)
    }

    // Update severity counters
    await redis.hIncrBy('alert:statistics', alert.severity, 1)

    // Update source counters
    await redis.hIncrBy('alert:statistics', alert.source, 1)

  } catch (error) {
    console.error('Error updating alert statistics:', error)
  }
}