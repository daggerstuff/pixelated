/**
 * Rate limiting analytics and monitoring
 * Provides real-time metrics, dashboards, and alerting
 */

import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { redis } from '../redis'
import { defaultRuleSets } from './config'
import type {
  RateLimitAnalytics,
  RateLimitAlert,
  RateLimitMonitor,
  RateLimitRule,
} from './distributed-types'

const logger = createBuildSafeLogger('rate-limit-analytics')

/**
 * Rate limiting analytics service
 */
export class RateLimitAnalyticsService {
  private readonly analyticsPrefix = 'rate_analytics:'
  private readonly alertPrefix = 'rate_alerts:'
  private monitors: RateLimitMonitor[] = []

  private parseJsonSafely(value: string): unknown {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }

  private parseAlertDetailsValue(value: unknown, fallback = 0): number {
    return typeof value === 'number' && Number.isFinite(value)
      ? value
      : fallback
  }

  private isRateLimitAlert(value: unknown): value is RateLimitAlert {
    if (!value || typeof value !== 'object') {
      return false
    }

    const candidate = value as {
      type?: string
      severity?: string
      message?: unknown
      timestamp?: unknown
      details?: unknown
    }

    return (
      typeof candidate.type === 'string' &&
      [
        'attack_detected',
        'ddos_detected',
        'rate_limit_exceeded',
        'system_error',
      ].includes(candidate.type) &&
      typeof candidate.severity === 'string' &&
      typeof candidate.message === 'string' &&
      typeof candidate.timestamp === 'number' &&
      typeof candidate.details === 'object'
    )
  }

  constructor() {
    this.startMonitoring()
  }

  /**
   * Record rate limit event
   */
  async recordEvent(
    eventType: 'request' | 'blocked' | 'attack_detected' | 'error',
    rule: RateLimitRule,
    identifier: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const timestamp = Date.now()
    const date = new Date(timestamp).toISOString().slice(0, 10)
    const hour = new Date(timestamp).getHours()

    const analyticsKey = `${this.analyticsPrefix}${rule.name}:${date}`
    const hourlyKey = `${this.analyticsPrefix}hourly:${rule.name}:${date}:${hour}`

    try {
      if (!redis) {
        logger.warn('Redis not available, skipping rate limit event recording')
        return
      }

      // Record hash fields directly (no pipeline — avoids INCR/HINCRBY type conflict on same key)
      await redis.hincrby(analyticsKey, `${eventType}_total`, 1)
      await redis.hincrby(analyticsKey, 'total_events', 1)
      await redis.hset(analyticsKey, 'last_updated', String(timestamp))
      await redis.expire(analyticsKey, 86400 * 30)
      await redis.hincrby(hourlyKey, `${eventType}_total`, 1)
      await redis.hincrby(hourlyKey, 'total_events', 1)
      await redis.hset(hourlyKey, 'last_updated', String(timestamp))
      await redis.expire(hourlyKey, 86400 * 7)

      // Check for alert conditions
      if (eventType === 'blocked' || eventType === 'attack_detected') {
        await this.checkAlertConditions(rule, identifier, eventType, metadata)
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(`Failed to record rate limit event: ${errorMessage}`, {
        eventType,
        rule: rule.name,
        identifier,
      })
    }
  }

  /**
   * Get analytics data for a specific rule and date range
   */
  async getAnalytics(
    ruleName: string,
    days = 7,
    includeHourly = false,
  ): Promise<RateLimitAnalytics[]> {
    const analytics: RateLimitAnalytics[] = []
    const now = new Date()

    try {
      for (let i = 0; i < days; i++) {
        const date = new Date(now.getTime() - i * 86400000)
        const dateStr = date.toISOString().slice(0, 10)

        const dailyKey = `${this.analyticsPrefix}${ruleName}:${dateStr}`
        if (!redis) {
          continue
        }
        const dailyData = (await redis.hgetall(dailyKey)) ?? {}

        if (Object.keys(dailyData).length > 0) {
          const analyticsEntry: RateLimitAnalytics = {
            date: dateStr,
            totalRequests: parseInt(dailyData['request_total'] ?? '0'),
            blockedRequests: parseInt(dailyData['blocked_total'] ?? '0'),
            uniqueIdentifiers: parseInt(dailyData['unique_identifiers'] ?? '0'),
            topBlocked: [],
            attackPatterns: [],
          }

          // Get hourly data if requested
          if (includeHourly) {
            const hourlyData = await this.getHourlyAnalytics(ruleName, dateStr)
            analyticsEntry.hourlyData = hourlyData
          }

          analytics.push(analyticsEntry)
        }
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(`Failed to get analytics: ${errorMessage}`, {
        ruleName,
        days,
      })
    }

    return analytics
  }

  /**
   * Get hourly analytics for a specific date
   */
  private async getHourlyAnalytics(
    ruleName: string,
    date: string,
  ): Promise<
    Array<{
      hour: number
      totalRequests: number
      blockedRequests: number
      attackDetections: number
      errors: number
    }>
  > {
    const hourlyData: Array<{
      hour: number
      totalRequests: number
      blockedRequests: number
      attackDetections: number
      errors: number
    }> = []

    for (let hour = 0; hour < 24; hour++) {
      const hourlyKey = `${this.analyticsPrefix}hourly:${ruleName}:${date}:${hour}`
      if (!redis) {
        continue
      }
      const data = (await redis.hgetall(hourlyKey)) ?? {}

      if (Object.keys(data).length > 0) {
        hourlyData.push({
          hour,
          totalRequests: parseInt(data['request_total'] ?? '0'),
          blockedRequests: parseInt(data['blocked_total'] ?? '0'),
          attackDetections: parseInt(data['attack_detected_total'] ?? '0'),
          errors: parseInt(data['error_total'] ?? '0'),
        })
      }
    }

    return hourlyData
  }

  /**
   * Get real-time metrics
   */
  async getRealTimeMetrics(): Promise<{
    totalRequests: number
    blockedRequests: number
    attackDetections: number
    errorRate: number
    topRules: Array<{ rule: string; requests: number }>
    topIdentifiers: Array<{ identifier: string; requests: number }>
  }> {
    try {
      const now = new Date()
      const today = now.toISOString().slice(0, 10)

      // Get today's data across all rules
      if (!redis) {
        throw new Error('Redis not available')
      }
      const ruleKeys = await redis.keys(`${this.analyticsPrefix}*:${today}`)
      let totalRequests = 0
      let blockedRequests = 0
      let attackDetections = 0
      let errors = 0
      const ruleStats: Record<string, number> = {}
      const identifierStats: Record<string, number> = {}

      for (const key of ruleKeys) {
        const data = (await redis.hgetall(key)) ?? {}
        const ruleName = key.split(':')[1] ?? 'unknown'

        const requests = parseInt(data['request_total'] ?? '0')
        const blocked = parseInt(data['blocked_total'] ?? '0')
        const attacks = parseInt(data['attack_detected_total'] ?? '0')
        const errorCount = parseInt(data['error_total'] ?? '0')

        totalRequests += requests
        blockedRequests += blocked
        attackDetections += attacks
        errors += errorCount

        ruleStats[ruleName] = (ruleStats[ruleName] ?? 0) + requests
      }

      const errorRate = totalRequests > 0 ? (errors / totalRequests) * 100 : 0

      return {
        totalRequests,
        blockedRequests,
        attackDetections,
        errorRate: Math.round(errorRate * 100) / 100,
        topRules: Object.entries(ruleStats)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([rule, requests]) => ({ rule, requests })),
        topIdentifiers: Object.entries(identifierStats)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([identifier, requests]) => ({ identifier, requests })),
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(`Failed to get real-time metrics: ${errorMessage}`)
      return {
        totalRequests: 0,
        blockedRequests: 0,
        attackDetections: 0,
        errorRate: 0,
        topRules: [],
        topIdentifiers: [],
      }
    }
  }

  /**
   * Check alert conditions and trigger alerts if necessary
   */
  private async checkAlertConditions(
    rule: RateLimitRule,
    identifier: string,
    eventType: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const metrics = await this.getRealTimeMetrics()

    // Check for high block rate
    if (metrics.blockedRequests > 100 && metrics.errorRate > 10) {
      await this.triggerAlert({
        type: 'rate_limit_exceeded',
        severity: 'high',
        message: `High block rate detected: ${metrics.blockedRequests} blocked requests`,
        timestamp: Date.now(),
        details: {
          rule: rule.name,
          identifier,
          blockedRate: metrics.blockedRequests,
          errorRate: metrics.errorRate,
          metadata,
        },
      })
    }

    // Check for attack detection
    if (eventType === 'attack_detected') {
      await this.triggerAlert({
        type: 'attack_detected',
        severity: 'critical',
        message: `Attack pattern detected for rule: ${rule.name}`,
        timestamp: Date.now(),
        details: {
          rule: rule.name,
          identifier,
          metadata,
        },
      })
    }

    // Check for DDoS-like patterns
    if (
      metrics.totalRequests > 1000 &&
      metrics.blockedRequests > metrics.totalRequests * 0.5
    ) {
      await this.triggerAlert({
        type: 'ddos_detected',
        severity: 'critical',
        message: `Potential DDoS attack detected: ${metrics.blockedRequests}/${metrics.totalRequests} requests blocked`,
        timestamp: Date.now(),
        details: {
          rule: rule.name,
          identifier,
          totalRequests: metrics.totalRequests,
          blockedRequests: metrics.blockedRequests,
          blockPercentage:
            (metrics.blockedRequests / metrics.totalRequests) * 100,
        },
      })
    }
  }

  /**
   * Trigger an alert
   */
  private async triggerAlert(alert: RateLimitAlert): Promise<void> {
    try {
      // Store alert in Redis
      if (!redis) {
        return
      }
      const alertKey = `${this.alertPrefix}${Date.now()}`
      await redis.setex(alertKey, 86400 * 7, JSON.stringify(alert)) // Keep for 7 days

      // Execute monitor handlers
      for (const monitor of this.monitors) {
        try {
          const shouldTrigger: boolean = await this.shouldTriggerMonitor(
            monitor,
            alert,
          )
          if (shouldTrigger) {
            for (const handler of monitor.handlers) {
              try {
                await handler(alert)
              } catch (handlerError: unknown) {
                const errorMessage =
                  handlerError instanceof Error
                    ? handlerError.message
                    : String(handlerError)
                logger.error(`Monitor handler failed: ${errorMessage}`, {
                  monitor: monitor.name,
                })
              }
            }
          }
        } catch (monitorError: unknown) {
          const errorMessage =
            monitorError instanceof Error
              ? monitorError.message
              : String(monitorError)
          logger.error(`Monitor check failed: ${errorMessage}`, {
            monitor: monitor.name,
          })
        }
      }

      logger.warn(
        `Rate limit alert triggered: ${alert.type} - ${alert.message}`,
      )
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(`Failed to trigger alert: ${errorMessage}`, {
        alertType: alert.type,
      })
    }
  }

  /**
   * Check if monitor should be triggered
   */
  private async shouldTriggerMonitor(
    monitor: RateLimitMonitor,
    alert: RateLimitAlert,
  ): Promise<boolean> {
    const { thresholds } = monitor

    switch (alert.type) {
      case 'rate_limit_exceeded':
        return (
          !thresholds.rps ||
          this.parseAlertDetailsValue(alert.details['blockedRate'], 0) >
            thresholds.rps
        )
      case 'attack_detected':
        return true // Always trigger for attack detection
      case 'ddos_detected':
        return (
          !thresholds.blockedPercentage ||
          this.parseAlertDetailsValue(alert.details['blockPercentage'], 0) >
            thresholds.blockedPercentage
        )
      case 'system_error':
        return (
          !thresholds.errorRate ||
          this.parseAlertDetailsValue(alert.details['errorRate'], 0) >
            thresholds.errorRate
        )
      default:
        return false
    }
  }

  /**
   * Add a monitor
   */
  addMonitor(monitor: RateLimitMonitor): void {
    this.monitors.push(monitor)
    logger.info('Added rate limit monitor:', { name: monitor.name })
  }

  /**
   * Remove a monitor
   */
  removeMonitor(name: string): void {
    this.monitors = this.monitors.filter((m) => m.name !== name)
    logger.info('Removed rate limit monitor:', { name })
  }

  /**
   * Get recent alerts
   */
  async getRecentAlerts(limit = 50): Promise<RateLimitAlert[]> {
    try {
      if (!redis) {
        return []
      }
      const alertKeys = await redis.keys(`${this.alertPrefix}*`)
      const recentKeys = alertKeys
        .map((key: string) => ({
          key,
          timestamp: parseInt(key.split(':')[1] ?? '0'),
        }))
        .sort(
          (a: { timestamp: number }, b: { timestamp: number }) =>
            b.timestamp - a.timestamp,
        )
        .slice(0, limit)
        .map((item: { key: string }) => item.key)

      const alerts: RateLimitAlert[] = []
      for (const key of recentKeys) {
        const alertData = await redis.get(key)
        if (alertData) {
          try {
            const parsed = this.parseJsonSafely(alertData)
            if (parsed === null) {
              continue
            }
            if (this.isRateLimitAlert(parsed)) {
              alerts.push(parsed)
            }
          } catch (parseError: unknown) {
            const errorMessage =
              parseError instanceof Error
                ? parseError.message
                : String(parseError)
            logger.error(`Failed to parse alert data: ${errorMessage}`, { key })
          }
        }
      }

      return alerts
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(`Failed to get recent alerts: ${errorMessage}`)
      return []
    }
  }

  /**
   * Get analytics summary
   */
  async getAnalyticsSummary(days = 7): Promise<{
    period: string
    totalRequests: number
    totalBlocked: number
    blockRate: number
    topRules: Array<{ rule: string; requests: number; blocked: number }>
    trends: Array<{ date: string; requests: number; blocked: number }>
  }> {
    const allAnalytics: RateLimitAnalytics[] = []

    // Collect analytics from all rules
    for (const ruleSet of defaultRuleSets) {
      for (const rule of ruleSet.rules) {
        const analytics = await this.getAnalytics(rule.name, days, false)
        allAnalytics.push(...analytics)
      }
    }

    // Aggregate data
    const summary = {
      period: `Last ${days} days`,
      totalRequests: 0,
      totalBlocked: 0,
      blockRate: 0,
      topRules: [] as Array<{
        rule: string
        requests: number
        blocked: number
      }>,
      trends: [] as Array<{ date: string; requests: number; blocked: number }>,
    }

    const ruleStats: Partial<
      Record<string, { requests: number; blocked: number }>
    > = {}
    const dailyTrends: Partial<
      Record<string, { requests: number; blocked: number }>
    > = {}

    for (const analytics of allAnalytics) {
      summary.totalRequests += analytics.totalRequests
      summary.totalBlocked += analytics.blockedRequests

      // Rule stats
      const ruleDate = analytics.date
      const ruleDateStats = (ruleStats[ruleDate] ??= {
        requests: 0,
        blocked: 0,
      })
      ruleDateStats.requests += analytics.totalRequests
      ruleDateStats.blocked += analytics.blockedRequests

      // Daily trends
      const dailyStats = (dailyTrends[ruleDate] ??= {
        requests: 0,
        blocked: 0,
      })
      dailyStats.requests += analytics.totalRequests
      dailyStats.blocked += analytics.blockedRequests
    }

    summary.blockRate =
      summary.totalRequests > 0
        ? Math.round((summary.totalBlocked / summary.totalRequests) * 10000) /
          100
        : 0

    summary.topRules = Object.entries(ruleStats)
      .flatMap(([date, stats]) =>
        stats
          ? [
              {
                rule: date,
                requests: stats.requests,
                blocked: stats.blocked,
              },
            ]
          : [],
      )
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10)

    summary.trends = Object.entries(dailyTrends)
      .flatMap(([date, stats]) =>
        stats
          ? [
              {
                date,
                requests: stats.requests,
                blocked: stats.blocked,
              },
            ]
          : [],
      )
      .sort((a, b) => a.date.localeCompare(b.date))

    return summary
  }

  /**
   * Start monitoring loop
   */
  private startMonitoring(): void {
    // Run monitoring checks every 30 seconds
    setInterval(async () => {
      try {
        const metrics = await this.getRealTimeMetrics()

        // Check for concerning patterns
        if (metrics.blockedRequests > 1000 || metrics.errorRate > 5) {
          await this.triggerAlert({
            type: 'system_error',
            severity: metrics.errorRate > 10 ? 'critical' : 'high',
            message: `System health check: ${metrics.blockedRequests} blocked, ${metrics.errorRate}% error rate`,
            timestamp: Date.now(),
            details: metrics,
          })
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        logger.error(`Monitoring check failed: ${errorMessage}`)
      }
    }, 30000) // 30 seconds

    logger.info('Rate limit analytics monitoring started')
  }

  /**
   * Cleanup old analytics data
   */
  async cleanup(olderThanDays = 30): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - olderThanDays * 86400000)
      const cutoffStr = cutoffDate.toISOString().slice(0, 10)

      if (!redis) {
        return
      }
      const keys = await redis.keys(`${this.analyticsPrefix}*`)
      const keysToDelete = keys.filter((key: string) => {
        const keyDate = key.split(':').pop()
        return keyDate && keyDate < cutoffStr
      })

      if (keysToDelete.length > 0) {
        for (const key of keysToDelete) {
          await redis.del(key)
        }
        logger.info('Cleaned up old analytics data:', {
          deletedKeys: keysToDelete.length,
        })
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(`Failed to cleanup analytics data: ${errorMessage}`)
    }
  }
}

/**
 * Create a singleton instance of the analytics service
 */
export const rateLimitAnalytics = new RateLimitAnalyticsService()
