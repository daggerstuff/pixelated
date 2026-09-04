import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'
import type { ModelMessage } from 'ai'
import type { APIRoute } from 'astro'
import { z } from 'zod'

import { verifyAuthToken } from '../../utils/auth'
import { validateRequestBody } from '../../lib/validation/validateRequestBody'

export const prerender = false

const chatSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  message: z.string().min(1, 'message is required'),
})

export const POST: APIRoute = async ({ request }) => {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Authorization header required' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  // Extract Bearer token from Authorization header
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader

  try {
    await verifyAuthToken(token)
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const [requestBody, validationError] = await validateRequestBody(
    request,
    chatSchema,
  )
  if (validationError) {
    const firstError = Object.values(validationError.details)[0] ?? 'Invalid request format'
    return new Response(
      JSON.stringify({
        success: false,
        message: firstError,
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
      content: 'You are a helpful AI therapist assistant.',
    },
    { role: 'user', content: message },
  ]

  const result = streamText({
    model: anthropic('claude-3-5-sonnet-20241022'),
    messages,
  })

  return result.toTextStreamResponse()
}
