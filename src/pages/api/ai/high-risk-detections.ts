// import type { APIRoute, APIContext } from 'astro'
import { createAuditLog, AuditEventType, AuditEventStatus } from '../../../lib/audit'
import { getSession } from '../../../lib/auth/session.js'
import { aiRepository } from '@/lib/db/ai'

export const GET = async ({ request, url }) => {
  let session

  try {
    // Verify session
    session = await getSession(request)
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Check if user has admin permissions
    if (session?.user?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Parse query parameters
    const limit = Number.parseInt(url.searchParams.get('limit') || '20', 10)
    const offset = Number.parseInt(url.searchParams.get('offset') || '0', 10)

    // Log the request
    await createAuditLog(
      AuditEventType.AI_OPERATION,
      'ai.crisis.high-risk.request',
      session.user.id,
      'ai',
      {
        limit,
        offset,
      },
      AuditEventStatus.SUCCESS
    )

    // Retrieve high-risk crisis detections
    const detections = await aiRepository.getHighRiskCrisisDetections(
      limit,
      offset,
    )

    // Log the response
    await createAuditLog(
      AuditEventType.AI_OPERATION,
      'ai.crisis.high-risk.response',
      session.user.id,
      'ai',
      {
        limit,
        offset,
        detectionsCount: detections.length,
        status: 'success',
      },
      AuditEventStatus.SUCCESS
    )

    // Return the results
    return new Response(JSON.stringify({ detections }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    console.error('Error retrieving high-risk crisis detections:', error)
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error?.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
