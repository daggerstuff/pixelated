import { resolveInternalUserId } from '@/lib/auth/internal-identity'
import { getSession } from '@/lib/auth/session'
import { getPool } from '@/lib/db'

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

const jsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
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

export const getTrainingSessionResponse = async (
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
  const therapistId = await resolveInternalUserId(session.user)
  if (!therapistId) {
    return jsonResponse({ error: 'User identity not resolved' }, 403)
  }

  try {
    const result = await getPool().query<{ id: string; context: unknown }>(
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
    const messages = await getPool().query<{
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
    console.error('Error fetching training session:', error)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
}
