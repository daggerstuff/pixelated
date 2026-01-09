// API route implementation for user profile endpoints
import { protectRoute } from '@/lib/auth/serverAuth'
import type { AuthUser } from '@/lib/auth/types'
import { auth0UserService } from '@/services/auth0.service'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

export const prerender = false

// Initialize services
const logger = createBuildSafeLogger('profile-api')

// GET endpoint for profile data
export const GET = protectRoute({
  validateIPMatch: true,
  validateUserAgent: true,
})(async ({
  locals,
}: {
  params: Record<string, string | undefined>
  request: Request
  locals: { user: AuthUser }
}) => {
  try {
    const { user } = locals

    // Get user profile from Auth0
    const userProfile = await auth0UserService.getUserById(user.id)

    if (!userProfile) {
      logger.error(`Profile not found for user ${user.id}`)
      return new Response(
        JSON.stringify({
          error: 'Profile not found',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Return sanitized profile data
    return new Response(
      JSON.stringify({
        profile: {
          id: userProfile.id,
          fullName: userProfile.fullName || userProfile.email.split('@')[0],
          avatarUrl: userProfile.avatarUrl || null,
          email: userProfile.email,
          role: userProfile.role,
          lastLogin: userProfile.lastLogin,
          createdAt: userProfile.createdAt,
          userMetadata: userProfile.userMetadata || {},
          appMetadata: userProfile.appMetadata || {},
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error: unknown) {
    logger.error('Unexpected error in profile API:', { error })
    return new Response(
      JSON.stringify({
        error: 'An unexpected error occurred',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
})

// PUT endpoint to update profile data
export const PUT = protectRoute({
  validateIPMatch: true,
  validateUserAgent: true,
})(async ({
  request,
  locals,
}: {
  params: Record<string, string | undefined>
  request: Request
  locals: { user: AuthUser }
}) => {
  try {
    const { user } = locals
    const data = await request.json()

    // Validate input data
    const { fullName, avatarUrl, userMetadata } = data
    const updates: Record<string, unknown> = {}

    if (fullName !== undefined) {
      updates['name'] = fullName
    }
    if (avatarUrl !== undefined) {
      updates['picture'] = avatarUrl
    }
    if (userMetadata !== undefined) {
      updates['user_metadata'] = userMetadata
    }

    // Update profile in Auth0
    const updatedUser = await auth0UserService.updateUser(user.id, updates)

    if (!updatedUser) {
      logger.error(`Error updating profile for user ${user.id}`)
      return new Response(
        JSON.stringify({
          error: 'Failed to update profile',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Return updated profile data
    return new Response(
      JSON.stringify({
        profile: {
          id: updatedUser.id,
          fullName: updatedUser.fullName || updatedUser.email.split('@')[0],
          avatarUrl: updatedUser.avatarUrl || null,
          email: updatedUser.email,
          role: updatedUser.role,
          lastLogin: updatedUser.lastLogin,
          createdAt: updatedUser.createdAt,
          userMetadata: updatedUser.userMetadata || {},
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error: unknown) {
    logger.error('Unexpected error updating profile:', { error })
    return new Response(
      JSON.stringify({
        error: 'An unexpected error occurred',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
})
