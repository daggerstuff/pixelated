export const prerender = false
import type { APIContext } from 'astro'
import { auth0UserService } from '@/services/auth0.service'
import { verifyAuthToken, getSessionFromRequest } from '@/utils/auth'

/**
 * User profile endpoint using Auth0
 * GET /api/auth/profile - Get current user profile
 * PUT /api/auth/profile - Update user profile
 */
export const GET = async ({ request }: APIContext) => {
  try {
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
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

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
  } catch (error: unknown) {
    console.error('Get profile error:', error)
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

export const PUT = async ({ request }: APIContext) => {
  try {
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
