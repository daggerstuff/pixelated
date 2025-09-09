import { BiasDetectionEngine } from '../../../lib/ai/bias-detection/BiasDetectionEngine'
import type { TherapeuticSession as SessionData } from '../../../lib/ai/bias-detection/types'

type BatchBody = { sessions?: SessionData[]; options?: Record<string, unknown> }

// Type guard for BatchBody shape, extra protection for null/array
const isBatchBody = (val: unknown): val is BatchBody => {
  return (
    typeof val === 'object' &&
    val !== null &&
    !Array.isArray(val) &&
    (
      !('sessions' in val) ||
      (Array.isArray((val as BatchBody).sessions))
    )
  )
}

export const runtime = 'nodejs'

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

 let body: unknown
 try {
   body = await req.json()
 } catch {
   return new Response('Invalid JSON', { status: 400 })
 }

 if (!isBatchBody(body)) {
   return new Response('Request body does not match BatchBody shape', { status: 400 })
 }

 const { sessions, options } = body

  if (!Array.isArray(sessions) || sessions.length === 0) {
    return new Response('Missing or invalid sessions array', { status: 400 })
  }

  // Prefer forNext utility if available, otherwise use for-of loop
  // forNext(sessions, (session) => { ... })
  for (const session of sessions) {
    if (!session || typeof session !== 'object' || !('sessionId' in session)) {
      return new Response('Invalid session object in array', { status: 400 })
    }
  }

  // Instantiate engine (could be singleton in real app)
  const engine = new BiasDetectionEngine()

  try {
    const { results, errors } = await engine.batchAnalyzeSessions(
      sessions as SessionData[],
      options
    )
    return new Response(
      JSON.stringify({ results, errors }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
