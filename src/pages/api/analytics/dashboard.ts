/**
 * Analytics Dashboard API Endpoint
 * 
 * Production-grade API endpoint for serving analytics dashboard data
 * with proper error handling, validation, and HIPAA compliance.
 */

import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import type { BaseAPIContext } from '@/lib/auth/apiRouteTypes'
import { AnalyticsService } from '@/lib/services/analytics/AnalyticsService'
import { EventType } from '@/lib/services/analytics/analytics-types'
import type {
  AnalyticsChartData,
  AnalyticsFilters,
  SessionData,
  SkillProgressData,
  MetricSummary,
} from '@/types/analytics'
import type { Event, Metric } from '@/lib/services/analytics/analytics-types'

const logger = createBuildSafeLogger('analytics-dashboard-api')

interface ApiError {
  code: string
  message: string
  details?: unknown
}

/**
 * Validate analytics filters
 */
function validateFilters(filters: unknown): AnalyticsFilters {
  if (!filters || typeof filters !== 'object') {
    throw new Error('Invalid filters object')
  }

  const { timeRange, userSegment, skillCategory } = filters as Record<string, unknown>

  // Validate timeRange
  if (!timeRange || !['7d', '30d', '90d', '1y'].includes(timeRange as string)) {
    throw new Error('Invalid timeRange. Must be one of: 7d, 30d, 90d, 1y')
  }

  // Validate userSegment (optional)
  if (userSegment && !['all', 'new', 'returning'].includes(userSegment as string)) {
    throw new Error('Invalid userSegment. Must be one of: all, new, returning')
  }

  // Validate skillCategory (optional)
  if (skillCategory && !['all', 'therapeutic', 'technical', 'interpersonal'].includes(skillCategory as string)) {
    throw new Error('Invalid skillCategory. Must be one of: all, therapeutic, technical, interpersonal')
  }

  return {
    timeRange: timeRange as '7d' | '30d' | '90d' | '1y',
    userSegment: (userSegment as 'all' | 'new' | 'returning') || 'all',
    skillCategory: (skillCategory as 'all' | 'therapeutic' | 'technical' | 'interpersonal') || 'all',
  }
}

/**
 * Get time range in milliseconds
 */
function getTimeRangeInMs(timeRange: string): number {
  const timeRanges = {
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000,
    '1y': 365 * 24 * 60 * 60 * 1000,
  }
  return timeRanges[timeRange as keyof typeof timeRanges] || timeRanges['7d']
}

/**
 * Aggregate session data from events
 */
function aggregateSessionData(events: Event[], timeRange: string): SessionData[] {
  const daysMapping = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 } as const
  const daysCount = daysMapping[timeRange as keyof typeof daysMapping] ?? 7
  const groupedData = new Map<string, SessionData>()

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
  events.forEach(event => {
    const date = new Date(event.timestamp).toISOString().split('T')[0]
    if (date) {
      const existing = groupedData.get(date)
      if (existing) {
        existing.sessions += 1
        // Additional aggregation based on event properties
        if (event.properties?.['isNewUser']) {
          existing.newUsers = (existing.newUsers || 0) + 1
        } else {
          existing.returningUsers = (existing.returningUsers || 0) + 1
        }
        if (typeof event.properties?.['duration'] === 'number') {
          existing.averageDuration = ((existing.averageDuration || 0) + event.properties['duration']) / 2
        }
      }
    }
  })

  return Array.from(groupedData.values()).reverse()
}

/**
 * Process skill progress data
 */
function processSkillProgress(metrics: Record<string, Metric[]>): SkillProgressData[] {
  const skillCategories = {
    active_listening: 'interpersonal' as const,
    empathy: 'therapeutic' as const,
    cbt_techniques: 'therapeutic' as const,
    crisis_management: 'technical' as const,
  }

  return Object.entries(metrics).map(([skillName, skillMetrics]) => {
    const currentScore = skillMetrics[skillMetrics.length - 1]?.value || 0
    const previousScore = skillMetrics.length > 1 ? skillMetrics[skillMetrics.length - 2]?.value : currentScore

    const trend = (previousScore !== undefined) ? 
      (currentScore > previousScore ? 'up' : currentScore < previousScore ? 'down' : 'stable') : 
      'stable'

    return {
      skill: skillName.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' '),
      score: Math.round(currentScore),
      previousScore: Math.round(previousScore ?? currentScore),
      trend,
      category: skillCategories[skillName as keyof typeof skillCategories] || 'technical',
    }
  })
}

/**
 * Calculate trend for metric
 */
async function calculateTrend(
  analyticsService: AnalyticsService,
  metricName: string,
  timeRange: string
): Promise<{ value: number; direction: 'up' | 'down' | 'stable'; period: string } | undefined> {
  try {
    const currentPeriod = getTimeRangeInMs(timeRange)
    const endTime = Date.now()
    const currentStart = endTime - currentPeriod
    const previousStart = currentStart - currentPeriod

    const [current, previous] = await Promise.all([
      analyticsService.getMetrics({
        name: metricName,
        startTime: currentStart,
        endTime,
      }),
      analyticsService.getMetrics({
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

    const changePercent = ((currentValue - previousValue) / previousValue) * 100

    return {
      value: Math.abs(Math.round(changePercent)),
      direction: changePercent > 0 ? 'up' : changePercent < 0 ? 'down' : 'stable',
      period: `vs previous ${timeRange}`,
    }
  } catch (error) {
    logger.error(`Failed to calculate trend for ${metricName}`, { error })
    return undefined
  }
}

/**
 * POST endpoint for analytics dashboard data
 */
/**
 * Type definition for API Route handler
 */
type APIRoute = (context: BaseAPIContext) => Response | Promise<Response>

/**
 * POST endpoint for generating test analytics data
 */
export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now()
  
  try {
    // Parse and validate request body
    const body = await request.json()
    const filters = validateFilters(body)
    
    logger.info('Processing analytics dashboard request', { filters })
    
    // Initialize analytics service
    const analyticsService = new AnalyticsService()
    
    // Calculate time range
    const timeRangeMs = getTimeRangeInMs(filters.timeRange)
    const endTime = Date.now()
    const startTimeQuery = endTime - timeRangeMs

    // Fetch data in parallel for better performance
    const [sessionEvents, skillMetrics, summaryMetrics] = await Promise.all([
      // Session events
      analyticsService.getEvents({
        type: EventType.THERAPY_SESSION,
        startTime: startTimeQuery,
        endTime,
      }),
      
      // Skill metrics
      Promise.all([
        analyticsService.getMetrics({ name: 'active_listening', startTime: startTimeQuery, endTime }),
        analyticsService.getMetrics({ name: 'empathy', startTime: startTimeQuery, endTime }),
        analyticsService.getMetrics({ name: 'cbt_techniques', startTime: startTimeQuery, endTime }),
        analyticsService.getMetrics({ name: 'crisis_management', startTime: startTimeQuery, endTime }),
      ]).then(results => ({
        active_listening: results[0],
        empathy: results[1],
        cbt_techniques: results[2],
        crisis_management: results[3],
      })),
      
      // Summary metrics
      Promise.all([
        analyticsService.getMetrics({ name: 'total_sessions', startTime: startTimeQuery, endTime }),
        analyticsService.getMetrics({ name: 'completion_rate', startTime: startTimeQuery, endTime }),
        analyticsService.getMetrics({ name: 'average_rating', startTime: startTimeQuery, endTime }),
      ]),
    ])

    // Process the data
    const sessionMetrics = aggregateSessionData(sessionEvents, filters.timeRange)
    const skillProgress = processSkillProgress(skillMetrics)

    // Calculate summary statistics with trends
    const [sessionCount, completionRate, avgRating] = summaryMetrics
    
    const summaryStats: MetricSummary[] = [
      {
        value: sessionCount.reduce((sum, m) => sum + m.value, 0),
        label: 'Total Sessions',
        color: 'blue',
        trend: await calculateTrend(analyticsService, 'total_sessions', filters.timeRange),
      },
      {
        value: Math.round((completionRate.reduce((sum, m) => sum + m.value, 0) / Math.max(completionRate.length, 1)) * 100),
        label: 'Completion Rate (%)',
        color: 'green',
        trend: await calculateTrend(analyticsService, 'completion_rate', filters.timeRange),
      },
      {
        value: Math.round((avgRating.reduce((sum, m) => sum + m.value, 0) / Math.max(avgRating.length, 1)) * 10) / 10,
        label: 'Avg. Rating',
        color: 'purple',
        trend: await calculateTrend(analyticsService, 'average_rating', filters.timeRange),
      },
    ]

    const responseData: AnalyticsChartData = {
      sessionMetrics,
      skillProgress,
      summaryStats,
    }

    const processingTime = Date.now() - startTime
    logger.info('Analytics dashboard request completed', { 
      filters, 
      processingTime,
      dataPoints: {
        sessions: sessionMetrics.length,
        skills: skillProgress.length,
        summaries: summaryStats.length,
      }
    })

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=300', // Cache for 5 minutes
      },
    })

  } catch (error) {
    const processingTime = Date.now() - startTime
    logger.error('Analytics dashboard request failed', { error, processingTime })

    const apiError: ApiError = {
      code: error instanceof Error && error.message.includes('Invalid') ? 'VALIDATION_ERROR' : 'PROCESSING_ERROR',
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      details: {
        processingTime,
        timestamp: new Date().toISOString(),
      },
    }

    return new Response(JSON.stringify(apiError), {
      status: error instanceof Error && error.message.includes('Invalid') ? 400 : 500,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }
}

/**
 * GET endpoint for health check
 */
/**
 * GET endpoint for retrieving analytics dashboard data
 */
export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}
