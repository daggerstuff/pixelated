import type { APIRoute } from 'astro'

import { getPool } from '../../lib/db'

/**
 * Defense mechanism reading stored per session
 */
export type DefenseMechanismRecord = {
  mechanism: string
  intensity: number
  turn: number
  sessionId: string
  therapistId?: string
  createdAt?: string
}

/**
 * Valid defense mechanism names
 */
const VALID_MECHANISMS = [
  'denial',
  'projection',
  'intellectualization',
  'rationalization',
  'splitting',
  'regression',
  'displacement',
  'reaction-formation',
  'sublimation',
  'humor',
] as const

type DefenseMechanismName = (typeof VALID_MECHANISMS)[number]

/**
 * Validate defense mechanism name
 */
const isValidMechanism = (name: unknown): name is DefenseMechanismName =>
  typeof name === 'string' &&
  VALID_MECHANISMS.includes(name as DefenseMechanismName)

/**
 * Validate intensity score (0-5 scale)
 */
const isValidIntensity = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 5

/**
 * Validate turn number
 */
const isValidTurn = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0

/**
 * POST /api/defense - Store defense mechanism readings for a session
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = (await request.json()) as unknown

    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { sessionId, therapistId, defenses } = body as {
      sessionId?: unknown
      therapistId?: unknown
      defenses?: unknown
    }

    if (!sessionId || typeof sessionId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing required field: sessionId' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    if (!Array.isArray(defenses) || defenses.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing or empty defenses array' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Validate each defense reading
    for (const defense of defenses) {
      if (!defense || typeof defense !== 'object') {
        return new Response(
          JSON.stringify({ error: 'Invalid defense reading' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        )
      }

      const { mechanism, intensity, turn } = defense as {
        mechanism?: unknown
        intensity?: unknown
        turn?: unknown
      }

      if (!isValidMechanism(mechanism)) {
        return new Response(
          JSON.stringify({
            error: `Invalid mechanism: ${mechanism}. Must be one of: ${VALID_MECHANISMS.join(', ')}`,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        )
      }

      if (!isValidIntensity(intensity)) {
        return new Response(
          JSON.stringify({
            error: 'Intensity must be a number between 0 and 5',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        )
      }

      if (!isValidTurn(turn)) {
        return new Response(
          JSON.stringify({ error: 'Turn must be a non-negative integer' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        )
      }
    }

    const client = await getPool().connect()
    try {
      // Verify session exists
      const sessionCheck = await client.query(
        'SELECT id FROM sessions WHERE id = $1',
        [sessionId],
      )

      if (sessionCheck.rowCount === 0) {
        return new Response(JSON.stringify({ error: 'Session not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Insert defense readings
      const insertQuery = `
        INSERT INTO defense_readings (
          session_id, therapist_id, mechanism, intensity, turn, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id
      `

      const insertPromises: Promise<unknown>[] = []

      for (const defense of defenses) {
        const { mechanism, intensity, turn } = defense as {
          mechanism: DefenseMechanismName
          intensity: number
          turn: number
        }

        insertPromises.push(
          client.query(insertQuery, [
            sessionId,
            therapistId ?? null,
            mechanism,
            intensity,
            turn,
          ]),
        )
      }

      await Promise.all(insertPromises)

      return new Response(
        JSON.stringify({
          success: true,
          sessionId,
          count: defenses.length,
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      )
    } finally {
      client.release()
    }
  } catch (error: unknown) {
    console.error('Error saving defense readings:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

/**
 * GET /api/defense - Retrieve defense mechanism history
 * Query params:
 *   - sessionId: required - get readings for a specific session
 *   - therapistId: optional - get readings for a therapist across sessions
 *   - mechanism: optional - filter by specific mechanism
 */
export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url)
    const sessionId = url.searchParams.get('sessionId')
    const therapistId = url.searchParams.get('therapistId')
    const mechanism = url.searchParams.get('mechanism')

    if (!sessionId && !therapistId) {
      return new Response(
        JSON.stringify({ error: 'Missing sessionId or therapistId parameter' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    if (mechanism && !isValidMechanism(mechanism)) {
      return new Response(
        JSON.stringify({
          error: `Invalid mechanism filter. Must be one of: ${VALID_MECHANISMS.join(', ')}`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const client = await getPool().connect()
    try {
      let queryText = `
        SELECT
          id,
          session_id,
          therapist_id,
          mechanism,
          intensity,
          turn,
          created_at
        FROM defense_readings
        WHERE 1=1
      `
      const params: (string | number)[] = []
      let paramIndex = 1

      if (sessionId) {
        queryText += ` AND session_id = $${paramIndex}`
        params.push(sessionId)
        paramIndex++
      }

      if (therapistId) {
        queryText += ` AND therapist_id = $${paramIndex}`
        params.push(therapistId)
        paramIndex++
      }

      if (mechanism) {
        queryText += ` AND mechanism = $${paramIndex}`
        params.push(mechanism)
        paramIndex++
      }

      queryText += ` ORDER BY turn ASC, created_at ASC`

      const result = await client.query(queryText, params)

      const readings: DefenseMechanismRecord[] = (
        result.rows as Record<string, unknown>[]
      ).map((row) => {
        const therapistId = row['therapist_id'] as string | null | undefined
        const createdAtRaw = row['created_at']
        return {
          mechanism: String(row['mechanism']),
          intensity: Number(row['intensity']),
          turn: Number(row['turn']),
          sessionId: String(row['session_id']),
          therapistId: therapistId ? String(therapistId) : undefined,
          createdAt:
            createdAtRaw instanceof Date
              ? createdAtRaw.toISOString()
              : String(createdAtRaw as string | number),
        }
      })

      return new Response(
        JSON.stringify({
          sessionId,
          therapistId,
          mechanism,
          readings,
          count: readings.length,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    } finally {
      client.release()
    }
  } catch (error: unknown) {
    console.error('Error fetching defense readings:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
