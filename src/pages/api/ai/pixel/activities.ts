import type { APIRoute } from 'astro'
import { AgentActivityDAO } from '@/services/mongodb.dao'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

const logger = createBuildSafeLogger('agent-activities-api')

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url)
    const turnId = url.searchParams.get('turnId')

    if (!turnId) {
      return new Response(JSON.stringify({ error: 'Missing turnId parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const dao = new AgentActivityDAO()
    const record = await dao.getActivitiesByTurnId(turnId)

    if (!record) {
      return new Response(JSON.stringify({ error: 'Activities not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify(record), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    logger.error(`Error fetching activities: ${error.message}`)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
