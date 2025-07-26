import type { User } from '@supabase/supabase-js'
import type { AuthUser, Provider } from '../types/auth'
import { createSecureToken, verifySecureToken } from '../lib/security'
import { supabase } from '../lib/supabase'

/**
 * Sign in with email and password
 * @param email User email
 * @param password User password
 * @returns User session or error
 */
export async function signInWithEmail(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      throw error
    }
    const user = data.user ? mapToAuthUser(data.user) : null
    return { user, session: data.session }
  } catch (error) {
    console.error('Error signing in:', error)
    throw error
  }
}

/**
 * Sign in with OAuth provider
 * @param provider OAuth provider (google, github)
 * @param redirectTo URL to redirect after authentication
 */
export async function signInWithOAuth(provider: Provider, redirectTo?: string) {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: redirectTo ? { redirectTo } : {},
    })

    if (error) {
      throw error
    }
    return data
  } catch (error) {
    console.error('Error signing in with OAuth:', error)
    throw error
  }
}

/**
 * Sign up with email and password
 * @param email User email
 * @param password User password
 * @param metadata Additional user metadata
 * @returns User session or error
 */
export async function signUp(
  email: string,
  password: string,
  metadata?: { fullName?: string },
) {
  try {
    const signUpData = metadata
      ? { email, password, options: { data: metadata } }
      : { email, password }

    const { data, error } = await supabase.auth.signUp(signUpData)

    if (error) {
      throw error
    }
    const user = data.user ? mapToAuthUser(data.user) : null
    return { user, session: data.session }
  } catch (error) {
    console.error('Error signing up:', error)
    throw error
  }
}

/**
 * Sign out the current user
 */
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) {
      throw error
    }
    return true
  } catch (error) {
    console.error('Error signing out:', error)
    throw error
  }
}

/**
 * Get the current user
 * @returns Current authenticated user or null
 */
export async function getCurrentUser() {
  try {
    const { data } = await supabase.auth.getUser()
    if (!data.user) {
      return null
    }

    return mapToAuthUser(data.user)
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}

/**
 * Request password reset for a user
 * @param email User email
 * @param redirectTo URL to redirect after reset
 */
export async function resetPassword(email: string, redirectTo?: string) {
  try {
    // Set the redirectTo to our auth-callback page which will handle the token securely
    const authCallbackUrl = redirectTo
      ? `${new URL('/auth-callback', new URL(redirectTo).origin).toString()}`
      : `${new URL('/auth-callback', new URL(window.location.origin).origin).toString()}`

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: authCallbackUrl,
    })

    if (error) {
      throw error
    }
    return true
  } catch (error) {
    console.error('Error resetting password:', error)
    throw error
  }
}

/**
 * Update user password
 * @param password New password
 */
export async function updatePassword(password: string) {
  try {
    const { error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      throw error
    }
    return true
  } catch (error) {
    console.error('Error updating password:', error)
    throw error
  }
}

/**
 * Create a secure authentication token for verification
 * @param userId User ID
 * @param purpose Token purpose (e.g., 'verify-email')
 * @param expiresIn Expiration time in seconds
 * @returns Secure token
 */
export function createAuthToken(
  userId: string,
  purpose: string,
  expiresIn = 3600,
) {
  return createSecureToken({ userId, purpose }, expiresIn)
}

/**
 * Verify a secure authentication token
 * @param token Token to verify
 * @param purpose Expected token purpose
 * @returns Verified token payload or null
 */
export function verifyAuthToken(token: string, purpose: string) {
  const result = verifySecureToken(token)
  if (!result || result['purpose'] !== purpose) {
    return null
  }
  return result
}

/**
 * Map Supabase user to AuthUser
 * @param user Supabase user
 * @returns AuthUser object
 */
export function mapToAuthUser(user: User): AuthUser | null {
  if (!user) {
    return null
  }

  return {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.['fullName'] || '',
    image: user.user_metadata?.['avatarUrl'] || '',
    role: user.app_metadata?.['role'] || 'guest',
    fullName: user.user_metadata?.['fullName'] || '',
    roles: user.app_metadata?.['roles'] || [],
    emailVerified: !!user.email_confirmed_at,
    createdAt: user.created_at,
    lastSignIn: user.last_sign_in_at,
    avatarUrl: user.user_metadata?.['avatarUrl'] || '',
    metadata: user.user_metadata || {},
  }
}

/**
 * Update user profile
 * @param userId User ID
 * @param profile Profile data to update
 * @returns Result of the update operation
 */
export async function updateProfile(
  userId: string,
  profile: {
    fullName?: string
    avatarUrl?: string
    metadata?: Record<string, unknown>
  },
) {
  try {
    // Create update object
    const updates: {
      data: Record<string, unknown>
    } = {
      data: {},
    }

    // Add profile data to updates
    if (profile.fullName) {
      updates.data['fullName'] = profile.fullName
    }

    if (profile.avatarUrl) {
      updates.data['avatarUrl'] = profile.avatarUrl
    }

    if (profile.metadata && Object.keys(profile.metadata).length > 0) {
      updates.data = {
        ...updates.data,
        ...profile.metadata,
      }
    }

    // Update the user metadata
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: updates.data,
    })

    if (error) {
      throw error
    }

    return { success: true }
  } catch (error) {
    console.error('Error updating profile:', error)
    return { error }
  }
}

/**
 * Verify a one-time password
 * @param params OTP verification parameters
 * @returns Auth response
 */
export async function verifyOtp(params: {
  token: string
  email?: string
  phone?: string
  type?: 'email' | 'sms' | 'recovery' | 'email_change'
}) {
  try {
    // Create proper parameters based on OTP type
    if (params.type === 'sms') {
      // For SMS, we need phone and token
      if (!params.phone) {
        throw new Error('Phone is required for SMS verification')
      }

      const { data, error } = await supabase.auth.verifyOtp({
        phone: params.phone,
        token: params.token,
        type: 'sms',
      })

      if (error) {
        throw error
      }

      return {
        success: true,
        user: data?.user ? mapToAuthUser(data.user) : null,
        session: data?.session || null,
      }
    } else {
      // For email-based verification types
      if (!params.email) {
        throw new Error('Email is required for email verification')
      }

      const { data, error } = await supabase.auth.verifyOtp({
        email: params.email,
        token: params.token,
        type: params.type || 'recovery',
      })

      if (error) {
        throw error
      }

      return {
        success: true,
        user: data?.user ? mapToAuthUser(data.user) : null,
        session: data?.session || null,
      }
    }
  } catch (error) {
    console.error('Error verifying OTP:', error)
    return { success: false, error }
  }
}
