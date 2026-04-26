import type { APIRoute } from 'astro'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { AgentActivityDAO, type AgentActivityRecord } from '@/services/mongodb.dao'
import { v4 as uuidv4 } from 'uuid'

const logger = createBuildSafeLogger('pixel-inference-stream')

const PIXEL_API_URL = process.env.PIXEL_API_URL || 'http://localhost:8001'

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json()
    const turnId = body.turnId || uuidv4()
    const userId = body.user_id || 'anonymous'
    
    // Forward the request to the Python backend
    const response = await fetch(`${PIXEL_API_URL}/infer-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(`Backend error: ${response.status} ${errorText}`)
      return new Response(JSON.stringify({ error: 'Backend inference service error' }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body from backend')

    const collectedActivities: any[] = []
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    // Create a custom stream to collect activities while proxying
    const stream = new ReadableStream({
      async start(controller) {
        let buffer = ''
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            
            controller.enqueue(value)
            
            // Parse activities for persistence
            buffer += decoder.decode(value, { stream: true })
            const parts = buffer.split('\n\n')
            buffer = parts.pop() || ''

            for (const part of parts) {
              if (!part.trim()) continue
              if (part.includes('event: activity')) {
                const dataMatch = part.match(/data: (.*)/)
                if (dataMatch?.[1]) {
                  try {
                    collectedActivities.push(JSON.parse(dataMatch[1]))
                  } catch (e) {
                    // Ignore parse errors for persistence
                  }
                }
              }
            }
          }

          // Persist activities after stream ends
          if (collectedActivities.length > 0) {
            const dao = new AgentActivityDAO()
            await dao.saveActivities({
              id: uuidv4(),
              turnId,
              userId,
              activities: collectedActivities,
              timestamp: Date.now()
            })
            logger.info(`Persisted ${collectedActivities.length} activities for turn ${turnId}`)
          }
          
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error: any) {
    logger.error(`Streaming error: ${error.message}`)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
