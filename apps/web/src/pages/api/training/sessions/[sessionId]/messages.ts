import type { APIRoute } from 'astro'

import { resolveInternalUserId } from '@/lib/auth/internal-identity'
import { getSession } from '@/lib/auth/session'
import { isDatabaseUnavailableError, query } from '@/lib/db'
import {
  TrainingDataDeadlineExceededError,
  withDeadline,
} from '@/lib/services/training/session-api'

/**
 * Upper bound on one trainee message POST.
 *
 * This route had no bound at all. Measured on the pinned release
 * (`bdee5c364` / Worker `547855bc`) on 2026-11-10, 2 of 8 message POSTs were
 * cancelled by the Workers runtime after 60 426 ms and 68 747 ms with no row
 * persisted, while a healthy POST completed in 2.7–4.5 s. The runtime does not
 * return an error the route can map; it kills the request.
 *
 * The deadline reuses the training data load's shape: a bounded wait that
 * answers the existing retryable `503` + `Retry-After` instead of leaving the
 * request to be cancelled. `lib/db` bounds client acquisition separately
 * (`DB_ACQUIRE_TIMEOUT_MS` × `DB_ACQUIRE_ATTEMPTS`, 5 000 ms) and the
 * statement at 5 000 ms, so a hung Postgres stage fails fast inside this bound.
 *
 * It is a guard, not a fix: a bounded `503` is not a persisted row.
 */
export const MESSAGE_POST_DEADLINE_MS = 8_000

const RETRY_AFTER_SECONDS = '1'

const jsonResponse = (
  body: unknown,
  status: number,
  headers: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )

const handleMessagePost: APIRoute = async ({ request, params }) => {
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

  try {
    // getSession() surfaces the Auth0 `sub` as user.id; sessions.therapist_id is
    // a uuid column, so resolve through the auth_accounts bridge first.
    //
    // Identity resolution performs the first Postgres round-trip. A bounded
    // acquisition failure is retryable, not an unresolvable principal, so it is
    // propagated and answered as the 503 below rather than denied as a 403.
    const therapistId = await resolveInternalUserId(session.user, {
      propagateDatabaseErrors: true,
    })
    if (!therapistId) {
      return jsonResponse({ error: 'User identity not resolved' }, 403)
    }

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

    const result = await query<{
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
  } catch (error: unknown) {
    // The acquisition bound in lib/db turns a hung pool connect into this
    // retryable failure well inside the deadline. Answer the same 503 shape:
    // the next attempt may succeed, so this is not a denial.
    if (isDatabaseUnavailableError(error)) {
      console.error('Training message database unavailable:', error)
      return jsonResponse(
        { error: 'Training message temporarily unavailable' },
        503,
        { 'Retry-After': RETRY_AFTER_SECONDS },
      )
    }
    return jsonResponse({ error: 'Unable to save training message' }, 500)
  }
}

export const POST: APIRoute = async (context) => {
  try {
    return await withDeadline(
      handleMessagePost(context),
      MESSAGE_POST_DEADLINE_MS,
    )
  } catch (error: unknown) {
    if (error instanceof TrainingDataDeadlineExceededError) {
      // No identifier in the log line: the deadline is a transient
      // availability fact, not a statement about the session.
      console.error('Training message post deadline exceeded:', error.message)
      return jsonResponse(
        { error: 'Training message temporarily unavailable' },
        503,
        { 'Retry-After': RETRY_AFTER_SECONDS },
      )
    }
    throw error
  }
}
