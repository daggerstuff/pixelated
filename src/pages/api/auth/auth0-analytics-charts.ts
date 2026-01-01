/**
 * Auth0-based Analytics Charts API Endpoint
 * Handles analytics chart data with Auth0 integration
 */

import type { APIRoute } from 'astro'
import { validateToken } from '@/lib/auth/auth0-jwt-service'
import { extractTokenFromRequest } from '@/lib/auth/auth0-middleware'
import { getUserById } from '@/services/auth0.service'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { AIRepository } from '@/lib/db/ai/repository'
import { createAuditLog } from '@/lib/audit'

export const prerender = false

const logger = createBuildSafeLogger('auth0-analytics-charts-api')

interface ChartDataRequest {
  type: 'line' | 'bar' | 'pie' | 'scatter'
  timeRange?: number // days
  clientId?: string
  sessionId?: string
  dataPoints?: number
  category?: 'progress' | 'emotions' | 'sessions' | 'outcomes'
}

interface ChartDataResponse {
  data: {
    labels: string[]
    datasets: Array<{
      label: string
      data: number[]
      backgroundColor?: string | string[]
      borderColor?: string
      fill?: boolean
      tension?: number
    }>
  }
  metadata: {
    totalDataPoints: number
    timeRange: string
    lastUpdated: string
    source: string
  }
}

/**
 * Analytics Charts API
 * GET /api/auth/auth0-analytics-charts
 *
 * Provides data for ChartComponent with various chart types and therapy-specific metrics
 */
export const GET: APIRoute = async ({ request }) => {
  try {
    // Extract token from request
    const token = extractTokenFromRequest(request as unknown as Request)

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Validate token
    const validation = await validateToken(token, 'access')

    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Get user from Auth0
    const user = await getUserById(validation.userId!)

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Parse query parameters
    const url = new URL(request.url)
    const type =
      (url.searchParams.get('type') as ChartDataRequest['type']) || 'line'
    const timeRange = parseInt(url.searchParams.get('timeRange') || '30', 10)
    const clientId = url.searchParams.get('clientId')
    const sessionId = url.searchParams.get('sessionId')
    const dataPoints = parseInt(url.searchParams.get('dataPoints') || '50', 10)
    const category =
      (url.searchParams.get('category') as ChartDataRequest['category']) ||
      'progress'

    const repository = new AIRepository()
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - timeRange)

    let chartData: ChartDataResponse

    switch (category) {
      case 'progress':
        chartData = await generateProgressChartData({
          type,
          repository,
          clientId,
          sessionId,
          startDate,
          endDate,
          dataPoints,
        })
        break

      case 'emotions':
        chartData = await generateEmotionChartData({
          type,
          repository,
          clientId,
          sessionId,
          startDate,
          endDate,
          dataPoints,
        })
        break

      case 'sessions':
        chartData = await generateSessionChartData({
          type,
          repository,
          clientId,
          startDate,
          endDate,
          dataPoints,
        })
        break

      case 'outcomes':
        chartData = await generateOutcomeChartData({
          type,
          repository,
          clientId,
          startDate,
          endDate,
          dataPoints,
        })
        break

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid category parameter' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        )
    }

    // Create audit log
    await createAuditLog(
      'analytics_charts_access',
      'auth.components.analytics.charts.access',
      user.id,
      'auth-components-analytics',
      {
        action: 'get_analytics_charts',
        type,
        category,
        dataPoints: chartData.data.datasets[0]?.data.length || 0
      }
    )

    logger.info('Generated chart data', {
      type,
      category,
      dataPoints: chartData.data.datasets[0]?.data.length || 0,
      userId: user.id,
    })

    return new Response(JSON.stringify(chartData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=300', // 5-minute cache
      },
    })
  } catch (error: unknown) {
    logger.error('Error generating chart data', { error })

    // Create audit log for the error
    await createAuditLog(
      'system_error',
      'auth.components.analytics.charts.error',
      'anonymous',
      'auth-components-analytics',
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }
    )

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

async function generateProgressChartData(params: {
  type: string
  repository: AIRepository
  clientId?: string | null
  sessionId?: string | null
  startDate: Date
  endDate: Date
  dataPoints: number
}): Promise<ChartDataResponse> {
  const {
    type,
    repository: _repository,
    clientId: _clientId,
    sessionId: _sessionId,
    startDate,
    endDate,
    dataPoints,
  } = params

  // Mock progress data - replace with actual database queries
  const progressData = Array.from({ length: dataPoints }, (_, i) => {
    const date = new Date(startDate)
    date.setDate(
      date.getDate() +
        (i * (endDate.getTime() - startDate.getTime())) /
          (dataPoints * 24 * 60 * 60 * 1000),
    )

    return {
      date: date.toISOString().split('T')[0],
      value: Math.max(
        0,
        Math.min(100, 50 + Math.sin(i * 0.3) * 20 + Math.random() * 10),
      ),
      sessions: Math.floor(Math.random() * 5) + 1,
    }
  })

  switch (type) {
    case 'line':
      return {
        data: {
          labels: progressData.map((d) => d.date),
          datasets: [
            {
              label: 'Therapy Progress',
              data: progressData.map((d) => d.value),
              borderColor: 'rgb(59, 130, 246)',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              fill: true,
              tension: 0.4,
            },
          ],
        },
        metadata: {
          totalDataPoints: progressData.length,
          timeRange: `${Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))} days`,
          lastUpdated: new Date().toISOString(),
          source: 'therapy_sessions',
        },
      }

    case 'bar':
      return {
        data: {
          labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
          datasets: [
            {
              label: 'Session Count',
              data: [3, 4, 2, 5],
              backgroundColor: [
                'rgba(34, 197, 94, 0.8)',
                'rgba(59, 130, 246, 0.8)',
                'rgba(251, 191, 36, 0.8)',
                'rgba(168, 85, 247, 0.8)',
              ],
            },
          ],
        },
        metadata: {
          totalDataPoints: 4,
          timeRange: '4 weeks',
          lastUpdated: new Date().toISOString(),
          source: 'session_counts',
        },
      }

    default:
      throw new Error(`Unsupported chart type for progress: ${type}`)
  }
}

async function generateEmotionChartData(params: {
  type: string
  repository: AIRepository
  clientId?: string | null
  sessionId?: string | null
  startDate: Date
  endDate: Date
  dataPoints: number
}): Promise<ChartDataResponse> {
  const { type } = params

  switch (type) {
    case 'pie':
      return {
        data: {
          labels: ['Positive', 'Neutral', 'Negative'],
          datasets: [
            {
              label: 'Emotion Distribution',
              data: [45, 30, 25],
              backgroundColor: [
                'rgba(34, 197, 94, 0.8)',
                'rgba(156, 163, 175, 0.8)',
                'rgba(239, 68, 68, 0.8)',
              ],
            },
          ],
        },
        metadata: {
          totalDataPoints: 3,
          timeRange: 'session_aggregate',
          lastUpdated: new Date().toISOString(),
          source: 'emotion_analysis',
        },
      }

    case 'scatter':
      const scatterData = Array.from({ length: 30 }, () => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
      }))

      return {
        data: {
          labels: [],
          datasets: [
            {
              label: 'Valence vs Arousal',
              data: scatterData,
              backgroundColor: 'rgba(59, 130, 246, 0.6)',
            },
          ],
        },
        metadata: {
          totalDataPoints: scatterData.length,
          timeRange: 'current_session',
          lastUpdated: new Date().toISOString(),
          source: 'emotion_dimensions',
        },
      }

    default:
      throw new Error(`Unsupported chart type for emotions: ${type}`)
  }
}

async function generateSessionChartData(params: {
  type: string
  repository: AIRepository
  clientId?: string | null
  startDate: Date
  endDate: Date
  dataPoints: number
}): Promise<ChartDataResponse> {
  const { _type } = params

  const sessionMetrics = [
    { metric: 'Engagement', value: 85 },
    { metric: 'Progress', value: 72 },
    { metric: 'Satisfaction', value: 91 },
    { metric: 'Completion', value: 88 },
  ]

  return {
    data: {
      labels: sessionMetrics.map((m) => m.metric),
      datasets: [
        {
          label: 'Session Metrics (%)',
          data: sessionMetrics.map((m) => m.value),
          backgroundColor: [
            'rgba(239, 68, 68, 0.8)',
            'rgba(34, 197, 94, 0.8)',
            'rgba(251, 191, 36, 0.8)',
            'rgba(168, 85, 247, 0.8)',
          ],
        },
      ],
    },
    metadata: {
      totalDataPoints: sessionMetrics.length,
      timeRange: 'recent_sessions',
      lastUpdated: new Date().toISOString(),
      source: 'session_analytics',
    },
  }
}

async function generateOutcomeChartData(params: {
  type: string
  repository: AIRepository
  clientId?: string | null
  startDate: Date
  endDate: Date
  dataPoints: number
}): Promise<ChartDataResponse> {
  const { _type, dataPoints } = params

  const outcomeData = Array.from(
    { length: Math.min(dataPoints, 12) },
    (_, i) => ({
      month: new Date(2024, i, 1).toLocaleDateString('en-US', {
        month: 'short',
      }),
      improvement: Math.max(10, Math.min(90, 30 + i * 5 + Math.random() * 10)),
    }),
  )

  return {
    data: {
      labels: outcomeData.map((d) => d.month),
      datasets: [
        {
          label: 'Treatment Outcomes (%)',
          data: outcomeData.map((d) => d.improvement),
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          fill: true,
          tension: 0.3,
        },
      ],
    },
    metadata: {
      totalDataPoints: outcomeData.length,
      timeRange: 'yearly_trends',
      lastUpdated: new Date().toISOString(),
      source: 'outcome_assessments',
    },
  }
}