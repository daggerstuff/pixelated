import { protectRoute } from '@/lib/auth/serverAuth'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import type { AuthAPIContext } from '@lib/auth/apiRouteTypes.ts'

const logger = createBuildSafeLogger('security-admin')

// Mock security alert function to replace Supabase dependency
async function testSecurityAlert(
  alertType: string,
  userId: string,
  metadata?: Record<string, unknown>,
) {
  logger.info('Testing security alert', { alertType, userId, metadata })
  // TODO: Replace with actual security alert implementation
  return { success: true, alertId: `test-${Date.now()}` }
}

export const POST = protectRoute({
  requiredRole: 'admin',
})(async ({ request, locals }: AuthAPIContext) => {
  try {
    const { user } = locals
    // Get request body
    const body = await request.json()
    const alertType = body.alertType || 'suspicious_login'

    // Validate alert type
    if (
      !['suspicious_login', 'password_reset', 'account_locked'].includes(
        alertType,
      )
    ) {
      return new Response(
        JSON.stringify({
          error: 'Invalid alert type',
          message:
            'Alert type must be one of: suspicious_login, password_reset, account_locked',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Test the security alert
    const result = await testSecurityAlert(alertType, user.id, {
      testMode: true,
      triggeredBy: user.id,
      timestamp: new Date().toISOString(),
    })

    logger.info('Security alert test completed', {
      alertType,
      userId: user.id,
      result,
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: `${alertType} alert test completed successfully`,
        alertId: result.alertId,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error) {
    logger.error('Error testing security alert:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to test security alert',
        message: 'An error occurred while testing the security alert',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }
})
