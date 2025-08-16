import { createBuildSafeLogger } from '../../../../lib/logging/build-safe-logger'
import { isAuthenticated } from '@/lib/auth'
import { NotificationService } from '@/lib/services/notification/NotificationService'

const logger = createBuildSafeLogger('notifications-api')
const notificationService = new NotificationService()

export const GET = async ({ request }: APIContext) => {
  try {
    // Authenticate request
    const authResult = await isAuthenticated(request)
    if (!authResult?.authenticated) {
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
    const preferences = await notificationService.getPreferences(authResult.user?.id)

    return new Response(JSON.stringify(preferences), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    logger.error('Error getting notification preferences:', error)

    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
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

export const PUT = async ({ request }: APIContext) => {
  try {
    // Authenticate request
    const authResult = await isAuthenticated(request)
    if (!authResult?.authenticated) {
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
    const result = await notificationService.updatePreferences(
      authResult.user?.id,
      preferences,
    )

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    logger.error('Error updating notification preferences:', error)

    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
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
