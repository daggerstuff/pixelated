import { resolveInternalUserId } from '@/lib/auth/internal-identity'
import { getSession } from '@/lib/auth/session'
import { isDatabaseUnavailableError, query } from '@/lib/db'

type TrainingClientProfile = {
  name: string
  age: number
  gender: string
  personalityType: string
  presentingProblem: string
  triggers?: string[]
  strengths?: string[]
}

type TrainingSessionContext = {
  synthetic?: boolean
  clientProfile?: Partial<TrainingClientProfile>
  difficultyLevel?: string | number
}

/**
 * Upper bound on the training data load.
 *
 * The identity-bridge repair put an identity-resolution await in front of the
 * Postgres pool. When that await (or the pool read after it) never settles, the
 * runtime cancels the request and the page fails with Cloudflare Error 1101.
 * The deadline makes the route fail fast with a retryable 503 instead.
 *
 * The deadline is the outer guard. Client acquisition is bounded separately in
 * `lib/db` (`DB_ACQUIRE_TIMEOUT_MS` × `DB_ACQUIRE_ATTEMPTS`), so a hung
 * `connect()` fails fast inside this deadline instead of consuming all of it.
 */
export const TRAINING_DATA_DEADLINE_MS = 8_000

const RETRY_AFTER_SECONDS = '1'

export class TrainingDataDeadlineExceededError extends Error {
  constructor(deadlineMs: number) {
    super(`Training data load exceeded its ${deadlineMs}ms deadline`)
    this.name = 'TrainingDataDeadlineExceededError'
  }
}

/**
 * Race `work` against a deadline.
 *
 * Exported so the message-POST route reuses this exact bound instead of
 * building a second deadline mechanism. The caller maps
 * `TrainingDataDeadlineExceededError` to its own retryable response.
 */
export const withDeadline = async <T>(
  work: Promise<T>,
  deadlineMs: number,
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new TrainingDataDeadlineExceededError(deadlineMs)),
      deadlineMs,
    )
  })
  try {
    return await Promise.race([work, deadline])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

const toTrainingResponse = (
  value: unknown,
): {
  clientProfile: TrainingClientProfile
  difficultyLevel: string | number
} | null => {
  if (!isRecord(value)) return null
  const context = value as TrainingSessionContext
  const profile = context.clientProfile
  if (
    context.synthetic !== true ||
    !profile ||
    typeof profile.name !== 'string' ||
    typeof profile.age !== 'number' ||
    typeof profile.gender !== 'string' ||
    typeof profile.personalityType !== 'string' ||
    typeof profile.presentingProblem !== 'string' ||
    (profile.triggers !== undefined && !isStringArray(profile.triggers)) ||
    (profile.strengths !== undefined && !isStringArray(profile.strengths)) ||
    (typeof context.difficultyLevel !== 'string' &&
      typeof context.difficultyLevel !== 'number')
  ) {
    return null
  }

  return {
    clientProfile: {
      name: profile.name,
      age: profile.age,
      gender: profile.gender,
      personalityType: profile.personalityType,
      presentingProblem: profile.presentingProblem,
      ...(profile.triggers ? { triggers: profile.triggers } : {}),
      ...(profile.strengths ? { strengths: profile.strengths } : {}),
    },
    difficultyLevel: context.difficultyLevel,
  }
}

const loadTrainingSession = async (
  request: Request,
  sessionId: string | undefined,
): Promise<Response> => {
  const session = await getSession(request)
  if (!session) return jsonResponse({ error: 'Authentication required' }, 401)
  if (!sessionId || !isUuid(sessionId)) {
    return jsonResponse({ error: 'Invalid session ID' }, 400)
  }

  // getSession() surfaces the Auth0 `sub` as user.id; sessions.therapist_id is
  // a uuid column, so resolve through the auth_accounts bridge first.
  try {
    // Identity resolution runs inside the try because it performs the first
    // Postgres round-trip (`resolveIdentity` → `transaction` → `acquireClient`),
    // which is the stage diagnosis D3 measured stalling for ~8 s. A bounded
    // acquisition failure here must surface as the retryable 503 below, so it
    // is propagated rather than reported as an unresolved principal (403).
    const therapistId = await resolveInternalUserId(session.user, {
      propagateDatabaseErrors: true,
    })
    if (!therapistId) {
      return jsonResponse({ error: 'User identity not resolved' }, 403)
    }

    const result = await query<{ id: string; context: unknown }>(
      `SELECT id, context
       FROM sessions
       WHERE id = $1 AND therapist_id = $2 AND session_type = 'training'`,
      [sessionId, therapistId],
    )
    if (result.rowCount === 0) {
      return jsonResponse({ error: 'Session not found' }, 404)
    }

    const trainingData = toTrainingResponse(result.rows[0]?.context)
    if (!trainingData) {
      return jsonResponse({ error: 'Training session not found' }, 404)
    }
    const messages = await query<{
      id: string
      content: string
      created_at: Date
    }>(
      `SELECT id, content, created_at
       FROM training_session_messages
       WHERE session_id = $1 AND therapist_id = $2
       ORDER BY created_at DESC
       LIMIT 500`,
      [sessionId, therapistId],
    )
    return jsonResponse(
      {
        sessionId: result.rows[0]?.id,
        ...trainingData,
        messages: messages.rows.reverse().map((message) => ({
          id: message.id,
          content: message.content,
          createdAt: message.created_at,
        })),
      },
      200,
    )
  } catch (error: unknown) {
    // The acquisition bound in lib/db turns a hung pool connect into this
    // retryable failure well inside the deadline; surface it as the same 503
    // shape instead of a 500, because the next request may succeed.
    if (isDatabaseUnavailableError(error)) {
      console.error('Training session database unavailable:', error)
      return jsonResponse({ error: 'Session temporarily unavailable' }, 503, {
        'Retry-After': RETRY_AFTER_SECONDS,
      })
    }
    console.error('Error fetching training session:', error)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
}

export const getTrainingSessionResponse = async (
  request: Request,
  sessionId: string | undefined,
): Promise<Response> => {
  try {
    return await withDeadline(
      loadTrainingSession(request, sessionId),
      TRAINING_DATA_DEADLINE_MS,
    )
  } catch (error: unknown) {
    if (error instanceof TrainingDataDeadlineExceededError) {
      console.error('Training session load deadline exceeded:', error.message)
      return jsonResponse({ error: 'Session temporarily unavailable' }, 503, {
        'Retry-After': RETRY_AFTER_SECONDS,
      })
    }
    // Anything else keeps its previous behaviour (the handler rejects).
    throw error
  }
}
