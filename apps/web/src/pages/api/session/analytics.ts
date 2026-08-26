import type { APIRoute } from 'astro'

import { getSession } from '../../../lib/auth/session'
import { getPool } from '../../../lib/db'

type SessionMetricPayload = {
  metricName?: unknown
  metricValue?: unknown
  averageDuration?: unknown
  category?: unknown
  recordedAt?: unknown
  date?: unknown
  sessions?: unknown
  newUsers?: unknown
  returningUsers?: unknown
}

type SkillProgressPayload = {
  skill?: unknown
  score?: unknown
  category?: unknown
  trend?: unknown
  previousScore?: unknown
  sessionsPracticed?: unknown
  averageImprovement?: unknown
}

type SaveAnalyticsPayload = {
  sessionId: string
  analyticsData: {
    sessionMetrics: SessionMetricPayload[]
    skillProgress: SkillProgressPayload[]
  }
}

type SessionOwnershipRow = {
  therapist_id: string
}

type SessionAnalyticsRow = {
  metric_name: string
  metric_value: string | number | null
  metric_category: string | null
  recorded_at: string | Date
  metadata: string | Record<string, unknown> | null
}

type SessionMetricOutput = {
  metricName: string
  metricValue: number
  category: string
  recordedAt: string
  sessions?: number
  newUsers?: number
  returningUsers?: number
  [key: string]: unknown
}

type SkillProgressOutput = {
  skill: string
  score: number
  category: string
  trend?: string
  previousScore?: number
  sessionsPracticed?: number
  averageImprovement?: number
  [key: string]: unknown
}

const MAX_ANALYTICS_ITEMS = 1000 as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

const asNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

const asIsoDate = (value: unknown, fallback: string): string => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString()
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString()
  }
  return fallback
}

const isSessionMetricPayload = (
  value: unknown,
): value is SessionMetricPayload => isRecord(value)

const isSkillProgressPayload = (
  value: unknown,
): value is SkillProgressPayload => isRecord(value)

const isSaveAnalyticsPayload = (
  value: unknown,
): value is SaveAnalyticsPayload => {
  if (!isRecord(value)) return false
  if (typeof value['sessionId'] !== 'string') return false
  if (!isRecord(value['analyticsData'])) return false
  const analyticsData = value['analyticsData']
  return (
    Array.isArray(analyticsData['sessionMetrics']) &&
    Array.isArray(analyticsData['skillProgress']) &&
    analyticsData['sessionMetrics'].every(isSessionMetricPayload) &&
    analyticsData['skillProgress'].every(isSkillProgressPayload) &&
    analyticsData['sessionMetrics'].length <= MAX_ANALYTICS_ITEMS &&
    analyticsData['skillProgress'].length <= MAX_ANALYTICS_ITEMS
  )
}

const parseMetadata = (
  metadata: SessionAnalyticsRow['metadata'],
): Record<string, unknown> => {
  if (metadata == null) return {}
  if (typeof metadata === 'string') {
    if (metadata.length === 0) return {}
    const parsed: unknown = JSON.parse(metadata)
    return isRecord(parsed) ? parsed : {}
  }
  return isRecord(metadata) ? metadata : {}
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // Verify authentication
    const session = await getSession(request)
    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const requestBody: unknown = await request.json()
    if (!isSaveAnalyticsPayload(requestBody)) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { sessionId, analyticsData } = requestBody

    const client = await getPool().connect()
    try {
      const sessionQuery = `
        SELECT therapist_id FROM sessions WHERE id = $1
      `
      const sessionResult = await client.query<SessionOwnershipRow>(
        sessionQuery,
        [sessionId],
      )

      if (sessionResult.rows.length === 0) {
        return new Response(JSON.stringify({ error: 'Session not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const sessionOwnerId = sessionResult?.rows[0].therapist_id
      const userId = session.user.id
      const userRole = session.user.role

      // Check if user owns the session or has therapist/admin role
      const isOwner = sessionOwnerId === userId
      const hasPermission = userRole === 'therapist' || userRole === 'admin'

      if (!isOwner && !hasPermission) {
        return new Response(JSON.stringify({ error: 'Access denied' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Insert session analytics data into session_analytics table
      const query = `
        INSERT INTO session_analytics (
          session_id, metric_name, metric_value, metric_category, recorded_at, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `

      const insertPromises: Promise<any>[] = []

      // Insert session metrics
      for (const metric of analyticsData.sessionMetrics) {
        const metricName = asString(metric.metricName) ?? 'session_duration'
        const metricValue =
          asNumber(metric.metricValue) ?? asNumber(metric.averageDuration) ?? 0
        insertPromises.push(
          client.query(query, [
            sessionId,
            metricName,
            metricValue,
            asString(metric.category) ?? 'session',
            asIsoDate(
              metric.recordedAt ?? metric.date,
              new Date().toISOString(),
            ),
            JSON.stringify({
              sessions: asNumber(metric.sessions),
              newUsers: asNumber(metric.newUsers),
              returningUsers: asNumber(metric.returningUsers),
            }),
          ]),
        )
      }

      // Insert skill progress data
      for (const skill of analyticsData.skillProgress) {
        insertPromises.push(
          client.query(query, [
            sessionId,
            `skill_${asString(skill.skill) ?? 'unknown'}`,
            asNumber(skill.score) ?? 0,
            asString(skill.category) ?? 'skill',
            new Date().toISOString(),
            JSON.stringify({
              trend: asString(skill.trend),
              previousScore: asNumber(skill.previousScore),
              sessionsPracticed: asNumber(skill.sessionsPracticed),
              averageImprovement: asNumber(skill.averageImprovement),
            }),
          ]),
        )
      }

      await Promise.all(insertPromises)

      return new Response(JSON.stringify({ success: true, sessionId }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } finally {
      client.release()
    }
  } catch (error: unknown) {
    console.error('Error saving session analytics:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const GET: APIRoute = async ({ request }) => {
  try {
    // Verify authentication
    const session = await getSession(request)
    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const url = new URL(request.url)
    const sessionId = url.searchParams.get('sessionId')
    const timeRange = url.searchParams.get('timeRange') ?? '30d'

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Missing sessionId parameter' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const client = await getPool().connect()
    try {
      const sessionQuery = `
        SELECT therapist_id FROM sessions WHERE id = $1
      `
      const sessionResult = await client.query<SessionOwnershipRow>(
        sessionQuery,
        [sessionId],
      )

      if (sessionResult.rows.length === 0) {
        return new Response(JSON.stringify({ error: 'Session not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const sessionOwnerId = sessionResult?.rows[0].therapist_id
      const userId = session.user.id
      const userRole = session.user.role

      // Check if user owns the session or has therapist/admin role
      const isOwner = sessionOwnerId === userId
      const hasPermission = userRole === 'therapist' || userRole === 'admin'

      if (!isOwner && !hasPermission) {
        return new Response(JSON.stringify({ error: 'Access denied' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Get session analytics data
      const query = `
        SELECT
          metric_name,
          metric_value,
          metric_category,
          recorded_at,
          metadata
        FROM session_analytics
        WHERE session_id = $1
          AND recorded_at >= NOW() - $2::interval
        ORDER BY recorded_at ASC
      `

      const interval =
        timeRange === '7d'
          ? '7 days'
          : timeRange === '30d'
            ? '30 days'
            : timeRange === '90d'
              ? '90 days'
              : timeRange === '1y'
                ? '1 year'
                : '30 days'
      const result = await client.query<SessionAnalyticsRow>(query, [
        sessionId,
        interval,
      ])
      // Transform data for client consumption
      const sessionMetrics: SessionMetricOutput[] = []
      const skillProgress: SkillProgressOutput[] = []

      result.rows.forEach((row) => {
        const meta = parseMetadata(row.metadata)
        const metricCategory = row.metric_category ?? 'session'
        if (metricCategory === 'skill') {
          const skillName = row.metric_name.replace('skill_', '')
          skillProgress.push({
            skill: skillName,
            score: asNumber(row.metric_value) ?? 0,
            category: metricCategory,
            ...meta,
            timestamp: asIsoDate(row.recorded_at, new Date().toISOString()),
          })
        } else {
          const metricName = row.metric_name
          sessionMetrics.push({
            metricName,
            metricValue: asNumber(row.metric_value) ?? 0,
            category: metricCategory,
            recordedAt: asIsoDate(row.recorded_at, new Date().toISOString()),
            ...meta,
          })
        }
      })

      return new Response(
        JSON.stringify({
          sessionId,
          analyticsData: {
            sessionMetrics,
            skillProgress,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    } finally {
      client.release()
    }
  } catch (error: unknown) {
    console.error('Error fetching session analytics:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
