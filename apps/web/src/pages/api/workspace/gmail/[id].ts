import type { APIRoute } from 'astro'

import { getPool } from '@/lib/db'

import { jsonResponse, requireWorkspaceUser } from '../_lib'

interface InboxMessageRow {
  id: string
  message_id: string
  from_name: string
  from_address: string
  to_addresses: string[] | null
  subject: string
  body: string
  received_at: Date
  read_at: Date | null
  owner_id: string
}

/**
 * GET /api/workspace/gmail/[id] — fetch one of the caller's messages
 * (includes body). Strictly owner-scoped; other users' messages → 404.
 */
export const GET: APIRoute = async ({ request, params }) => {
  const auth = await requireWorkspaceUser(request)
  if ('response' in auth) return auth.response
  const { user } = auth

  const id = params?.['id']
  if (!id) {
    return jsonResponse({ success: false, error: 'Missing message id' }, 400)
  }

  const result = await getPool().query<InboxMessageRow>(
    `SELECT id, message_id, from_name, from_address, to_addresses, subject,
            body, received_at, read_at, owner_id
     FROM inbox_messages
     WHERE id = $1 AND owner_id = $2`,
    [id, user.id],
  )
  if (result.rowCount === 0) {
    return jsonResponse({ success: false, error: 'Message not found' }, 404)
  }
  const r = result.rows[0]

  return jsonResponse({
    success: true,
    message: {
      id: r.id,
      messageId: r.message_id,
      fromName: r.from_name,
      fromAddress: r.from_address,
      toAddresses: r.to_addresses ?? [],
      subject: r.subject,
      body: r.body,
      receivedAt: r.received_at,
      readAt: r.read_at,
      read: r.read_at !== null,
      ownerId: r.owner_id,
    },
  })
}

/**
 * PATCH /api/workspace/gmail/[id] — mark one of the caller's messages
 * read or unread. Strictly owner-scoped.
 */
export const PATCH: APIRoute = async ({ request, params }) => {
  const auth = await requireWorkspaceUser(request)
  if ('response' in auth) return auth.response
  const { user } = auth

  const id = params?.['id']
  if (!id) {
    return jsonResponse({ success: false, error: 'Missing message id' }, 400)
  }

  let body: { read?: unknown }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400)
  }
  if (typeof body.read !== 'boolean') {
    return jsonResponse(
      { success: false, error: 'read must be a boolean' },
      400,
    )
  }

  const result = await getPool().query<InboxMessageRow>(
    `UPDATE inbox_messages
     SET read_at = CASE WHEN $3 THEN COALESCE(read_at, NOW()) ELSE NULL END
     WHERE id = $1 AND owner_id = $2
     RETURNING id, message_id, from_name, from_address, to_addresses, subject,
               body, received_at, read_at, owner_id`,
    [id, user.id, body.read],
  )
  if (result.rowCount === 0) {
    return jsonResponse({ success: false, error: 'Message not found' }, 404)
  }
  const r = result.rows[0]

  return jsonResponse({
    success: true,
    message: {
      id: r.id,
      messageId: r.message_id,
      fromName: r.from_name,
      fromAddress: r.from_address,
      toAddresses: r.to_addresses ?? [],
      subject: r.subject,
      receivedAt: r.received_at,
      readAt: r.read_at,
      read: r.read_at !== null,
      ownerId: r.owner_id,
    },
  })
}
