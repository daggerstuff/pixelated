import { NextRequest } from 'next/server'
import { BiasDetectionEngine } from '../../../lib/ai/bias-detection/BiasDetectionEngine'
import { JobQueue, Job } from '../../../lib/ai/bias-detection/job-queue'
import type { TherapeuticSession } from '../../../lib/ai/bias-detection/types'

const engine = new BiasDetectionEngine()
const batchJobQueue = new JobQueue<TherapeuticSession[], any>(async (sessions, update) => {
  // Use batchAnalyzeSessions with progress callback
  const { results, errors, metrics } = await engine.batchAnalyzeSessions(sessions, {
    onProgress: ({ completed, total }) => update(completed / total),
    logProgress: false,
    logErrors: false,
  })
  return { results, errors, metrics }
})

export const runtime = 'nodejs'

export default async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }
  let body: any
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }
  const { sessions } = body ?? {}
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return new Response('Missing or invalid sessions array', { status: 400 })
  }
  const jobId = batchJobQueue.submit(sessions)
  return new Response(JSON.stringify({ jobId }), {
    status: 202,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Export queue for status endpoint
export { batchJobQueue }