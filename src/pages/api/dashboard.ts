export const prerender = false

import type { AuthenticatedRequest } from '@/lib/auth/auth0-middleware'
import { createBuildSafeLogger } from '../../lib/logging/build-safe-logger'

const logger = createBuildSafeLogger('default')

export const GET = async ({ request }: { request: AuthenticatedRequest }) => {
  try {
    // Authentication is handled by middleware, so we can safely access user data
    // The user object is attached to the request by the middleware
    const user = request.user

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Using mock data for beta launch - replace with database integration post-beta
    const mockData = {
      stats: {
        sessionsThisWeek: 3,
        totalPracticeHours: 12.5,
        progressScore: 85,
      },
      recentSessions: [
        {
          id: 'session-1',
          type: 'chat',
          timestamp: new Date(),
          title: 'Mental Health Chat',
        },
        {
          id: 'session-2',
          type: 'simulator',
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
          title: 'Practice Session: Anxiety Management',
        },
      ],
      securityLevel: 'hipaa',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      }
    }

    return new Response(JSON.stringify(mockData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    logger.error('Dashboard API error:', {
      error: error instanceof Error ? String(error) : String(error),
    })
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
