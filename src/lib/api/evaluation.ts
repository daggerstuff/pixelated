import { saveEvaluation, getEvaluations } from '@/lib/evaluationStore'

export async function GET(context: any) {
  const { request } = context
  const url = new URL(request.url)
  const sessionId = url.searchParams.get('sessionId')

  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Missing sessionId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const evaluations = await getEvaluations(sessionId)
  return new Response(JSON.stringify(evaluations), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function POST(context: any) {
  const { request } = context
  const body = await request.json()
  const { sessionId, feedback } = body

  if (!sessionId || !feedback) {
    return new Response(JSON.stringify({ error: 'Missing data' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const saved = await saveEvaluation(sessionId, feedback)
  return new Response(JSON.stringify({ success: true, ...saved }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  })
}
