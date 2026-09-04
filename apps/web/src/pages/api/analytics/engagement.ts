import { requirePageAuth } from '@/lib/auth/serverAuth'
import { EventType } from '@/lib/services/analytics/analytics-types'
import { AnalyticsService } from '@/lib/services/analytics/AnalyticsService'

import type {
  EngagementMetrics,
  ChartData,
  InteractionMetric,
  ActivityEntry,
  AnalyticsError,
} from './types'

// Disable prerendering since this API route uses request.headers
export const prerender = false

export const GET = async ({ request }: { request: Request }) => {
  try {
    // Enforce authentication. requirePageAuth RETURNS a redirect Response on
    // failure (it does NOT throw), so we must short-circuit on the result.
    const authRes = await requirePageAuth({
      request,
    })
    if (authRes) return authRes

    const analyticsService = new AnalyticsService()
    const endTime = Date.now()
    const startOfToday = new Date()
    startOfToday.setUTCHours(0, 0, 0, 0)
    // Align the window start to UTC midnight so the first (previously
    // partial) day is included in full.
    const startTime = startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000

    // Fetch real data
    const [therapySessions, userActions, pageViews] = await Promise.all([
      analyticsService.getEvents({
        type: EventType.THERAPY_SESSION,
        startTime,
        endTime,
      }),
      analyticsService.getEvents({
        type: EventType.USER_ACTION,
        startTime,
        endTime,
      }),
      analyticsService.getEvents({
        type: EventType.PAGE_VIEW,
        startTime,
        endTime,
      }),
    ])

    // Process daily trends for the last 7 days
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    // Initialize 7 days data structure (ordered chronologically ending today)
    const dailyData = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfToday.getTime() - (6 - i) * 24 * 60 * 60 * 1000)
      const dateString = d.toISOString().split('T')[0]
      return {
        dateString,
        label: days[d.getDay()] || '',
        sessions: 0,
        uniqueUsers: new Set<string>(),
        durations: [] as number[],
        actions: 0,
      }
    })

    const getDateIndex = (timestamp: number) => {
      const dateString = new Date(timestamp).toISOString().split('T')[0]
      return dailyData.findIndex((d) => d.dateString === dateString)
    }

    therapySessions.forEach((session) => {
      const idx = getDateIndex(session.timestamp)
      if (idx !== -1 && dailyData[idx]) {
        const dd = dailyData[idx]
        dd.sessions++
        if (session.userId) dd.uniqueUsers.add(session.userId)
        if (typeof session.properties?.['duration'] === 'number') {
          dd.durations.push(session.properties['duration'])
        }
      }
    })

    userActions.forEach((action) => {
      const idx = getDateIndex(action.timestamp)
      if (idx !== -1 && dailyData[idx]) {
        dailyData[idx].actions++
      }
    })

    const labels = dailyData.map((d) => d.label)

    const sessionTrends: ChartData = {
      labels,
      series: [
        {
          name: 'Sessions',
          data: dailyData.map((d) => d.sessions),
          color: 'rgba(59, 130, 246, 0.5)',
        },
        {
          name: 'Unique Users',
          data: dailyData.map((d) => d.uniqueUsers.size),
          color: 'rgba(16, 185, 129, 0.5)',
        },
      ],
    }

    const engagementRateTrend: ChartData = {
      labels,
      series: [
        {
          name: 'Engagement Rate (%)',
          data: dailyData.map((d) => {
            const rate =
              d.sessions > 0
                ? Math.min(
                    100,
                    Math.round((d.actions / Math.max(1, d.sessions)) * 100),
                  )
                : 0
            return rate
          }),
          color: 'rgba(139, 92, 246, 0.5)',
        },
      ],
    }

    const sessionDurationTrend: ChartData = {
      labels,
      series: [
        {
          name: 'Average Duration (min)',
          data: dailyData.map((d) => {
            if (d.durations.length === 0) return 0
            const sum = d.durations.reduce((acc, curr) => acc + curr, 0)
            return Math.round((sum / d.durations.length) * 10) / 10
          }),
          color: 'rgba(249, 115, 22, 0.5)',
        },
      ],
    }

    // Process interaction breakdown from user actions
    const interactionCounts: Record<string, number> = {}
    userActions.forEach((action) => {
      const type =
        (action.properties?.['actionType'] as string) ||
        (action.properties?.['type'] as string) ||
        'General Action'
      interactionCounts[type] = (interactionCounts[type] || 0) + 1
    })

    let interactionBreakdown: InteractionMetric[] = Object.entries(
      interactionCounts,
    )
      .map(([label, value]) => ({ label: label, value: value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)

    if (interactionBreakdown.length === 0) {
      interactionBreakdown = [
        { label: 'Chat Responses', value: 0 },
        { label: 'Tool Usage', value: 0 },
        { label: 'Form Submissions', value: 0 },
      ]
    }

    // Process recent activity
    // Get latest 5 events
    const allRecentEvents = [...therapySessions, ...userActions]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5)

    const recentActivity: ActivityEntry[] = allRecentEvents.map((event) => {
      const isSession = event.type === EventType.THERAPY_SESSION
      return {
        user: event.userId ?? 'Anonymous',
        action: isSession
          ? 'Session Completed'
          : String(event.properties?.['actionType'] ?? 'Action Performed'),
        duration:
          typeof event.properties?.['duration'] === 'number'
            ? event.properties['duration']
            : 0,
        timestamp: event.timestamp,
        sessionScore:
          typeof event.properties?.['score'] === 'number'
            ? event.properties['score']
            : 0,
      }
    })

    // Calculate totals
    const totalSessions = therapySessions.length
    const uniqueActiveUsers = new Set(
      [...therapySessions, ...userActions, ...pageViews]
        .map((e) => e.userId)
        .filter(Boolean),
    ).size

    // Average duration across all sessions
    const allDurations = therapySessions
      .map((s) => s.properties?.['duration'])
      .filter((d): d is number => typeof d === 'number')

    const avgSessionDuration =
      allDurations.length > 0
        ? Math.round(
            (allDurations.reduce((a, b) => a + b, 0) / allDurations.length) *
              10,
          ) / 10
        : 0

    const engagementRate =
      totalSessions > 0
        ? Math.min(
            100,
            Math.round((userActions.length / Math.max(1, totalSessions)) * 100),
          )
        : 0

    const metrics: EngagementMetrics = {
      totalSessions,
      engagementRate,
      avgSessionDuration,
      activeUsers: uniqueActiveUsers,
      sessionTrends,
      engagementRateTrend,
      sessionDurationTrend,
      interactionBreakdown,
      recentActivity,
    }

    return new Response(JSON.stringify(metrics), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=60',
      },
    })
  } catch (error: unknown) {
    // Log error securely (avoid leaking sensitive info)

    const apiError: AnalyticsError = {
      code: 'PROCESSING_ERROR',
      errorMessage: 'Failed to fetch engagement metrics',
      details: {
        source: 'engagement',
        message: error instanceof Error ? String(error) : String(error),
      },
    } as Record<string, unknown>

    const status =
      error && typeof error === 'object' && 'status' in error
        ? (error as { status: number }).status
        : 500

    return new Response(JSON.stringify(apiError), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
