import { BiasDetectionEngine } from '../../../lib/ai/bias-detection/BiasDetectionEngine'
import { JobQueue } from '../../../lib/ai/bias-detection/job-queue'
import type { TherapeuticSession } from '../../../lib/ai/bias-detection/types'
import type { BatchAnalysisResult } from '../../../lib/ai/bias-detection/types'

const engine = new BiasDetectionEngine()
const batchJobQueue = new JobQueue<TherapeuticSession[], BatchAnalysisResult>(async (sessions, update) => {
  // Use batchAnalyzeSessions with progress callback
  return await engine.batchAnalyzeSessions(sessions, {
      onProgress: ({ completed, total }) => update(completed / total),
      logProgress: false,
      logErrors: false,
    });
})

export async function POST({ request }: { request: Request }): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }
  
  const { sessions } = body as { sessions?: TherapeuticSession[] }
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
