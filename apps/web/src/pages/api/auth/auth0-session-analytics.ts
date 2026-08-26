/**
 * Auth0-based Session Analytics API Endpoint
 * Handles session analytics with Auth0 integration
 */

import type { APIRoute } from 'astro'
import { Pool } from 'pg'

import { createAuditLog, AuditEventType } from '@/lib/audit'
import { validateToken } from '@/lib/auth/auth0-jwt-service'
import { extractTokenFromRequest } from '@/lib/auth/auth0-middleware'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { getUserById } from '@/lib/services/auth0.service'

// Database connection pool
const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
})

export const prerender = false

const logger = createBuildSafeLogger('auth0-session-analytics-api')

type SessionAnalyticsMetadata = Record<string, unknown> | null

type SessionAnalyticsRow = {
  metric_name: string
  metric_value: number
  metric_category: string
  recorded_at: string
  metadata: SessionAnalyticsMetadata | string
}

type SessionMetricInput = {
  metricName?: string
  metricValue?: number
  averageDuration?: number
  category?: string
  recordedAt?: string
  date?: string
  sessions?: number
  newUsers?: number
  returningUsers?: number
}

type SkillProgressInput = {
  skill: string
  score: number
  category?: string
  trend?: string
  previousScore?: number
  sessionsPracticed?: number
  averageImprovement?: number
}

type SessionAnalyticsPayload = {
  sessionId: string
  analyticsData: {
    sessionMetrics: Array<SessionMetricInput>
    skillProgress: Array<SkillProgressInput>
  }
}

type SessionOwnershipRow = {
  therapist_id: string
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isSessionAnalyticsPayload = (
  value: unknown,
): value is SessionAnalyticsPayload => {
  if (!isObject(value) || typeof value['sessionId'] !== 'string') {
    return false
  }

  const analyticsData = value['analyticsData']
  if (!isObject(analyticsData)) {
    return false
  }

  const sessionMetrics = analyticsData['sessionMetrics']
  const skillProgress = analyticsData['skillProgress']
  if (!Array.isArray(sessionMetrics) || !Array.isArray(skillProgress)) {
    return false
  }

  if (sessionMetrics.length > 1000 || skillProgress.length > 1000) {
    return false
  }

  return true
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  isObject(value)

const parseJsonSafely = (value: string): unknown => {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const parseMetadata = (
  metadata: SessionAnalyticsRow['metadata'],
): SessionAnalyticsMetadata => {
  if (typeof metadata === 'string') {
    const parsed = parseJsonSafely(metadata)
    if (isRecord(parsed)) {
      return parsed
    }
    return {}
  }

  if (isRecord(metadata)) {
    return metadata
  }

  return {}
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // Extract token from request
    const token = extractTokenFromRequest(request)

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
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
        },
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

    const bodyText = await request.text().catch(() => '')
    const body = parseJsonSafely(bodyText)
    if (!isSessionAnalyticsPayload(body)) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { sessionId, analyticsData } = body

    const client = await pool.connect()

    // Verify session ownership and permissions
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

    const sessionOwnerId = sessionResult.rows[0]?.therapist_id
    if (!sessionOwnerId) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const userId = user.id
    const userRole = user.role

    // Check if user owns the session or has therapist/admin role
    const isOwner = sessionOwnerId === userId
    const hasPermission = userRole === 'therapist' || userRole === 'admin'

    if (!isOwner && !hasPermission) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    try {
      // Insert session analytics data into session_analytics table
      const query = `
        INSERT INTO session_analytics (
          session_id, metric_name, metric_value, metric_category, recorded_at, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `

      // Insert session metrics
      for (const metric of analyticsData.sessionMetrics) {
        await client.query(query, [
          sessionId,
          metric.metricName ?? 'session_duration',
          metric.metricValue ?? metric.averageDuration ?? 0,
          metric.category ?? 'session',
          new Date(
            metric.recordedAt ?? metric.date ?? new Date(),
          ).toISOString(),
          JSON.stringify({
            sessions: metric.sessions,
            newUsers: metric.newUsers,
            returningUsers: metric.returningUsers,
          }),
        ])
      }

      // Insert skill progress data
      for (const skill of analyticsData.skillProgress) {
        await client.query(query, [
          sessionId,
          `skill_${skill.skill}`,
          skill.score,
          skill.category ?? 'skill',
          new Date().toISOString(),
          JSON.stringify({
            trend: skill.trend,
            previousScore: skill.previousScore,
            sessionsPracticed: skill.sessionsPracticed,
            averageImprovement: skill.averageImprovement,
          }),
        ])
      }

      // Create audit log
      await createAuditLog(
        AuditEventType.SESSION_ANALYTICS_SAVED,
        'auth.components.session.analytics.save',
        userId,
        'session-analytics',
        {
          sessionId,
          sessionMetricsCount: analyticsData.sessionMetrics.length,
          skillProgressCount: analyticsData.skillProgress.length,
        },
      )

      logger.info('Saved session analytics', {
        sessionId,
        userId,
        sessionMetricsCount: analyticsData.sessionMetrics.length,
        skillProgressCount: analyticsData.skillProgress.length,
      })

      return new Response(JSON.stringify({ success: true, sessionId }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } finally {
      client.release()
    }
  } catch (error: unknown) {
    logger.error('Error saving session analytics:', error)

    // Create audit log for the error
    await createAuditLog(
      AuditEventType.SYSTEM_ERROR,
      'auth.components.session.analytics.error',
      'anonymous',
      'session-analytics',
      {
        error:
          error instanceof Error
            ? error instanceof Error
              ? error.message
              : 'Unknown error'
            : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    )

    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const GET: APIRoute = async ({ request }) => {
  try {
    // Extract token from request
    const token = extractTokenFromRequest(request)

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
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
        },
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

    const url = new URL(request.url)
    const sessionId = url.searchParams.get('sessionId')
    const timeRange = url.searchParams.get('timeRange') ?? '30d'

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Missing sessionId parameter' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const client = await pool.connect()

    // Verify session ownership and permissions
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

    const sessionOwnerId = sessionResult.rows[0]?.therapist_id
    if (!sessionOwnerId) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const userId = user.id
    const userRole = user.role

    // Check if user owns the session or has therapist/admin role
    const isOwner = sessionOwnerId === userId
    const hasPermission = userRole === 'therapist' || userRole === 'admin'

    if (!isOwner && !hasPermission) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    try {
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
      const sessionMetrics: Array<Record<string, unknown>> = []
      const skillProgress: Array<Record<string, unknown>> = []

      result.rows.forEach((row) => {
        const meta = parseMetadata(row.metadata)
        if (row.metric_category === 'skill') {
          skillProgress.push({
            skill: row.metric_name.replace('skill_', ''),
            score: row.metric_value,
            category: row.metric_category,
            ...meta,
            timestamp: row.recorded_at,
          })
        } else {
          sessionMetrics.push({
            metricName: row.metric_name,
            metricValue: row.metric_value,
            category: row.metric_category,
            recordedAt: row.recorded_at,
            ...meta,
          })
        }
      })

      // Create audit log
      await createAuditLog(
        AuditEventType.SESSION_ANALYTICS_FETCHED,
        'auth.components.session.analytics.fetch',
        userId,
        'session-analytics',
        {
          sessionId,
          timeRange,
          sessionMetricsCount: sessionMetrics.length,
          skillProgressCount: skillProgress.length,
        },
      )

      logger.info('Fetched session analytics', {
        sessionId,
        userId,
        timeRange,
        sessionMetricsCount: sessionMetrics.length,
        skillProgressCount: skillProgress.length,
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
    logger.error('Error fetching session analytics:', error)

    // Create audit log for the error
    await createAuditLog(
      AuditEventType.SYSTEM_ERROR,
      'auth.components.session.analytics.error',
      'anonymous',
      'session-analytics',
      {
        error:
          error instanceof Error
            ? error instanceof Error
              ? error.message
              : 'Unknown error'
            : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    )

    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
