export const prerender = false
import { mongoAuthService } from '@/services/mongoAuth.service'
import { verifyAuthToken } from '@/utils/auth'

/**
 * User profile endpoint
 * GET /api/auth/profile - Get current user profile
 * PUT /api/auth/profile - Update user profile
 */
export const GET = async ({ request }) => {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const { userId } = await verifyAuthToken()
    const user = await mongoAuthService.getUserById(userId)

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        user: {
          id: user._id?.toString() || user.id,
          email: user.email,
          role: user.role,
          profile: user.profile,
          emailVerified: user.emailVerified,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
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

export const PUT = async ({ request }) => {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const { userId } = await verifyAuthToken()
    const updates = await request.json()

    // Only allow updating profile fields
    const allowedFields = ['profile']
    const safeUpdates = Object.keys(updates)
      .filter((key) => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key]
        return obj
      }, {} as any)

    if (Object.keys(safeUpdates).length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid fields to update' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const updatedUser = await mongoAuthService.updateUser(userId, safeUpdates)

    if (!updatedUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: updatedUser._id?.toString() || updatedUser.id,
          email: updatedUser.email,
          role: updatedUser.role,
          profile: updatedUser.profile,
          emailVerified: updatedUser.emailVerified,
          updatedAt: updatedUser.updatedAt,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Update profile error:', error)
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : 'Failed to update profile',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
