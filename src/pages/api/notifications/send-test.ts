import { createBuildSafeLogger } from '../../../../lib/logging/build-safe-logger'
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

    // Check admin permission
    if (!authResult.user?.isAdmin) {
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: 'You do not have permission to send test notifications',
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Parse request body
    const body = await request.json()
    const { userId, notificationType, testData } = body

    if (!userId || !notificationType) {
      return new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: 'userId and notificationType parameters are required',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Queue test notification
    const notificationId = await notificationService.queueNotification({
      userId,
      templateId: notificationType,
      data: testData || {},
      priority: 'normal',
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Test notification queued successfully',
        notificationId,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error: unknown) {
    logger.error('Error sending test notification:', error)

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
