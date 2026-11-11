import type { APIRoute } from 'astro'

import { acquireClient, isDatabaseUnavailableError } from '@/lib/db'

import { getSession } from '../../../lib/auth/session'
import {
  isLegacySessionId,
  isMissingLegacySchema,
  isQueryTimeout,
  legacySessionExcludedInvalidIdResponse,
  legacySessionInvalidRequestResponse,
  legacySessionRetryableResponse,
  legacySessionSurfaceResponse,
  resolveLegacyTherapistId,
} from './_legacy-surface'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const POST: APIRoute = async ({ request }) => {
  try {
    const session = await getSession(request)
    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }
    const therapistId = await resolveLegacyTherapistId(session.user, {
      advertiseRetry: false,
    })
    if (therapistId instanceof Response) return therapistId
    if (!therapistId) {
      return new Response(
        JSON.stringify({ error: 'User identity not resolved' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      // A body that cannot be parsed is a malformed request, not a server
      // fault: `request.json()` throws a `SyntaxError` for invalid JSON.
      return legacySessionInvalidRequestResponse('Invalid JSON body')
    }
    if (!isRecord(body)) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const { currentSessionId, previousSessionId, improvementScore, metrics } =
      body

    // A present-but-malformed identifier can never name a session, so it is
    // classified before the rest of the payload is judged. Both values reach a
    // uuid column: an unvalidated one raises `22P02` inside the ownership
    // SELECT below, before parse analysis resolves the absent legacy relation,
    // and used to surface as a `500`. The route is excluded from the pilot
    // surface regardless of body shape, so this is answered with the existing
    // `410`. An empty string is left to the required-field check below, except
    // for `previousSessionId`, which means "none" when absent but reaches the
    // uuid column when empty — the second guard below covers that.
    for (const id of [currentSessionId, previousSessionId]) {
      if (typeof id === 'string' && id !== '' && !isLegacySessionId(id)) {
        return legacySessionExcludedInvalidIdResponse()
      }
    }

    if (
      typeof currentSessionId !== 'string' ||
      !currentSessionId ||
      (previousSessionId != null && typeof previousSessionId !== 'string') ||
      improvementScore === undefined ||
      improvementScore === null ||
      !metrics
    ) {
      return new Response(
        JSON.stringify({
          error:
            'Missing required fields: currentSessionId, improvementScore, metrics',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    if (previousSessionId != null && !isLegacySessionId(previousSessionId)) {
      return legacySessionExcludedInvalidIdResponse()
    }

    const client = await acquireClient()
    try {
      for (const sessionId of [currentSessionId, previousSessionId].filter(
        (id) => id != null,
      )) {
        const ownedSession = await client.query(
          'SELECT id FROM sessions WHERE id = $1 AND therapist_id = $2',
          [sessionId, therapistId],
        )
        if (ownedSession.rows.length === 0) {
          return new Response(JSON.stringify({ error: 'Session not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      }

      // Insert session comparison data into session_comparisons table
      const query = `
        INSERT INTO session_comparisons (
          therapist_id, current_session_id, previous_session_id, improvement_score, comparison_metrics
        ) VALUES ($1, $2, $3, $4, $5::jsonb)
        RETURNING id
      `

      const result = await client.query(query, [
        therapistId,
        currentSessionId,
        previousSessionId ?? null,
        improvementScore,
        JSON.stringify(metrics),
      ])

      return new Response(
        JSON.stringify({
          success: true,
          comparisonId: (result.rows[0] as { id: string }).id,
          therapistId,
          currentSessionId,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    } finally {
      client.release()
    }
  } catch (error: unknown) {
    if (isMissingLegacySchema(error)) return legacySessionSurfaceResponse()
    if (isQueryTimeout(error) || isDatabaseUnavailableError(error))
      return legacySessionRetryableResponse({
        advertiseRetry: false,
      })
    console.error('Error saving session comparison:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const session = await getSession(request)
    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }
    const therapistId = await resolveLegacyTherapistId(session.user)
    if (therapistId instanceof Response) return therapistId
    if (!therapistId) {
      return new Response(
        JSON.stringify({ error: 'User identity not resolved' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const url = new URL(request.url)
    const requestedTherapistId = url.searchParams.get('therapistId')
    const sessionId = url.searchParams.get('sessionId')
    const timeRange = url.searchParams.get('timeRange') ?? '30d'

    if (!requestedTherapistId && !sessionId) {
      return new Response(
        JSON.stringify({ error: 'Missing therapistId or sessionId parameter' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // An empty `sessionId` means "no session filter" and must keep falling
    // through to the therapist branch; only a present, malformed id is
    // rejected.
    if (sessionId && !isLegacySessionId(sessionId)) {
      return legacySessionExcludedInvalidIdResponse()
    }

    const client = await acquireClient()
    try {
      let query = ''
      let queryParams: string[] = []

      if (sessionId) {
        // Get specific session comparison
        query = `
          SELECT
            sc.id,
            sc.therapist_id,
            sc.current_session_id,
            sc.previous_session_id,
            sc.improvement_score,
            sc.comparison_metrics,
            sc.analyzed_at,
            cs.started_at as current_session_started_at,
            ps.started_at as previous_session_started_at
          FROM session_comparisons sc
          LEFT JOIN sessions cs ON sc.current_session_id = cs.id
          LEFT JOIN sessions ps ON sc.previous_session_id = ps.id
          WHERE sc.current_session_id = $1
            AND sc.therapist_id = $2
            AND cs.therapist_id = $2
            AND (sc.previous_session_id IS NULL OR ps.therapist_id = $2)
          ORDER BY sc.analyzed_at DESC
          LIMIT 1
        `
        queryParams = [sessionId, therapistId]
      } else if (therapistId) {
        // Get therapist's session comparisons
        // Allowlist simple forms like '7 days', '30 days', '24 hours', '30d'
        const allowed =
          /^(?:\d+\s+(?:minutes?|hours?|days?|weeks?|months?|years?)|\d+d)$/i
        const safeRange = allowed.test(timeRange)
          ? timeRange.replace(/(\d+)d/i, '$1 days')
          : '30 days'
        query = `
          SELECT
            sc.id,
            sc.therapist_id,
            sc.current_session_id,
            sc.previous_session_id,
            sc.improvement_score,
            sc.comparison_metrics,
            sc.analyzed_at,
            cs.started_at as current_session_started_at,
            ps.started_at as previous_session_started_at
          FROM session_comparisons sc
          LEFT JOIN sessions cs ON sc.current_session_id = cs.id
          LEFT JOIN sessions ps ON sc.previous_session_id = ps.id
          WHERE sc.therapist_id = $1
            AND cs.therapist_id = $1
            AND (sc.previous_session_id IS NULL OR ps.therapist_id = $1)
            AND sc.analyzed_at >= NOW() - $2::interval
          ORDER BY sc.analyzed_at DESC
        `
        queryParams = [therapistId, safeRange]
      }

      const result = await client.query(query, queryParams)

      // Transform data for client consumption
      const toObj = (v: unknown): Record<string, unknown> =>
        typeof v === 'string'
          ? (JSON.parse(v || '{}') as Record<string, unknown>)
          : ((v as Record<string, unknown>) ?? {})
      interface ComparisonRow {
        id: string
        therapist_id: string
        current_session_id: string
        previous_session_id: string | null
        improvement_score: number
        comparison_metrics: string
        analyzed_at: string
        current_session_started_at: string | null
        previous_session_started_at: string | null
      }
      const comparisons = (result.rows as ComparisonRow[]).map((row) => ({
        id: row.id,
        therapistId: row.therapist_id,
        currentSessionId: row.current_session_id,
        previousSessionId: row.previous_session_id,
        improvementScore: row.improvement_score,
        metrics: toObj(row.comparison_metrics),
        analyzedAt: row.analyzed_at,
        currentSessionStartedAt: row.current_session_started_at,
        previousSessionStartedAt: row.previous_session_started_at,
        trend:
          row.improvement_score > 0
            ? 'improving'
            : row.improvement_score < 0
              ? 'declining'
              : 'stable',
      }))

      return new Response(
        JSON.stringify({
          therapistId,
          sessionId: sessionId,
          comparisons,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    } finally {
      client.release()
    }
  } catch (error: unknown) {
    if (isMissingLegacySchema(error)) return legacySessionSurfaceResponse()
    if (isQueryTimeout(error) || isDatabaseUnavailableError(error))
      return legacySessionRetryableResponse()
    console.error('Error fetching session comparisons:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
