import type { NextApiRequest, NextApiResponse } from 'next'

function generateMockResponse(input: string): string {
  return `Mock client says: ${input}`
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === 'POST') {
    const { message } = req.body
    if (!message) {
      return res.status(400).json({ error: 'Message required' })
    }
    const response = generateMockResponse(message)
    return res.status(200).json({ response })
  }
  res.status(405).end()
}

export async function POST(context: any) {
  const { request } = context
  const { message } = request.body
  if (!message) {
    return {
      status: 400,
      json: async () => ({ error: 'Message required' }),
    }
  }
  const reply = `Mock client says: ${message}`
  return {
    status: 200,
    json: async () => ({ reply }),
  }
}
