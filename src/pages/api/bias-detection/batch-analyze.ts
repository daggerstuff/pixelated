import { BiasDetectionEngine } from '../../../lib/ai/bias-detection/BiasDetectionEngine'
import type { TherapeuticSession as SessionData } from '../../../lib/ai/bias-detection/types'

type BatchBody = { sessions?: SessionData[]; options?: Record<string, unknown> }

// Type guard for BatchBody shape, extra protection for null/array
const isBatchBody = (val: unknown): val is BatchBody => {
  return (
    typeof val === 'object' &&
    val !== null &&
    !Array.isArray(val) &&
    (!('sessions' in val) || Array.isArray((val as BatchBody).sessions)) &&
    (!('options' in val) ||
      (typeof (val as Record<string, unknown>)['options'] === 'object' &&
        (val as Record<string, unknown>)['options'] !== null &&
        !Array.isArray((val as Record<string, unknown>)['options'])))
  )
}

export const runtime = 'nodejs'

export async function POST({ request }: { request: Request }) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  if (!isBatchBody(body)) {
    return new Response(JSON.stringify({ error: 'Request body does not match BatchBody shape' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  if (!body || typeof body !== 'object') {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const { sessions: batchSessions, options } = body as BatchBody
  const MAX_BATCH = 100
  if (
    !Array.isArray(batchSessions) ||
    batchSessions.length === 0 ||
    batchSessions.length > MAX_BATCH
  ) {
    return new Response(JSON.stringify({ error: 'Missing or invalid sessions array' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Prefer forNext utility if available, otherwise use for-of loop
  // forNext(sessions, (session) => { ... })
  for (const session of batchSessions) {
    if (!session || typeof session !== 'object' || !('sessionId' in session)) {
      return new Response(JSON.stringify({ error: 'Invalid session object in array' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }

  // Instantiate engine (could be singleton in real app)
  const engine = new BiasDetectionEngine()

  try {
    const { results, errors } = await engine.batchAnalyzeSessions(
      batchSessions as SessionData[],
      options,
    )
    return new Response(JSON.stringify({ results, errors }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    })
  }
}
