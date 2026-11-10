import type { APIRoute } from 'astro'

import { resolveInternalUserId } from '../../../lib/auth/internal-identity'
import { getSession } from '../../../lib/auth/session'
import { getPool } from '../../../lib/db'
import {
  isMissingLegacySchema,
  isQueryTimeout,
  legacySessionRetryableResponse,
  legacySessionSurfaceResponse,
  rollbackQuietly,
} from './_legacy-surface'

type ProgressSnapshot = {
  value: number
  timestamp: string | number
}

const jsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const isValidSnapshot = (value: unknown): value is ProgressSnapshot => {
  if (typeof value !== 'object' || value === null) return false
  const snapshot = value as Record<string, unknown>
  if (
    typeof snapshot['value'] !== 'number' ||
    !Number.isFinite(snapshot['value'])
  ) {
    return false
  }
  if (
    typeof snapshot['timestamp'] !== 'string' &&
    typeof snapshot['timestamp'] !== 'number'
  ) {
    return false
  }
  return Number.isFinite(new Date(snapshot['timestamp']).getTime())
}

export const POST: APIRoute = async ({ request }) => {
  const session = await getSession(request)
  if (!session) return jsonResponse({ error: 'Authentication required' }, 401)

  // `session.user.id` is the provider subject (`auth0|…`); `therapist_id` is a
  // uuid column, so the principal must be resolved to the internal users.id
  // before any ownership comparison.
  const therapistId = await resolveInternalUserId(session.user)
  if (!therapistId) {
    return jsonResponse({ error: 'User identity not resolved' }, 403)
  }

  try {
    const payload: unknown = await request.json()
    if (
      typeof payload !== 'object' ||
      payload === null ||
      Array.isArray(payload)
    ) {
      return jsonResponse({ error: 'Invalid payload' }, 400)
    }
    const body = payload as Record<string, unknown>
    const sessionId = body['sessionId']
    const snapshots = body['snapshots']
    if (
      typeof sessionId !== 'string' ||
      !Array.isArray(snapshots) ||
      snapshots.length > 500 ||
      !snapshots.every(isValidSnapshot)
    ) {
      return jsonResponse(
        {
          error:
            'Invalid payload: require sessionId and up to 500 snapshots of {timestamp,value:number}',
        },
        400,
      )
    }

    const client = await getPool().connect()
    try {
      await client.query('BEGIN')
      const ownership = await client.query(
        'SELECT id FROM sessions WHERE id = $1 AND therapist_id = $2 FOR UPDATE',
        [sessionId, therapistId],
      )
      if (ownership.rowCount === 0) {
        await client.query('ROLLBACK')
        return jsonResponse({ error: 'Session not found' }, 404)
      }

      await client.query(
        `UPDATE sessions
         SET progress_snapshots = $1::jsonb, updated_at = NOW()
         WHERE id = $2 AND therapist_id = $3`,
        [JSON.stringify(snapshots), sessionId, therapistId],
      )

      if (snapshots.length > 0) {
        const values: Array<string | number> = []
        const placeholders = snapshots.map((snapshot, index) => {
          const base = index * 4
          values.push(
            sessionId,
            `Progress_${snapshot.value}`,
            snapshot.value,
            new Date(snapshot.timestamp).toISOString(),
          )
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`
        })
        await client.query(
          `INSERT INTO session_milestones (session_id, milestone_name, milestone_value, achieved_at)
           VALUES ${placeholders.join(',')}`,
          values,
        )
      }

      await client.query('COMMIT')
      return jsonResponse({ success: true, sessionId }, 200)
    } catch (error: unknown) {
      await rollbackQuietly(client)
      throw error
    } finally {
      client.release()
    }
  } catch (error: unknown) {
    if (isMissingLegacySchema(error)) return legacySessionSurfaceResponse()
    if (isQueryTimeout(error)) return legacySessionRetryableResponse()
    console.error('Error handling POST /api/session/snapshots', error)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
}

export const GET: APIRoute = async ({ request }) => {
  const session = await getSession(request)
  if (!session) return jsonResponse({ error: 'Authentication required' }, 401)

  // Same identity bridge as POST: resolve before the ownership predicate.
  const therapistId = await resolveInternalUserId(session.user)
  if (!therapistId) {
    return jsonResponse({ error: 'User identity not resolved' }, 403)
  }

  const sessionId = new URL(request.url).searchParams.get('sessionId')
  if (!sessionId) {
    return jsonResponse({ error: 'Missing sessionId parameter' }, 400)
  }

  try {
    const client = await getPool().connect()
    try {
      const sessionResult = await client.query(
        'SELECT progress_snapshots FROM sessions WHERE id = $1 AND therapist_id = $2',
        [sessionId, therapistId],
      )
      if (sessionResult.rowCount === 0) {
        return jsonResponse({ error: 'Session not found' }, 404)
      }

      const milestoneResult = await client.query(
        `SELECT milestone_name, milestone_value, achieved_at
         FROM session_milestones
         WHERE session_id = $1
         ORDER BY achieved_at ASC`,
        [sessionId],
      )

      const sessionData = sessionResult.rows[0] as {
        progress_snapshots?: unknown[]
      }
      return jsonResponse(
        {
          sessionId,
          snapshots: sessionData.progress_snapshots,
          milestones: milestoneResult.rows,
        },
        200,
      )
    } finally {
      client.release()
    }
  } catch (error: unknown) {
    if (isMissingLegacySchema(error)) return legacySessionSurfaceResponse()
    if (isQueryTimeout(error)) return legacySessionRetryableResponse()
    console.error('Error handling GET /api/session/snapshots', error)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
}
