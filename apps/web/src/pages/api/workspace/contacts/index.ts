import type { APIRoute } from 'astro'

import { getPool } from '@/lib/db'

import { jsonResponse, requireWorkspaceUser } from '../_lib'

interface ContactRow {
  id: string
  name: string
  email: string
  phone: string
  organization: string
  notes: string
  owner_id: string
  created_at: Date
  updated_at: Date
}

const toContact = (r: ContactRow) => ({
  id: r.id,
  name: r.name,
  email: r.email,
  phone: r.phone,
  organization: r.organization,
  notes: r.notes,
  ownerId: r.owner_id,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

/**
 * GET /api/workspace/contacts — list the caller's contacts.
 *
 * Strictly owner-scoped (no sharing model for contacts). Cross-user
 * contacts are invisible (404 on [id]), not 403.
 */
export const GET: APIRoute = async ({ request }) => {
  const auth = await requireWorkspaceUser(request)
  if ('response' in auth) return auth.response
  const { user } = auth

  const params = new URL(request.url).searchParams
  const limit = Math.min(
    Math.max(parseInt(params.get('limit') ?? '100', 10) || 100, 1),
    500,
  )
  const offset = Math.max(parseInt(params.get('offset') ?? '0', 10) || 0, 0)

  const result = await getPool().query<ContactRow>(
    `SELECT id, name, email, phone, organization, notes, owner_id,
            created_at, updated_at
     FROM contacts
     WHERE owner_id = $1
     ORDER BY name ASC
     LIMIT $2 OFFSET $3`,
    [user.id, limit, offset],
  )

  return jsonResponse({
    success: true,
    contacts: result.rows.map(toContact),
  })
}

/**
 * POST /api/workspace/contacts — add a contact owned by the caller.
 */
export const POST: APIRoute = async ({ request }) => {
  const auth = await requireWorkspaceUser(request)
  if ('response' in auth) return auth.response
  const { user } = auth

  let body: {
    name?: unknown
    email?: unknown
    phone?: unknown
    organization?: unknown
    notes?: unknown
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400)
  }
  if (typeof body.name !== 'string' || body.name.trim() === '') {
    return jsonResponse({ success: false, error: 'name is required' }, 400)
  }
  const email =
    typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

  const result = await getPool().query<ContactRow>(
    `INSERT INTO contacts (name, email, phone, organization, notes, owner_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, email, phone, organization, notes, owner_id,
               created_at, updated_at`,
    [
      body.name.trim(),
      email,
      typeof body.phone === 'string' ? body.phone : '',
      typeof body.organization === 'string' ? body.organization : '',
      typeof body.notes === 'string' ? body.notes : '',
      user.id,
    ],
  )
  const r = result.rows[0]

  return jsonResponse({ success: true, contact: toContact(r) }, 201)
}
