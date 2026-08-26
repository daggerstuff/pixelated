import type { APIRoute } from 'astro'

import { getPool } from '@/lib/db'

import { jsonResponse, requireWorkspaceUser } from '../_lib'

const SCOPED_WHERE =
  '(owner_id = $2 OR $2 = ANY(attendees) OR is_public = TRUE)'

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

/**
 * GET /api/workspace/calendar/[id] — fetch one event if the caller can see
 * it (owner / attendee / public). Otherwise 404.
 */
export const GET: APIRoute = async ({ request, params }) => {
  const auth = await requireWorkspaceUser(request)
  if ('response' in auth) return auth.response
  const { user } = auth

  const id = params?.['id']
  if (!id) {
    return jsonResponse({ success: false, error: 'Missing event id' }, 400)
  }

  const result = await getPool().query<CalendarEventRow>(
    `SELECT id, title, description, owner_id, attendees, start_at, end_at,
            location, is_public, created_at
     FROM calendar_events
     WHERE id = $1 AND ${SCOPED_WHERE}`,
    [id, user.id],
  )
  if (result.rowCount === 0) {
    return jsonResponse({ success: false, error: 'Event not found' }, 404)
  }
  const r = result.rows[0]

  return jsonResponse({
    success: true,
    event: {
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
    },
  })
}
