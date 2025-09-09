import { BiasDetectionEngine } from '../../../lib/ai/bias-detection/BiasDetectionEngine'
import type { TherapeuticSession as SessionData } from '../../../lib/ai/bias-detection/types'
import type { NextApiRequest, NextApiResponse } from 'next'

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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
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

  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Invalid request body' })
    return
  }

  const { sessions, options } = body as BatchBody
  const MAX_BATCH = 100
  if (!Array.isArray(sessions) || sessions.length === 0 || sessions.length > MAX_BATCH) {
    res.status(400).json({ error: 'Missing or invalid sessions array' })
    return
  }

  // Prefer forNext utility if available, otherwise use for-of loop
  // forNext(sessions, (session) => { ... })
  for (const session of sessions) {
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
      options
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
