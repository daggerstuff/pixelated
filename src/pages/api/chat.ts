import { NextRequest } from 'next/server'
import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { supermemoryTools } from '@supermemory/tools/ai-sdk'
import { getContextWithProfile, storeConversation } from '@/lib/supermemory'

export async function POST(request: NextRequest) {
  const { userId, message } = await request.json()

  // Get context with profile + search
  const { context, profile } = await getContextWithProfile(userId, message)

  // Build messages with context
  const messages = [
    {
      role: 'system',
      content: `User context:\nStatic facts: ${profile.static.join('\n')}\nRecent context: ${profile.dynamic.join('\n')}\nSearch context: ${context.join('\n')}`
    },
    { role: 'user', content: message }
  ]

  // Stream response with Supermemory tools
  const result = await streamText({
    model: anthropic('claude-3-5-sonnet-20241022'),
    messages,
    tools: supermemoryTools(process.env.SUPERMEMORY_API_KEY ?? '', {
      containerTags: [userId]
    })
  })

  // Store conversation
  await storeConversation(userId, message, result)

  return result.toDataStreamResponse()
}