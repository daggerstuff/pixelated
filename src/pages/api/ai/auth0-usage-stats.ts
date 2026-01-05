import type { APIRoute } from 'astro'
import { getAIUsageStats } from '../../../lib/ai/analytics'
import { handleApiError } from '../../../lib/ai/error-handling'
import { createAuditLog } from '../../../lib/audit'
import { getUserById } from '@/services/auth0.service'
import { validateToken } from '@/lib/auth/auth0-jwt-service'
import { extractTokenFromRequest } from '@/lib/auth/auth0-middleware'

/**
 * API route for AI usage statistics
 */
export const GET: APIRoute = async ({ request, url }) => {
  let userId: string | null = null

  try {
    if (!url) {
      return new Response(JSON.stringify({ error: 'Missing url' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // Extract token from request
    const token = extractTokenFromRequest(request as unknown as Request)

    if (!token) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Validate token
    const validation = await validateToken(token, 'access')

    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Get user from Auth0
    const user = await getUserById(validation.userId!)

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    userId = user.id

    // Parse query parameters
    const timeframe = url.searchParams.get('timeframe') || '7d'
    const model = url.searchParams.get('model') || 'all'

    // Get usage stats
    const stats = await getAIUsageStats(timeframe, model)

    // Create audit log
    await createAuditLog(
      'ai_usage_stats_access',
      'ai.usage.stats.access',
      userId,
      'ai-usage-stats',
      { timeframe, model }
    )

    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error: any) {
    await handleApiError(error, 'ai.usage.stats', userId || 'anonymous')
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }
}