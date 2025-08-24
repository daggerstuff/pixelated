import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { isAuthenticated } from '@/lib/auth'
import { NotificationService } from '@/lib/services/notification/NotificationService'

const logger = createBuildSafeLogger('notifications-api')
const notificationService = new NotificationService()

export const GET = async ({ request }: APIContext) => {
  try {
    // Authenticate request
    const authResult = await isAuthenticated(request)
    if (!authResult?.['authenticated']) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          message: 'You must be authenticated to access this endpoint',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Get user's notification preferences
    const preferences = await notificationService.getPreferences(authResult?.['user']?.['id'])

    return new Response(JSON.stringify(preferences), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error: unknown) {
    logger.error('Error getting notification preferences:', error)

    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? String(error) : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }
}

import type { APIRoute } from 'astro'

export const PUT: APIRoute = async ({ request }) => {
  try {
    // Authenticate request
    const authResult = await isAuthenticated(request)
    if (!(typeof authResult === 'object' && authResult !== null && 'authenticated' in authResult && (authResult as { authenticated: boolean }).authenticated)) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          message: 'You must be authenticated to access this endpoint',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Parse request body
    const body = await request.json()
    const { preferences } = body

    if (!preferences) {
      return new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: 'preferences parameter is required',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Update user's notification preferences
    const service = notificationService as unknown as {
      updatePreferences?: (userId: string, preferences: unknown) => Promise<unknown>
    }
    const userId =
      typeof authResult === 'object' &&
      authResult !== null &&
      'user' in authResult &&
      (authResult as { user?: { id?: string } }).user &&
      typeof (authResult as { user: { id?: string } }).user.id === 'string'
        ? (authResult as { user: { id: string } }).user.id
        : undefined

    const result = await service.updatePreferences?.(
      userId,
      preferences,
    )

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error: unknown) {
    logger.error('Error updating notification preferences:', error)

    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? String(error) : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }
}
