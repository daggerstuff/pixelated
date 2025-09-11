import { saveEvaluation, getEvaluations } from '../src/lib/evaluationStore'

export const GET = async ({ request }) => {
  const url = new URL(request.url)
  const sessionId = url.searchParams.get('sessionId')
  if (!sessionId) {
    return new Response(JSON.stringify([]), { status: 200 })
  }
  const evaluations = await getEvaluations(sessionId)
  return new Response(JSON.stringify(evaluations), { status: 200 })
}

export const POST = async ({ request }) => {
  const { sessionId, feedback } = await request.json()
  if (!sessionId || !feedback) {
    return new Response(JSON.stringify({ error: 'Missing data' }), {
      status: 400,
    })
  }
  const saved = await saveEvaluation(sessionId, feedback)
  return new Response(JSON.stringify(saved), { status: 201 })
}
