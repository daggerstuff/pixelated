import type { APIRoute } from 'astro'
import { AgentFeedbackDAO } from '@/services/mongodb.dao'
import { v4 as uuidv4 } from 'uuid'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

const logger = createBuildSafeLogger('agent-feedback-api')

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json()
    const { activityId, feedback, comment, userId, turnId } = body

    if (!activityId || !feedback) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const dao = new AgentFeedbackDAO()
    await dao.saveFeedback({
      id: uuidv4(),
      activityId,
      turnId,
      feedback,
      comment,
      userId: userId || 'anonymous',
      timestamp: Date.now()
    })

    logger.info(`Saved ${feedback} feedback for activity ${activityId}`)

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    logger.error(`Error saving feedback: ${error.message}`)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
