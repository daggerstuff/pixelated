/**
 * Auth0 OAuth Callback Handler
 * Handles the callback from Auth0 after social authentication
 */

import { AuditEventType, createAuditLog } from '@/lib/audit'
import mongodb from '@/config/mongodb.config'
import { auth0SocialAuth } from '@/lib/auth/auth0-social-auth-service'
import { auth0UserService } from '@/services/auth0.service'

export const prerender = false

export const GET = async ({
  url,
  cookies,
  redirect,
}: {
  url: URL
  cookies: {
    set: (
      name: string,
      value: string,
      options?: Record<string, unknown>,
    ) => void
  }
  redirect: (path: string) => Response
}) => {
  const authCode = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')
  const errorDescription = url.searchParams.get('error_description')

  // Handle OAuth errors
  if (error) {
    console.error('Auth0 OAuth error:', error, errorDescription)
    return new Response(`Authentication failed: ${error} - ${errorDescription}`, { status: 400 })
  }

  if (!authCode) {
    return new Response('No authorization code provided', { status: 400 })
  }

  try {
    // Determine redirect URI based on environment
    const redirectUri = import.meta.env.DEV
      ? 'http://localhost:4321/api/auth/auth0-callback'
      : `${import.meta.env.SITE}/api/auth/auth0-callback`

    // Complete authentication flow with Auth0
    const { user: socialUser, tokens } = await auth0SocialAuth.authenticate(authCode, redirectUri)

    // Check if user already exists in our system
    let existingUser = await auth0UserService.findUserByEmail(socialUser.email)

    if (!existingUser) {
      // Create new user in Auth0
      existingUser = await auth0UserService.createUser(
        socialUser.email,
        // Generate a random password for social users since they'll use OAuth
        Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8),
        'user' // Default role
      )

      // Update user profile with social information
      if (existingUser) {
        await auth0UserService.updateUser(existingUser.id, {
          name: socialUser.name,
          picture: socialUser.picture,
          email_verified: socialUser.emailVerified,
          user_metadata: {
            provider: socialUser.provider,
            given_name: socialUser.givenName,
            family_name: socialUser.familyName,
            created_via_social: true
          }
        })
      }
    }

    // Set cookies for session management
    cookies.set('auth-token', tokens.accessToken, {
      path: '/',
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    })

    // Set refresh token cookie if available
    if (tokens.refreshToken) {
      cookies.set('refresh-token', tokens.refreshToken, {
        path: '/',
        httpOnly: true,
        secure: import.meta.env.PROD,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30 days
      })
    }

    // Check if user has a profile, create one if needed
    if (existingUser) {
      const db = await mongodb.connect()
      const profilesCollection = db.collection('profiles')

      const existingProfile = await profilesCollection.findOne({
        userId: existingUser.id,
      })

      if (!existingProfile) {
        // Create a profile for the user
        await profilesCollection.insertOne({
          userId: existingUser.id,
          fullName: socialUser.name || `${socialUser.givenName || ''} ${socialUser.familyName || ''}`.trim(),
          avatarUrl: socialUser.picture || null,
          role: existingUser.role,
          provider: socialUser.provider,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      } else {
        // Update existing profile with social info
        await profilesCollection.updateOne(
          { userId: existingUser.id },
          {
            $set: {
              fullName: socialUser.name || `${socialUser.givenName || ''} ${socialUser.familyName || ''}`.trim(),
              avatarUrl: socialUser.picture || existingProfile.avatarUrl,
              provider: socialUser.provider,
              updatedAt: new Date(),
            }
          }
        )
      }

      // Log the sign in for audit/compliance
      await createAuditLog(
        AuditEventType.LOGIN,
        'auth.signin.social',
        existingUser.id,
        'auth',
        {
          email: socialUser.email,
          provider: socialUser.provider,
          name: socialUser.name,
        },
      )
    }

    // Redirect to dashboard or original destination
    const destination = state ? decodeURIComponent(state) : '/dashboard'
    return redirect(destination.startsWith('/') ? destination : '/dashboard')
  } catch (error: unknown) {
    console.error('Auth0 callback error:', error)
    return new Response(
      `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { status: 500 }
    )
  }
}