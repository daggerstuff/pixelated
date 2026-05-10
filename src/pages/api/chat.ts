import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'
import type { ModelMessage } from 'ai'
import { NextRequest } from 'next/server'

type MessageRequestBody = {
  userId: string
  message: string
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const toMessageRequestBody = (value: unknown): MessageRequestBody | null => {
  if (!isObject(value)) return null

  const { userId, message } = value
  if (typeof userId !== 'string' || typeof message !== 'string') {
    return null
  }

  return { userId, message }
}

export async function POST(request: NextRequest) {
  const requestBody = toMessageRequestBody(await request.json())
  if (!requestBody) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Invalid request format',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  const message = requestBody.message

  const messages: ModelMessage[] = [
    {
      role: 'system',
      content: `You are a helpful AI therapist assistant.`
    },
    { role: 'user', content: message },
  ]

  const result = streamText({
    model: anthropic('claude-3-5-sonnet-20241022'),
    messages,
  })

  return result.toTextStreamResponse()
}
