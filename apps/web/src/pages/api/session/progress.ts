import type { APIRoute } from 'astro'

import { resolveInternalUserId } from '../../../lib/auth/internal-identity'
import { getSession } from '../../../lib/auth/session'
import { getPool } from '../../../lib/db'
import {
  isMissingLegacySchema,
  legacySessionSurfaceResponse,
} from './_legacy-surface'

const jsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const POST: APIRoute = async ({ request }) => {
  const session = await getSession(request)
  if (!session) return jsonResponse({ error: 'Authentication required' }, 401)

  const therapistId = await resolveInternalUserId(session.user)
  if (!therapistId) {
    return jsonResponse({ error: 'User identity not resolved' }, 403)
  }

  try {
    const payload: unknown = await request.json()
    if (!isRecord(payload) || typeof payload['sessionId'] !== 'string') {
      return jsonResponse({ error: 'Missing required field: sessionId' }, 400)
    }

    const sessionId = payload['sessionId']
    const progressMetrics = payload['progressMetrics']
    const evaluationFeedback = payload['evaluationFeedback']
    if (
      progressMetrics === undefined &&
      (typeof evaluationFeedback !== 'string' ||
        evaluationFeedback.length === 0)
    ) {
      return jsonResponse({ error: 'No progress or feedback supplied' }, 400)
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

      if (progressMetrics !== undefined) {
        await client.query(
          `UPDATE sessions
           SET progress_metrics = $1::jsonb, updated_at = NOW()
           WHERE id = $2 AND therapist_id = $3`,
          [JSON.stringify(progressMetrics), sessionId, therapistId],
        )
      }

      if (
        typeof evaluationFeedback === 'string' &&
        evaluationFeedback.length > 0
      ) {
        await client.query(
          `INSERT INTO evaluations (session_id, therapist_id, feedback, created_at)
           VALUES ($1, $2, $3, NOW())`,
          [sessionId, therapistId, evaluationFeedback],
        )
      }

      await client.query('COMMIT')
      return jsonResponse({ success: true, sessionId }, 200)
    } catch (error: unknown) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error: unknown) {
    if (isMissingLegacySchema(error)) return legacySessionSurfaceResponse()
    console.error('Error saving session progress:', error)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
}

export const GET: APIRoute = async ({ request }) => {
  const session = await getSession(request)
  if (!session) return jsonResponse({ error: 'Authentication required' }, 401)

  const therapistId = await resolveInternalUserId(session.user)
  if (!therapistId) {
    return jsonResponse({ error: 'User identity not resolved' }, 403)
  }

  const url = new URL(request.url)
  const sessionId = url.searchParams.get('sessionId')
  if (!sessionId) {
    return jsonResponse({ error: 'Missing sessionId parameter' }, 400)
  }

  try {
    const client = await getPool().connect()
    try {
      const result = await client.query(
        `SELECT progress_metrics, progress_snapshots, skill_scores
         FROM sessions
         WHERE id = $1 AND therapist_id = $2`,
        [sessionId, therapistId],
      )

      if (result.rowCount === 0) {
        return jsonResponse({ error: 'Session not found' }, 404)
      }

      const sessionData = result.rows[0] as Record<string, unknown>
      let feedback: unknown[] | null = null
      if (url.searchParams.get('includeFeedback') === 'true') {
        const feedbackResult = await client.query(
          `SELECT therapist_id, feedback, created_at
           FROM evaluations
           WHERE session_id = $1 AND therapist_id = $2
           ORDER BY created_at DESC`,
          [sessionId, therapistId],
        )
        feedback = feedbackResult.rows
      }

      return jsonResponse(
        {
          sessionId,
          progressMetrics: sessionData['progress_metrics'],
          progressSnapshots: sessionData['progress_snapshots'],
          skillScores: sessionData['skill_scores'],
          feedback,
        },
        200,
      )
    } finally {
      client.release()
    }
  } catch (error: unknown) {
    if (isMissingLegacySchema(error)) return legacySessionSurfaceResponse()
    console.error('Error fetching session progress:', error)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
}
