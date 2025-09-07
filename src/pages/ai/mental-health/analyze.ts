import type { APIContext } from 'astro'
import { createMentalLLaMAFromEnv } from '@/lib/ai/mental-llama'
import { getApiEndpointLogger } from '@/lib/logging/standardized-logger'

export const POST: (context: APIContext) => Promise<Response> = async ({
  request,
}) => {
  const logger = getApiEndpointLogger('/api/ai/mental-health/analyze')
  logger.info('Analyzing mental health')

  try {
    const { messages } = (await request.json()) as {
      messages: Array<{ role: string; content: string }>
    }

    logger.debug('Received messages', { messages })

    const model = createMentalLLaMAFromEnv()
    const result = await model.chat(messages)

    logger.info('Successfully analyzed mental health')
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    logger.error('Error analyzing mental health', { error })
    return new Response('Error analyzing mental health', { status: 500 })
  }
}