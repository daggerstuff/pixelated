import type { APIRoute } from 'astro'

import { resolveInternalUserId } from '../../../lib/auth/internal-identity'
import { getSession } from '../../../lib/auth/session'
import { getPool } from '../../../lib/db'
import { getSkillCategory } from '../../../lib/skillCategories'
import {
  isMissingLegacySchema,
  isQueryTimeout,
  legacySessionRetryableResponse,
  legacySessionSurfaceResponse,
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
    const therapistId = await resolveInternalUserId(session.user, {
      propagateDatabaseErrors: true,
    })
    if (!therapistId) {
      return new Response(
        JSON.stringify({ error: 'User identity not resolved' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const body: unknown = await request.json()
    if (!isRecord(body)) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const { sessionId, skillScores } = body

    if (
      typeof sessionId !== 'string' ||
      !sessionId ||
      typeof skillScores !== 'object' ||
      skillScores === null ||
      Array.isArray(skillScores)
    ) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: sessionId, skillScores',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const client = await getPool().connect()
    try {
      // Update session with skill scores
      const sessionQuery = `
        UPDATE sessions
        SET skill_scores = $1, updated_at = NOW()
        WHERE id = $2 AND therapist_id = $3
        RETURNING id
      `

      const sessionResult = await client.query(sessionQuery, [
        JSON.stringify(skillScores),
        sessionId,
        therapistId,
      ])

      if (sessionResult.rowCount === 0) {
        return new Response(JSON.stringify({ error: 'Session not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Update or insert into skill_development table for long-term tracking
      // Build batched INSERT query to avoid N+1 queries
      const skillInserts: Array<{
        therapistId: string
        skillName: string
        category: string
        score: number
      }> = []

      // skillScores may be either { name: number } or { name: { score: number, category?: string }}
      for (const [skillName, scoreOrObj] of Object.entries(skillScores)) {
        let score: number
        let explicitCategory: string | undefined

        if (
          typeof scoreOrObj === 'object' &&
          scoreOrObj !== null &&
          'score' in (scoreOrObj as Record<string, unknown>)
        ) {
          const obj = scoreOrObj as Record<string, unknown>
          score = (obj['score'] as number) ?? (obj['score'] as string) ?? 0
          explicitCategory =
            typeof obj['category'] === 'string' ? obj['category'] : undefined
        } else {
          score = (scoreOrObj as number) || 0
        }

        // Determine category using helper mapping (allows expansion without changing this file)
        const category = getSkillCategory(skillName, explicitCategory)

        skillInserts.push({
          therapistId,
          skillName,
          category,
          score: score,
        })
      }

      if (skillInserts.length > 0) {
        // Build VALUES clause for batched insert
        // We insert: therapist_id, skill_name, skill_category, current_score, practice_sessions, last_practiced
        // For each row we need 5 parameters (last_practiced is NOW()). Build VALUES clause accordingly.
        const valuesClause = skillInserts
          .map(
            (_, index) =>
              `($${index * 5 + 1}, $${index * 5 + 2}, $${index * 5 + 3}, $${index * 5 + 4}, $${index * 5 + 5}, NOW())`,
          )
          .join(', ')

        // Build parameter array
        const params: Array<string | number> = []
        skillInserts.forEach((insert) => {
          params.push(
            insert.therapistId,
            insert.skillName,
            insert.category,
            insert.score,
            1,
          )
        })

        const batchedSkillQuery = `
          INSERT INTO skill_development (
            therapist_id, skill_name, skill_category, current_score, practice_sessions, last_practiced
          ) VALUES ${valuesClause}
          ON CONFLICT (therapist_id, skill_name)
          DO UPDATE SET
            current_score = EXCLUDED.current_score,
            practice_sessions = skill_development.practice_sessions + 1,
            last_practiced = NOW(),
            updated_at = NOW()
        `

        await client.query(batchedSkillQuery, params)
      }

      return new Response(
        JSON.stringify({ success: true, sessionId, therapistId }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    } finally {
      client.release()
    }
  } catch (error: unknown) {
    if (isMissingLegacySchema(error)) return legacySessionSurfaceResponse()
    if (isQueryTimeout(error))
      return legacySessionRetryableResponse({
        advertiseRetry: false,
      })
    console.error('Error saving skill scores:', error)
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
    const therapistId = await resolveInternalUserId(session.user, {
      propagateDatabaseErrors: true,
    })
    if (!therapistId) {
      return new Response(
        JSON.stringify({ error: 'User identity not resolved' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const url = new URL(request.url)
    const sessionId = url.searchParams.get('sessionId')
    const requestedTherapistId = url.searchParams.get('therapistId')

    const client = await getPool().connect()
    try {
      if (sessionId) {
        // Get skill scores from specific session
        const query = `
          SELECT skill_scores
          FROM sessions
          WHERE id = $1 AND therapist_id = $2
        `

        const result = await client.query(query, [sessionId, therapistId])

        if (result.rowCount === 0) {
          return new Response(JSON.stringify({ error: 'Session not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        return new Response(
          JSON.stringify({
            sessionId,
            skillScores: (result as { rows: Array<{ skill_scores?: unknown }> })
              .rows[0].skill_scores,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      } else if (requestedTherapistId) {
        // Get therapist's skill development history
        const query = `
          SELECT skill_name, skill_category, current_score, practice_sessions, last_practiced, created_at
          FROM skill_development
          WHERE therapist_id = $1
          ORDER BY last_practiced DESC
        `

        const result = await client.query(query, [therapistId])

        return new Response(
          JSON.stringify({
            therapistId,
            skills: result.rows,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      } else {
        return new Response(
          JSON.stringify({
            error: 'Missing sessionId or therapistId parameter',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        )
      }
    } finally {
      client.release()
    }
  } catch (error: unknown) {
    if (isMissingLegacySchema(error)) return legacySessionSurfaceResponse()
    if (isQueryTimeout(error)) return legacySessionRetryableResponse()
    console.error('Error fetching skill scores:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
