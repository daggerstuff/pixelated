import { AuditEventType, createAuditLog } from '../../../lib/audit'
import { rateLimitMiddleware } from '../../../lib/auth/middleware'
import { createBuildSafeLogger } from '../../../lib/logging/build-safe-logger'
import { logSecurityEvent, SecurityEventType } from '../../../lib/security'

const logger = createBuildSafeLogger('auth-verify')

export const GET = async ({
  request,
  clientAddress,
}: {
  request: Request
  clientAddress: string
}) => {
  let clientInfo = {
    ip: clientAddress || 'unknown',
    userAgent: request.headers.get('user-agent') ?? 'unknown',
    deviceId: request.headers.get('x-device-id') ?? 'unknown',
  }
  try {
    const url = new URL(request.url)
    const token = url.searchParams.get('token')
    const type = url.searchParams.get('type')

    if (!token || !type) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Missing token or type parameter',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Apply rate limiting for verification to prevent enumeration/attacks
    const rateLimitResult = await rateLimitMiddleware(
      request,
      'verify',
      5, // 5 attempts per hour (strict)
      60,
    )

    if (!rateLimitResult.success) {
      return rateLimitResult.response!
    }

    logger.info('Verification attempt', {
      type,
      token: token.substring(0, 8) + '...',
    })

    // Verify token against database and validate against expected type
    // Pattern: check token hash, validate type, return user or error
    const { getPool } = await import('../../../lib/db')
    const pool = getPool()

    const [rows] = await pool.query<{
      id: string
      email: string
      type: string
      is_valid: boolean
    }>(
      "SELECT id, email, type, is_valid FROM verification_tokens WHERE token_hash = $1 AND created_at > NOW() - INTERVAL '24 hours'",
      [token],
    )

    if (!rows?.is_valid || rows.type !== type) {
      logger.warn('Verification invalid', {
        tokenPrefix: token.substring(0, 8),
        type,
      })
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Invalid or expired verification token',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Mark token as used
    await pool.query(
      'UPDATE verification_tokens SET is_valid = FALSE WHERE id = $1',
      [rows.id],
    )

    const result = {
      data: { user: { id: rows.id, email: rows.email } },
      error: null,
    }

    if (result.error) {
      logger.error('Verification failed', { error: result.error })

      logSecurityEvent(SecurityEventType.AUTHENTICATION_FAILED, null, {
        action: 'verify_token',
        type,
        error: result.error,
        clientInfo,
      })

      return new Response(
        JSON.stringify({
          success: false,
          message: 'Verification failed',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Log successful verification
    if (result.data.user) {
      const user = result.data.user as Record<string, unknown>

      logSecurityEvent(SecurityEventType.AUTHENTICATION_SUCCESS, user.id, {
        action: 'user_verified',
        type,
        clientInfo,
      })

      await createAuditLog(
        AuditEventType.SECURITY,
        'user_verified',
        user.id,
        'auth',
        { type },
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Verification successful',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error: any) {
    logger.error('Verification error:', error)

    logSecurityEvent(SecurityEventType.AUTHENTICATION_FAILED, null, {
      action: 'verify_token_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      clientInfo,
    })
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Internal server error',
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
