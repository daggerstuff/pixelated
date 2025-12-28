/**
 * Analytics Data Service
 *
 * Production-grade service for fetching analytics data with proper error handling,
 * caching, retry logic, and type safety.
 */

import { createBuildSafeLogger } from '../logging/build-safe-logger'
import type {
  AnalyticsChartData,
  SessionData,
  SkillProgressData,
  MetricSummary,
  AnalyticsError,
  AnalyticsServiceConfig,
  TimeRange,
  AnalyticsFilters,
} from '@/types/analytics'
import type { Event, Metric } from '@/lib/services/analytics/analytics-types'
import { EventType } from '@/lib/services/analytics/analytics-types'
import { AnalyticsService } from '@/lib/services/analytics/AnalyticsService'

const logger = createBuildSafeLogger('analytics-data-service')

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

export class AnalyticsDataService {
  private static instance: AnalyticsDataService
  private cache = new Map<string, CacheEntry<unknown>>()
  private analyticsService: AnalyticsService
  private config: AnalyticsServiceConfig

  private constructor(config?: Partial<AnalyticsServiceConfig>) {
    this.config = {
      apiBaseUrl: '/api/analytics',
      refreshInterval: 300000, // 5 minutes
      retryAttempts: 3,
      timeoutMs: 10000,
      ...config,
    }
    this.analyticsService = new AnalyticsService()
  }

  static getInstance(
    config?: Partial<AnalyticsServiceConfig>,
  ): AnalyticsDataService {
    if (!AnalyticsDataService.instance) {
      AnalyticsDataService.instance = new AnalyticsDataService(config)
    }
    return AnalyticsDataService.instance
  }

  /**
   * Fetch complete analytics data for dashboard
   */
  async fetchAnalyticsData(
    filters: AnalyticsFilters,
  ): Promise<AnalyticsChartData> {
    const cacheKey = `analytics-${JSON.stringify(filters)}`

    try {
      // Check cache first
      const cachedData = this.getCachedData<AnalyticsChartData>(cacheKey)
      if (cachedData) {
        logger.debug('Returning cached analytics data')
        return cachedData
      }

      logger.info('Fetching fresh analytics data', { filters })

      // Fetch data in parallel for better performance
      const [sessionMetrics, skillProgress, summaryStats] = await Promise.all([
        this.fetchSessionMetrics(filters),
        this.fetchSkillProgress(filters),
        this.fetchSummaryStats(filters),
      ])

      const analyticsData: AnalyticsChartData = {
        sessionMetrics,
        skillProgress,
        summaryStats,
      }

      // Cache the result
      this.setCachedData(cacheKey, analyticsData, this.config.refreshInterval)

      return analyticsData
    } catch (error: unknown) {
      logger.error('Failed to fetch analytics data', { error, filters })
      throw this.handleError(error)
    }
  }

  /**
   * Fetch session metrics data
   */
  private async fetchSessionMetrics(
    filters: AnalyticsFilters,
  ): Promise<SessionData[]> {
    const timeRange = this.getTimeRangeInMs(filters.timeRange)
    const endTime = Date.now()
    const startTime = endTime - timeRange

    try {
      const events = await this.analyticsService.getEvents({
        type: EventType.THERAPY_SESSION,
        startTime,
        endTime,
      })

      return this.aggregateSessionData(events, filters.timeRange)
    } catch (error: unknown) {
      logger.error('Failed to fetch session metrics', { error })
      throw new Error('Failed to fetch session metrics', { cause: error })
    }
  }

  /**
   * Fetch skill progress data
   */
  private async fetchSkillProgress(
    filters: AnalyticsFilters,
  ): Promise<SkillProgressData[]> {
    try {
      const skillMetrics = await Promise.all([
        this.fetchSkillMetric('active_listening', filters),
        this.fetchSkillMetric('empathy', filters),
        this.fetchSkillMetric('cbt_techniques', filters),
        this.fetchSkillMetric('crisis_management', filters),
      ])

      return skillMetrics.filter(Boolean) as SkillProgressData[]
    } catch (error: unknown) {
      logger.error('Failed to fetch skill progress', { error })
      throw new Error('Failed to fetch skill progress data', { cause: error })
    }
  }

  /**
   * Fetch summary statistics
   */
  private async fetchSummaryStats(
    filters: AnalyticsFilters,
  ): Promise<MetricSummary[]> {
    const timeRange = this.getTimeRangeInMs(filters.timeRange)
    const endTime = Date.now()
    const startTime = endTime - timeRange

    try {
      const [sessionCount, completionRate, avgRating] = await Promise.all([
        this.analyticsService.getMetrics({
          name: 'total_sessions',
          startTime,
          endTime,
        }),
        this.analyticsService.getMetrics({
          name: 'completion_rate',
          startTime,
          endTime,
        }),
        this.analyticsService.getMetrics({
          name: 'average_rating',
          startTime,
          endTime,
        }),
      ])

      return [
        {
          value: this.calculateTotalSessions(sessionCount),
          label: 'Total Sessions',
          color: 'blue' as const,
          trend: await this.calculateTrend('total_sessions', filters.timeRange),
        },
        {
          value: this.calculateCompletionRate(completionRate),
          label: 'Completion Rate',
          color: 'green' as const,
          trend: await this.calculateTrend(
            'completion_rate',
            filters.timeRange,
          ),
        },
        {
          value: this.calculateAverageRating(avgRating),
          label: 'Avg. Rating',
          color: 'purple' as const,
          trend: await this.calculateTrend('average_rating', filters.timeRange),
        },
      ]
    } catch (error: unknown) {
      logger.error('Failed to fetch summary stats', { error })
      throw new Error('Failed to fetch summary statistics', { cause: error })
    }
  }

  /**
   * Helper methods for data processing
   */
  private aggregateSessionData(
    events: Event[],
    timeRange: TimeRange,
  ): SessionData[] {
    const groupedData = new Map<string, SessionData>()
    const daysCount = this.getTimeRangeDays(timeRange)

    // Initialize data for each day
    for (let i = 0; i < daysCount; i++) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      const dateKey = date.toISOString().split('T')[0]
      if (dateKey) {
        groupedData.set(dateKey, {
          date: dateKey,
          sessions: 0,
          newUsers: 0,
          returningUsers: 0,
          averageDuration: 0,
        })
      }
    }

    // Aggregate events by date
    events.forEach((event) => {
      const date = new Date(event.timestamp).toISOString().split('T')[0]
      if (date) {
        const existing = groupedData.get(date)
        if (existing) {
          existing.sessions += 1
          // Additional aggregation logic based on event properties
        }
      }
    })

    return Array.from(groupedData.values()).reverse()
  }

  private async fetchSkillMetric(
    skillName: string,
    filters: AnalyticsFilters,
  ): Promise<SkillProgressData | null> {
    try {
      const timeRange = this.getTimeRangeInMs(filters.timeRange)
      const endTime = Date.now()
      const startTime = endTime - timeRange

      const metrics = await this.analyticsService.getMetrics({
        name: skillName,
        startTime,
        endTime,
      })

      if (metrics.length === 0) {
        return null
      }

      const currentScore = metrics[metrics.length - 1]?.value || 0
      const previousScore =
        metrics.length > 1 ? metrics[metrics.length - 2]?.value : currentScore
      const safePreviousScore = previousScore ?? currentScore

      return {
        skill: this.formatSkillName(skillName),
        score: Math.round(currentScore),
        previousScore: Math.round(safePreviousScore),
        trend: this.calculateTrendDirection(currentScore, safePreviousScore),
        category: this.getSkillCategory(skillName),
      }
    } catch (error: unknown) {
      logger.error(`Failed to fetch skill metric: ${skillName}`, { error })
      return null
    }
  }

  private calculateTotalSessions(metrics: Metric[]): number {
    return metrics.reduce((sum, metric) => sum + metric.value, 0)
  }

  private calculateCompletionRate(metrics: Metric[]): number {
    if (metrics.length === 0) {
      return 0
    }
    const avgRate =
      metrics.reduce((sum, metric) => sum + metric.value, 0) / metrics.length
    return Math.round(avgRate * 100) // Convert to percentage
  }

  private calculateAverageRating(metrics: Metric[]): number {
    if (metrics.length === 0) {
      return 0
    }
    const avgRating =
      metrics.reduce((sum, metric) => sum + metric.value, 0) / metrics.length
    return Math.round(avgRating * 10) / 10 // Round to 1 decimal
  }

  private async calculateTrend(metricName: string, timeRange: TimeRange): void {
    try {
      const currentPeriod = this.getTimeRangeInMs(timeRange)
      const endTime = Date.now()
      const currentStart = endTime - currentPeriod
      const previousStart = currentStart - currentPeriod

      const [current, previous] = await Promise.all([
        this.analyticsService.getMetrics({
          name: metricName,
          startTime: currentStart,
          endTime,
        }),
        this.analyticsService.getMetrics({
          name: metricName,
          startTime: previousStart,
          endTime: currentStart,
        }),
      ])

      const currentValue = current.reduce((sum, m) => sum + m.value, 0)
      const previousValue = previous.reduce((sum, m) => sum + m.value, 0)

      if (previousValue === 0) {
        return undefined
      }

      const changePercent =
        ((currentValue - previousValue) / previousValue) * 100

      return {
        value: Math.abs(Math.round(changePercent)),
        direction:
          changePercent > 0
            ? ('up' as const)
            : changePercent < 0
              ? ('down' as const)
              : ('stable' as const),
        period: `vs previous ${timeRange}`,
      }
    } catch (error: unknown) {
      logger.error(`Failed to calculate trend for ${metricName}`, { error })
      return undefined
    }
  }

  /**
   * Utility methods
   */
  private getTimeRangeInMs(timeRange: TimeRange): number {
    const timeRanges = {
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '90d': 90 * 24 * 60 * 60 * 1000,
      '1y': 365 * 24 * 60 * 60 * 1000,
    }
    return timeRanges[timeRange]
  }

  private getTimeRangeDays(timeRange: TimeRange): number {
    const days = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }
    return days[timeRange]
  }

  private formatSkillName(skillName: string): string {
    return skillName
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  private calculateTrendDirection(
    current: number,
    previous: number,
  ): 'up' | 'down' | 'stable' {
    const threshold = 0.05 // 5% threshold for stable
    const change = (current - previous) / previous

    if (Math.abs(change) <= threshold) {
      return 'stable'
    }
    return change > 0 ? 'up' : 'down'
  }

  private getSkillCategory(
    skillName: string,
  ): 'therapeutic' | 'technical' | 'interpersonal' {
    const categoryMap = {
      active_listening: 'interpersonal' as const,
      empathy: 'therapeutic' as const,
      cbt_techniques: 'therapeutic' as const,
      crisis_management: 'technical' as const,
    }
    return categoryMap[skillName as keyof typeof categoryMap] || 'technical'
  }

  /**
   * Cache management
   */
  private getCachedData<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined
    if (!entry) {
      return null
    }

    const isExpired = Date.now() > entry.timestamp + entry.ttl
    if (isExpired) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  private setCachedData<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    })
  }

  /**
   * Error handling
   */
  private handleError(error: unknown): AnalyticsError {
    if (error instanceof Error) {
      return {
        code: 'FETCH_ERROR',
        message: String(error),
        details: (error as Error)?.stack,
      }
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: 'An unknown error occurred while fetching analytics data',
      details: error,
    }
  }

  /**
   * Clear cache (useful for testing or forced refresh)
   */
  clearCache() {
    this.cache.clear()
    logger.info('Analytics cache cleared')
  }
}
