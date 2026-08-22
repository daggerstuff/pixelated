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

const toMessage = (r: InboxMessageRow, includeBody = false) => ({
  id: r.id,
  messageId: r.message_id,
  fromName: r.from_name,
  fromAddress: r.from_address,
  toAddresses: r.to_addresses ?? [],
  subject: r.subject,
  ...(includeBody ? { body: r.body } : {}),
  receivedAt: r.received_at,
  readAt: r.read_at,
  read: r.read_at !== null,
  ownerId: r.owner_id,
})

/**
 * GET /api/workspace/gmail — list the caller's inbox, newest first.
 *
 * Strictly owner-scoped. Optional ?unread=true filters to unread.
 * Cross-user messages are invisible (404 on [id]), not 403.
 */
export const GET: APIRoute = async ({ request }) => {
  const auth = await requireWorkspaceUser(request)
  if ('response' in auth) return auth.response
  const { user } = auth

  const params = new URL(request.url).searchParams
  const unread = params.get('unread') === 'true'
  const limit = Math.min(
    Math.max(parseInt(params.get('limit') ?? '50', 10) || 50, 1),
    200,
  )
  const offset = Math.max(parseInt(params.get('offset') ?? '0', 10) || 0, 0)

  const predicates: string[] = ['owner_id = $1']
  const values: unknown[] = [user.id]
  if (unread) {
    predicates.push('read_at IS NULL')
  }
  values.push(limit, offset)

  const result = await getPool().query<InboxMessageRow>(
    `SELECT id, message_id, from_name, from_address, to_addresses, subject,
            received_at, read_at, owner_id
     FROM inbox_messages
     WHERE ${predicates.join(' AND ')}
     ORDER BY received_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  )

  return jsonResponse({
    success: true,
    messages: result.rows.map((r) => toMessage(r)),
  })
}
