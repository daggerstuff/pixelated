import { anthropic } from '@ai-sdk/anthropic'
import { supermemoryTools } from '@supermemory/tools/ai-sdk'
import { streamText } from 'ai'
import { NextRequest } from 'next/server'

import { getContextWithProfile, storeConversation } from '@/lib/supermemory'

type MessageRequestBody = {
  userId: string
  message: string
}

type SupermemoryTools = (apiKey: string, options: { containerTags: string[] }) => unknown[]

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const toMessageRequestBody = (
  value: unknown,
): MessageRequestBody | null => {
  if (!isObject(value)) return null

  const { userId, message } = value
  if (typeof userId !== 'string' || typeof message !== 'string') {
    return null
  }

  return { userId, message }
}

const getSupermemoryTools = (
  apiKey: string,
  containerTags: string[],
): unknown[] => {
  const resolveTools = supermemoryTools as unknown as SupermemoryTools
  return resolveTools(apiKey, { containerTags })
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

  const { userId, message } = requestBody

  // Get context with profile + search
  const { context, profile } = await getContextWithProfile(userId, message)

  // Build messages with context
  const messages = [
    {
      role: 'system' as const,
      content: `User context:\nStatic facts: ${profile.static.join('\n')}\nRecent context: ${profile.dynamic.join('\n')}\nSearch context: ${context}`,
    },
    { role: 'user' as const, content: message },
  ] as const

  // Stream response with Supermemory tools
  const result = streamText({
    model: anthropic('claude-3-5-sonnet-20241022'),
    messages,
    tools: getSupermemoryTools(process.env.SUPERMEMORY_API_KEY ?? '', {
      containerTags: [userId],
    }),
    onFinish: ({ text }) => {
      if (typeof text === 'string') {
        void storeConversation(userId, message, text)
      }
    },
  })

  return result.toTextStreamResponse()
}
