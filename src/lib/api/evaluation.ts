import type { NextApiRequest, NextApiResponse } from 'next'
import { saveEvaluation, getEvaluations } from '@/lib/evaluationStore'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === 'GET') {
    const sessionId = req.query['sessionId'] as string
    const evaluations = await getEvaluations(sessionId)
    return res.status(200).json(evaluations)
  }
  if (req.method === 'POST') {
    const { sessionId, feedback } = req.body
    if (!sessionId || !feedback) {
      return res.status(400).json({ error: 'Missing data' })
    }
    const saved = await saveEvaluation(sessionId, feedback)
    return res.status(201).json(saved)
  }
  res.status(405).end()
}

export async function POST(context: any) {
  const { request } = context
  const { sessionId, feedback } = request.body
  if (!sessionId || !feedback) {
    return {
      status: 400,
      json: async () => ({ error: 'Missing data' }),
    }
  }
  const saved = await import('@/lib/evaluationStore').then((m) =>
    m.saveEvaluation(sessionId, feedback),
  )
  return {
    status: 201,
    json: async () => ({ success: true, ...saved }),
  }
}
