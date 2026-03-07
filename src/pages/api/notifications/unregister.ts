import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { isAuthenticated } from '@/lib/auth'
import { NotificationService } from '@/lib/services/notification/NotificationService'

const logger = createBuildSafeLogger('notifications-api')
const notificationService = new NotificationService()

export const POST = async ({ request }: APIContext) => {
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

    // Remove push subscription
    await notificationService.removePushSubscription(authResult.user?.id)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Push subscription unregistered successfully',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error: unknown) {
    logger.error('Error unregistering push subscription:', error)

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
