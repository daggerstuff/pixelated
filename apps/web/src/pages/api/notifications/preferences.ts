import type { APIContext, APIRoute } from 'astro'

import { isAuthenticated, getCurrentUser } from '@/lib/auth'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

import { NotificationService } from '../../../lib/services/notification/NotificationService'

const logger = createBuildSafeLogger('notifications-api')
const notificationService = new NotificationService()

export const GET = async ({ request }: APIContext) => {
  try {
    // Authenticate request
    const user = await getCurrentUser(request)
    if (!user) {
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
    const service = notificationService as unknown as {
      getPreferences: (id: string) => Promise<unknown>
    }
    const preferences = await service.getPreferences(user.id)

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

export const PUT: APIRoute = async ({ request }) => {
  try {
    // Authenticate request
    const user = await getCurrentUser(request)
    if (!user) {
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
    const body = (await request.json()) as Record<string, unknown>
    const preferences = body['preferences']

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
      updatePreferences?: (
        userId: string,
        preferences: unknown,
      ) => Promise<unknown>
    }
    const result = await service.updatePreferences?.(user.id, preferences)

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
