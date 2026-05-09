import { anthropic } from '@ai-sdk/anthropic'
import { supermemoryTools } from '@supermemory/tools/ai-sdk'
import { streamText } from 'ai'
import type { ModelMessage, ToolSet } from 'ai'
import { NextRequest } from 'next/server'

import { getContextWithProfile, storeConversation } from '@/lib/supermemory'

type MessageRequestBody = {
  userId: string
  message: string
}

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

type SupermemoryToolsFactory = (
  apiKey: string,
  containerTags: string[],
) => ToolSet

// eslint-disable-next-line typescript/no-unsafe-type-assertion
const createSupermemoryTools = supermemoryTools as SupermemoryToolsFactory

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
  const messages: ModelMessage[] = [
    {
      role: 'system',
      content: `User context:\nStatic facts: ${profile.static.join('\n')}\nRecent context: ${profile.dynamic.join('\n')}\nSearch context: ${context}`,
    },
    { role: 'user', content: message },
  ]

  // Stream response with Supermemory tools
  const tools = createSupermemoryTools(process.env.SUPERMEMORY_API_KEY ?? '', [userId])

  const result = streamText({
    model: anthropic('claude-3-5-sonnet-20241022'),
    messages,
    tools,
    onFinish: ({ text }) => {
      if (typeof text === 'string') {
        void storeConversation(userId, message, text)
      }
    },
  })

  return result.toTextStreamResponse()
}
