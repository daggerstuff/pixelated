import type { User } from '@/types/mongodb.types'
import type { AuthUser, Provider } from '../types/auth'
import { createSecureToken, verifySecureToken } from '../lib/security'
import { MongoAuthService } from './mongoAuth.service'

const authService = new MongoAuthService()

/**
 * Sign in with email and password
 * @param email User email
 * @param password User password
 * @returns User session or error
 */
export async function signInWithEmail(email: string, password: string) {
  try {
    const { user, token } = await authService.signIn(email, password)

    return {
      user: mapToAuthUser(user),
      session: { access_token: token, refresh_token: token },
    }
  } catch (error: unknown) {
    console.error('Error signing in:', error)
    throw error
  }
}

/**
 * Sign in with OAuth provider
 * @param provider OAuth provider (google, github)
 * @param redirectTo URL to redirect after authentication
 */
export async function signInWithOAuth(_provider: Provider, _redirectTo?: string): Promise<void> {
  try {
    // This would need to be implemented based on your OAuth setup
    throw new Error(
      'OAuth sign in not implemented yet. Please implement based on your OAuth provider.',
    )
  } catch (error: unknown) {
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
  _metadata?: { fullName?: string },
) {
  try {
    const _user = await authService.createUser(email, password)
    const { user: signedInUser, token } = await authService.signIn(
      email,
      password,
    )

    return {
      user: mapToAuthUser(signedInUser),
      session: { access_token: token, refresh_token: token },
    }
  } catch (error: unknown) {
    console.error('Error signing up:', error)
    throw error
  }
}

/**
 * Sign out the current user
 */
export async function signOut(token: string): Promise<boolean> {
  try {
    await authService.signOut(token)
    return true
  } catch (error: unknown) {
    console.error('Error signing out:', error)
    throw error
  }
}

/**
 * Get the current user by token
 * @returns Current authenticated user or null
 */
export async function getCurrentUser(authHeader: string): Promise<AuthUser | null> {
  try {
    const authInfo = await authService.verifyAuthToken(authHeader)
    const user = await authService.getUserById(authInfo['userId'])

    if (!user) {
      return null
    }

    return mapToAuthUser(user)
  } catch (error: unknown) {
    console.error('Error getting current user:', error)
    return null
  }
}

/**
 * Request password reset for a user
 * @param email User email
 * @param redirectTo URL to redirect after reset
 */
export async function resetPassword(_email: string, _redirectTo?: string): Promise<void> {
  try {
    // For MongoDB implementation, you'd need to implement email sending
    throw new Error(
      'Password reset not implemented yet. Please implement email sending logic.',
    )
  } catch (error: unknown) {
    console.error('Error resetting password:', error)
    throw error
  }
}

/**
 * Update user password
 * @param userId User ID
 * @param currentPassword Current password
 * @param newPassword New password
 */
export async function updatePassword(
  userId: string,
  _currentPassword: string,
  newPassword: string,
) {
  try {
    // Only newPassword is required for Mongo
    await authService.changePassword(userId, newPassword)
    return true
  } catch (error: unknown) {
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
export function verifyAuthToken(token: string, purpose: string): Record<string, unknown> | null {
  const result = verifySecureToken(token)
  if (!result || result['purpose'] !== purpose) {
    return null
  }
  return result
}

/**
 * Map MongoDB user to AuthUser
 * @param user MongoDB user
 * @returns AuthUser object
 */
export function mapToAuthUser(user: User): AuthUser | null {
  if (!user) {
    return null
  }

  return {
    id: user['_id']?.toString() || '',
    email: user['email'],
    name: user['metadata']?.['fullName'] || user['fullName'] || '',
    image: user['metadata']?.['avatarUrl'] || user['avatarUrl'] || '',
    role: user['role'] as UserRole,
    fullName: user['metadata']?.['fullName'] || user['fullName'] || '',
    roles: [user['role'] as UserRole],
    emailVerified: user['emailVerified'] || false,
    createdAt: user['createdAt']?.toISOString() || new Date().toISOString(),
    lastSignIn: user['lastLogin']?.toISOString() || null,
    avatarUrl: user['metadata']?.['avatarUrl'] || user['avatarUrl'] || '',
    metadata: user['metadata'] || {},
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
    const updatedUser = await authService.updateUser(userId, {
      fullName: profile.fullName,
      avatarUrl: profile.avatarUrl,
      ...(profile.metadata ? { metadata: profile.metadata } : {}),
    })

    if (!updatedUser) {
      throw new Error('Failed to update profile')
    }

    return { success: true }
  } catch (error: unknown) {
    console.error('Error updating profile:', error)
    return { error }
  }
}

/**
 * Verify a one-time password (placeholder for MongoDB implementation)
 * @param params OTP verification parameters
 * @returns Auth response
 */
export async function verifyOtp(_params: {
  token: string
  email?: string
  phone?: string
  type?: 'email' | 'sms' | 'recovery' | 'email_change'
}) {
  try {
    // This would need to be implemented based on your OTP system
    throw new Error(
      'OTP verification not implemented yet. Please implement based on your OTP provider.',
    )
  } catch (error: unknown) {
    console.error('Error verifying OTP:', error)
    return { success: false, error }
  }
}

// Export the auth service class for direct use
export { MongoAuthService as AuthService }
