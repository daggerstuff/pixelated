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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

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
    res
      .status(400)
      .json({ error: 'Request body does not match BatchBody shape' })
    return
  }

  // (Removed redundant destructure here—move below with type assertion)

  if (!body || typeof body !== 'object') {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const { sessions: batchSessions, options } = body as BatchBody
  const MAX_BATCH = 100
  if (
    !Array.isArray(sessions) ||
    sessions.length === 0 ||
    sessions.length > MAX_BATCH
  ) {
    res.status(400).json({ error: 'Missing or invalid sessions array' })
    return
  }

  // Prefer forNext utility if available, otherwise use for-of loop
  // forNext(sessions, (session) => { ... })
  for (const session of batchSessions) {
    if (!session || typeof session !== 'object' || !('sessionId' in session)) {
      res.status(400).json({ error: 'Invalid session object in array' })
      return
    }
  }

  // Instantiate engine (could be singleton in real app)
  const engine = new BiasDetectionEngine()

  try {
    const { results, errors } = await engine.batchAnalyzeSessions(
      sessions as SessionData[],
      options,
    )
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({ results, errors })
    return
  } catch (error) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(500).json({ error: (error as Error).message })
    return
  }
}
