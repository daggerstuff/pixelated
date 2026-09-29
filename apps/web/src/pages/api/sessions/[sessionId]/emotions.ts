import { protectRoute } from '@/lib/auth/serverAuth'
import type { AuthUser } from '@/lib/auth/types'
import { AIRepository } from '@/lib/db/ai/repository'
import { fetchSessionEmotionData } from '@/lib/services/emotion-tracking.service'

export const prerender = false

/**
 * API route to retrieve emotion data for a therapy session
 * GET /api/sessions/:sessionId/emotions
 *
 * Merges persisted user-reported emotion records with AI-detected
 * emotion analyses for the session.
 *
 * Query parameters:
 * - start: ISO timestamp lower bound
 * - end: ISO timestamp upper bound
 * - limit: Max number of data points
 */
export const GET = protectRoute({
  requiredRole: 'user',
  validateIPMatch: true,
  validateUserAgent: true,
})(async ({
  params,
  request,
  locals,
}: {
  params: Record<string, string | undefined>
  request: Request
  locals: { user: AuthUser }
}): Promise<Response> => {
  try {
    const { user } = locals
    const sessionId = params['sessionId']

    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Missing session ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Verify session exists and user has access
    const repository = new AIRepository()
    const sessions = await repository.getSessionsByIds([sessionId])
    const session = sessions[0]

    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const isParticipant =
      session.clientId === user.id || session.therapistId === user.id
    const isAdmin = user.role === 'admin'
    if (!isParticipant && !isAdmin) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Parse query parameters
    const url = new URL(request.url)
    const start = url.searchParams.get('start')
    const end = url.searchParams.get('end')
    const limit = url.searchParams.get('limit')

    const timeRange =
      start && end
        ? ([new Date(start), new Date(end)] as [Date, Date])
        : undefined

    const data = await fetchSessionEmotionData(sessionId, {
      timeRange,
      limit: limit ? parseInt(limit, 10) : undefined,
    })

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (_error: unknown) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch emotion data' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
})
