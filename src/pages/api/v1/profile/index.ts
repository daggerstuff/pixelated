// API route implementation for user profile endpoints
import { protectRoute } from '../../../../lib/auth/serverAuth'
import { supabase } from '../../../../lib/supabase'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import type { AuthAPIContext } from '../../../../lib/auth/apiRouteTypes'

export const prerender = false

// Initialize logger with correct object format
const logger = createBuildSafeLogger('profile-api')

// GET endpoint for profile data
export const GET = protectRoute({
  validateIPMatch: true,
  validateUserAgent: true,
})(async ({ locals }: AuthAPIContext) => {
  try {
    const { user } = locals

    // Get user profile from database
    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      logger.error(`Error fetching profile for user ${user.id}:`, { error })
      return new Response(
        JSON.stringify({
          error: 'Failed to retrieve profile data',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Return sanitized profile data
    return new Response(
      JSON.stringify({
        profile: {
          id: profileData.id,
          fullName: profileData.full_name,
          avatarUrl: profileData.avatar_url,
          email: user.email,
          role: user.role,
          lastLogin: profileData.last_login,
          createdAt: profileData.created_at,
          updatedAt: profileData.updated_at,
          preferences: profileData.preferences || {},
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
})(async ({ request, locals }: AuthAPIContext) => {
  try {
    const { user } = locals
    const data = await request.json()

    // Validate input data
    const { fullName, avatarUrl, preferences } = data
    const updates: Record<string, unknown> = {}

    // Only include fields that were provided
    if (fullName !== undefined) {
      updates.full_name = fullName
    }
    if (avatarUrl !== undefined) {
      updates.avatar_url = avatarUrl
    }
    if (preferences !== undefined) {
      updates.preferences = preferences
    }

    // Update profile in database
    const { data: profileData, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      logger.error(`Error updating profile for user ${user.id}:`, { error })
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
          id: profileData.id,
          fullName: profileData.full_name,
          avatarUrl: profileData.avatar_url,
          email: user.email,
          role: user.role,
          lastLogin: profileData.last_login,
          createdAt: profileData.created_at,
          updatedAt: profileData.updated_at,
          preferences: profileData.preferences || {},
        },
        message: 'Profile updated successfully',
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
