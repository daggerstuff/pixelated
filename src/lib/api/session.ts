import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession, saveSession } from '@/lib/sessionStore'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === 'GET') {
    const sessionId = req.query['id'] as string
    const session = await getSession(sessionId)
    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }
    return res.status(200).json(session)
  }
  if (req.method === 'POST') {
    const sessionData = req.body
    const saved = await saveSession(sessionData)
    return res.status(201).json(saved)
  }
  res.status(405).end()
}

export async function GET(context: unknown) {
  if (typeof context !== 'object' || context === null) {
    throw new Error('Invalid context')
  }
  const { request } = context as { request: { query?: { id?: string } } }
  const sessionId = request.query?.id
  const session = await import('@/lib/sessionStore').then((m) =>
    m.getSession(sessionId),
  )
  if (!session) {
    return {
      status: 404,
      json: async () => ({ error: 'Session not found' }),
    }
  }
  return {
    status: 200,
    json: async () => session,
  }
}

export async function POST(context: unknown) {
  if (typeof context !== 'object' || context === null) {
    throw new Error('Invalid context')
  }
  const { request } = context as { request: { body: Record<string, unknown> } }
  const sessionData = request.body
  const saved = await import('@/lib/sessionStore').then((m) =>
    m.saveSession(sessionData),
  )
  return {
    status: 201,
    json: async () => saved,
  }
}
