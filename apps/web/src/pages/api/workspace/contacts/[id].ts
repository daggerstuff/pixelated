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

/**
 * GET /api/workspace/contacts/[id] — fetch one of the caller's contacts.
 * Strictly owner-scoped; other users' contacts resolve to 404.
 */
export const GET: APIRoute = async ({ request, params }) => {
  const auth = await requireWorkspaceUser(request)
  if ('response' in auth) return auth.response
  const { user } = auth

  const id = params?.['id']
  if (!id) {
    return jsonResponse({ success: false, error: 'Missing contact id' }, 400)
  }

  const result = await getPool().query<ContactRow>(
    `SELECT id, name, email, phone, organization, notes, owner_id,
            created_at, updated_at
     FROM contacts
     WHERE id = $1 AND owner_id = $2`,
    [id, user.id],
  )
  if (result.rowCount === 0) {
    return jsonResponse({ success: false, error: 'Contact not found' }, 404)
  }
  const r = result.rows[0]

  return jsonResponse({
    success: true,
    contact: {
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      organization: r.organization,
      notes: r.notes,
      ownerId: r.owner_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    },
  })
}
