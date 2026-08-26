import type { APIRoute } from 'astro'

import { getPool } from '@/lib/db'

import { jsonResponse, requireWorkspaceUser } from '../_lib'

const SCOPED_WHERE =
  '(owner_id = $1 OR $1 = ANY(attendees) OR is_public = TRUE)'

interface CalendarEventRow {
  id: string
  title: string
  description: string
  owner_id: string
  attendees: string[] | null
  start_at: Date
  end_at: Date
  location: string
  is_public: boolean
  created_at: Date
}

const toEvent = (r: CalendarEventRow) => ({
  id: r.id,
  title: r.title,
  description: r.description,
  ownerId: r.owner_id,
  attendees: r.attendees ?? [],
  startAt: r.start_at,
  endAt: r.end_at,
  location: r.location,
  isPublic: r.is_public,
  createdAt: r.created_at,
})

/**
 * GET /api/workspace/calendar — list events visible to the caller.
 *
 * Scoping: owner / attendee / public. Optional ?from= and ?to= bound the
 * visible window. Cross-user private events are invisible (404 on [id]),
 * not 403, to avoid ID enumeration.
 */
export const GET: APIRoute = async ({ request }) => {
  const auth = await requireWorkspaceUser(request)
  if ('response' in auth) return auth.response
  const { user } = auth

  const params = new URL(request.url).searchParams
  const from = params.get('from')
  const to = params.get('to')
  const limit = Math.min(
    Math.max(parseInt(params.get('limit') ?? '100', 10) || 100, 1),
    500,
  )

  const predicates: string[] = [SCOPED_WHERE]
  const values: unknown[] = [user.id]
  if (from) {
    values.push(from)
    predicates.push(`end_at >= $${values.length}::timestamptz`)
  }
  if (to) {
    values.push(to)
    predicates.push(`start_at <= $${values.length}::timestamptz`)
  }
  values.push(limit)

  const result = await getPool().query<CalendarEventRow>(
    `SELECT id, title, description, owner_id, attendees, start_at, end_at,
            location, is_public, created_at
     FROM calendar_events
     WHERE ${predicates.join(' AND ')}
     ORDER BY start_at ASC
     LIMIT $${values.length}`,
    values,
  )

  return jsonResponse({
    success: true,
    events: result.rows.map(toEvent),
  })
}

/**
 * POST /api/workspace/calendar — create an event owned by the caller.
 */
export const POST: APIRoute = async ({ request }) => {
  const auth = await requireWorkspaceUser(request)
  if ('response' in auth) return auth.response
  const { user } = auth

  let body: {
    title?: unknown
    description?: unknown
    startAt?: unknown
    endAt?: unknown
    location?: unknown
    attendees?: unknown
    isPublic?: unknown
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400)
  }
  if (typeof body.title !== 'string' || body.title.trim() === '') {
    return jsonResponse({ success: false, error: 'title is required' }, 400)
  }
  const start = new Date(body.startAt as string)
  const end = new Date(body.endAt as string)
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end <= start
  ) {
    return jsonResponse(
      {
        success: false,
        error: 'startAt and endAt are required; endAt must be after startAt',
      },
      400,
    )
  }
  const attendees = Array.isArray(body.attendees)
    ? body.attendees.filter((a): a is string => typeof a === 'string')
    : []

  const result = await getPool().query<CalendarEventRow>(
    `INSERT INTO calendar_events
       (title, description, owner_id, attendees, start_at, end_at, location, is_public)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, title, description, owner_id, attendees, start_at, end_at,
               location, is_public, created_at`,
    [
      body.title.trim(),
      typeof body.description === 'string' ? body.description : '',
      user.id,
      attendees,
      start,
      end,
      typeof body.location === 'string' ? body.location : '',
      body.isPublic === true,
    ],
  )
  const r = result.rows[0]

  return jsonResponse({ success: true, event: toEvent(r) }, 201)
}
