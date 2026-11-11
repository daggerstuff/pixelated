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

type MessageRow = {
  id: string
  content: string
  created_at: Date
}

/**
 * Header carrying the composer's submission identity, one value per send
 * action.
 *
 * It is optional: a client that sends nothing keeps the payload-derived key, so
 * the dedupe the first idempotency change established still holds.
 */
const MESSAGE_SUBMISSION_HEADER = 'x-message-submission-id'

/**
 * Namespace for the deterministic message key.
 *
 * Bump the version suffix whenever the key inputs change. `v2` adds the
 * client-supplied submission identity, so ids derived under `v1` (payload only)
 * can never collide with ids derived under this scheme: a v1 row is a different
 * submission from a v2 send of the same text, and reusing its id would silently
 * swallow the new message.
 */
const MESSAGE_KEY_NAMESPACE = 'training-message:v2'

/**
 * Deterministic primary key for one logical submission.
 *
 * `withDeadline` races the handler against a timer but does not abort the work
 * it wrapped, so a statement that overruns the 8 000 ms bound can still commit
 * after the client received the retryable `503`. The retry that `503` invites
 * then wrote a second row. Measured on the pinned release: one persisted POST
 * took 18 641 ms against the bound.
 *
 * A logical submission is identified by its payload — the session, the author
 * and the content — plus, when the client sends one, the submission identity
 * its composer minted for the send action. Deriving the row's primary key from
 * those inputs means the first attempt and its retry contend for the same row:
 * whichever reaches Postgres first inserts it, the other takes the conflict. No
 * new column, no new table, no migration.
 *
 * The payload alone cannot tell a retry from a deliberate repeat, so two
 * identical messages sent on purpose in one session used to resolve to one
 * submission and the second was never persisted. The identity separates them:
 * a retry of one send action reuses the identity and lands on one row, a second
 * deliberate send mints a new one and lands on a second row. A request that
 * carries no identity keeps the payload-derived key, which is self-verifying:
 * a conflict can only arise from an identical payload, so replaying the
 * existing row is always the same submission.
 *
 * The result is an RFC 9562 version-8 (custom) UUID so it stays a valid value
 * for the `uuid` primary key.
 */
const messageSubmissionId = async (
  sessionId: string,
  therapistId: string,
  content: string,
  submissionId?: string,
): Promise<string> => {
  // The identity is placed ahead of the free-text content: every field before it
  // is a uuid (or the empty string), so content can never forge an input that
  // concatenates to the same bytes as a different submission.
  const identity = submissionId ?? ''
  const input = new TextEncoder().encode(
    `${MESSAGE_KEY_NAMESPACE}\n${identity}\n${sessionId}\n${therapistId}\n${content}`,
  )
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', input))
  const hex = Array.from(digest, (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  const variant = ((Number.parseInt(hex.charAt(16), 16) & 0x3) | 0x8).toString(
    16,
  )
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

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

const handleMessagePost = async (
  context: Parameters<APIRoute>[0],
): Promise<Response> => {
  const { request, params } = context
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

    // One submission identity per send action. A retry of that action reuses
    // it, so both attempts derive the same row; a second deliberate send mints
    // a new one and derives a second row. A request that carries no identity, or
    // a value that is not a uuid, falls back to the payload-derived key so the
    // dedupe for clients that send nothing is unchanged.
    const submittedId = request.headers.get(MESSAGE_SUBMISSION_HEADER)?.trim()
    const submissionId =
      submittedId && isUuid(submittedId) ? submittedId.toLowerCase() : undefined

    const messageId = await messageSubmissionId(
      sessionId,
      therapistId,
      content,
      submissionId,
    )

    const result = await query<MessageRow>(
      `INSERT INTO training_session_messages (id, session_id, therapist_id, content)
       SELECT $1, id, therapist_id, $4
       FROM sessions
       WHERE id = $2
         AND therapist_id = $3
         AND session_type = 'training'
         AND context->>'synthetic' = 'true'
       ON CONFLICT (id) DO NOTHING
       RETURNING id, content, created_at`,
      [messageId, sessionId, therapistId, content],
    )

    let message = result.rows[0]
    if (!message) {
      // Two ways the insert returns nothing: the ownership predicate matched no
      // session, or the row already exists under this submission's key. Only
      // the second is a retry, so read it back — scoped to the caller so a
      // foreign row can never be returned — and answer it as the same 201.
      // This lookup runs only on that path; a fresh insert is still one
      // statement, so the happy path's latency is unchanged.
      const existing = await query<MessageRow>(
        `SELECT id, content, created_at
         FROM training_session_messages
         WHERE id = $1 AND session_id = $2 AND therapist_id = $3
         LIMIT 1`,
        [messageId, sessionId, therapistId],
      )
      message = existing.rows[0]
      if (!message)
        return jsonResponse({ error: 'Training session not found' }, 404)
    }

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
