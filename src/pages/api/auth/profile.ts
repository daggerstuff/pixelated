export const prerender = false
import { auth0UserService } from '../../../services/auth0.service'
import { verifyAuthToken, getSessionFromRequest } from '../../../utils/auth'
import { logSecurityEvent, SecurityEventType } from '../../../lib/security'
import { detectAndRedactPHI } from '../../../lib/security/phiDetection'
import { csrfProtection, rateLimitMiddleware } from '../../../lib/auth/middleware'
import { AuditEventType, createAuditLog } from '../../../lib/audit'
import { redactPotentialPhi } from '../../../lib/utils/phi-sanitizer'

/**
 * User profile endpoint using Auth0
 * GET /api/auth/profile - Get current user profile
 * PUT /api/auth/profile - Update user profile
 */
export const GET = async ({ request, clientAddress }: { request: Request; clientAddress: string }) => {
  try {
    // Extract client info for logging
    const clientInfo = {
      ip: clientAddress || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      deviceId: request.headers.get('x-device-id') || 'unknown',
    }

    // Rate limit profile reads (e.g. 60 per minute)
    const rateLimitResult = await rateLimitMiddleware(request, 'profile_read', 60, 60)
    if (!rateLimitResult.success) return rateLimitResult.response!

    // Try to get session first (cookie or header)
    const session = await getSessionFromRequest(request)
    let userId: string | null = null

    if (session && session.user) {
      userId = session.user.id || (session.user as any)._id?.toString() || null
    } else {
      const authHeader = request.headers.get('Authorization')
      if (!authHeader) {
        // Fallback to cookie
        const cookieToken = request.headers.get('cookie')
          ?.split(';')
          .find(c => c.trim().startsWith('auth-token='))
          ?.split('=')[1]

        if (cookieToken) {
          const v = await verifyAuthToken(cookieToken)
          userId = v.userId
        }
      } else {
        const v = await verifyAuthToken(authHeader)
        userId = v.userId
      }
    }

    if (!userId) {
      await logSecurityEvent(SecurityEventType.AUTHORIZATION_FAILED, null, {
        action: 'get_profile',
        reason: 'No user ID found in session or token',
        clientInfo,
      })

      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const user = await auth0UserService.getUserById(userId)

    if (!user) {
      await logSecurityEvent(SecurityEventType.AUTHORIZATION_FAILED, userId, {
        action: 'get_profile',
        reason: 'User not found in database',
        clientInfo,
      })

      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Log successful profile access (optional, maybe too noisy?)
    // keeping it minimal for GET

    return new Response(
      JSON.stringify({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          fullName: user.fullName,
          avatarUrl: user.avatarUrl,
          emailVerified: user.emailVerified,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
          userMetadata: user.userMetadata || {},
          appMetadata: user.appMetadata || {},
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error: any) {
    console.error('Get profile error:', error)

    await logSecurityEvent(SecurityEventType.AUTHENTICATION_FAILED, null, {
      action: 'get_profile',
      error: detectAndRedactPHI(error.message),
      clientInfo
    })

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to get profile',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

export const PUT = async ({ request, clientAddress }: { request: Request; clientAddress: string }) => {
  let clientInfo;
  try {
    clientInfo = {
      ip: clientAddress || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      deviceId: request.headers.get('x-device-id') || 'unknown',
    }

    // Apply CSRF protection for updates
    const csrfResult = await csrfProtection(request as any)
    if (!csrfResult.success) {
      return csrfResult.response!
    }

    // Rate limit profile updates (strict: 5 per minute)
    const rateLimitResult = await rateLimitMiddleware(request, 'profile_update', 5, 60)
    if (!rateLimitResult.success) return rateLimitResult.response!

    const session = await getSessionFromRequest(request)
    let userId: string | null = null

    if (session && session.user) {
      userId = session.user.id || (session.user as any)._id?.toString() || null
    } else {
      const authHeader = request.headers.get('Authorization')
      if (authHeader) {
        const v = await verifyAuthToken(authHeader)
        userId = v.userId
      }
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const updates = await request.json()

    // Validate and map updates for Auth0
    const auth0Updates: Record<string, any> = {}
    if (updates.fullName) auth0Updates.name = updates.fullName
    if (updates.avatarUrl) auth0Updates.picture = updates.avatarUrl
    if (updates.userMetadata) auth0Updates.user_metadata = updates.userMetadata

    // Legacy support for 'preferences'
    if (updates.preferences) {
      auth0Updates.user_metadata = {
        ...auth0Updates.user_metadata,
        preferences: updates.preferences,
      }
    }

    if (Object.keys(auth0Updates).length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid fields to update' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const updatedUser = await auth0UserService.updateUser(userId, auth0Updates)

    if (!updatedUser) {
      return new Response(JSON.stringify({ error: 'Failed to update user' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Log security event for profile update
    await logSecurityEvent(SecurityEventType.AUTHENTICATION_FAILED, userId, {
      updates: Object.keys(auth0Updates),
      clientInfo
    })

    // Create Audit Log
    await createAuditLog(
      AuditEventType.USER_MODIFIED,
      'profile.update',
      userId,
      'user',
      { updates: Object.keys(auth0Updates) }
    )

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          role: updatedUser.role,
          fullName: updatedUser.fullName,
          avatarUrl: updatedUser.avatarUrl,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error: unknown) {
    console.error('Update profile error:', error)

    await logSecurityEvent(SecurityEventType.AUTHORIZATION_FAILED, null, {
      action: 'update_profile',
      error: detectAndRedactPHI(error instanceof Error ? error.message : String(error)),
      clientInfo
    })

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to update profile',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
