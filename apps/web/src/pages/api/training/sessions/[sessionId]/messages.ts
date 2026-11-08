import type { APIRoute } from 'astro'

import { resolveInternalUserId } from '@/lib/auth/internal-identity'
import { getSession } from '@/lib/auth/session'
import { getPool } from '@/lib/db'

const jsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )

export const POST: APIRoute = async ({ request, params }) => {
  const session = await getSession(request)
  if (!session) return jsonResponse({ error: 'Authentication required' }, 401)

  const origin = request.headers.get('origin')
  if (!origin || new URL(origin).origin !== new URL(request.url).origin) {
    return jsonResponse({ error: 'Invalid request origin' }, 403)
  }

  const sessionId = params['sessionId']
  if (!sessionId || !isUuid(sessionId)) {
    return jsonResponse({ error: 'Invalid session ID' }, 400)
  }

  // getSession() surfaces the Auth0 `sub` as user.id; sessions.therapist_id is
  // a uuid column, so resolve through the auth_accounts bridge first.
  const therapistId = await resolveInternalUserId(session.user)
  if (!therapistId) {
    return jsonResponse({ error: 'User identity not resolved' }, 403)
  }

  try {
    const payload: unknown = await request.json()
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('content' in payload) ||
      typeof payload.content !== 'string'
    ) {
      return jsonResponse({ error: 'Message content is required' }, 400)
    }

    const content = payload.content.trim()
    if (content.length === 0 || content.length > 1000) {
      return jsonResponse(
        { error: 'Message must be 1 to 1000 characters' },
        400,
      )
    }

    const result = await getPool().query<{
      id: string
      content: string
      created_at: Date
    }>(
      `INSERT INTO training_session_messages (session_id, therapist_id, content)
       SELECT id, therapist_id, $3
       FROM sessions
       WHERE id = $1
         AND therapist_id = $2
         AND session_type = 'training'
         AND context->>'synthetic' = 'true'
       RETURNING id, content, created_at`,
      [sessionId, therapistId, content],
    )

    const message = result.rows[0]
    if (!message)
      return jsonResponse({ error: 'Training session not found' }, 404)

    return jsonResponse(
      {
        id: message.id,
        content: message.content,
        createdAt: message.created_at,
      },
      201,
    )
  } catch {
    return jsonResponse({ error: 'Unable to save training message' }, 500)
  }
}
