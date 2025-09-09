import { BiasDetectionEngine } from '../../../lib/ai/bias-detection/BiasDetectionEngine'
import type { TherapeuticSession as SessionData } from '../../../lib/ai/bias-detection/types'

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

  if (!body || typeof body !== 'object') {
    return new Response('Invalid request body', { status: 400 })
  }

 const { sessions, options } = body as { 
    sessions?: unknown[]; 
    options?: {
      concurrency?: number;
      batchSize?: number;
      onProgress?: (progress: { completed: number; total: number }) => void;
      onError?: (error: Error, session: any) => void;
      retries?: number;
      timeoutMs?: number;
      logProgress?: boolean;
      logErrors?: boolean;
      priority?: 'low' | 'medium' | 'high';
    }
  }
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return new Response('Missing or invalid sessions array', { status: 400 })
  }

  // Optionally validate each session object (basic check)
  for (const session of sessions) {
    if (!session || typeof session !== 'object' || !(session as { sessionId?: unknown }).sessionId) {
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
