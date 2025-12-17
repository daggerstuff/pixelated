import type { User } from '@/types/mongodb.types'
import type { AuthUser, Provider, UserRole } from '../types/auth'
import { createSecureToken, verifySecureToken } from '../lib/security'
import { mongoAuthService } from '../services/mongoAuth.service'

/**
 * Helper function to make API requests
 */
async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const url = `/api/auth/${endpoint}`

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `HTTP ${response.status}`)
  }

  return response.json()
}

/**
 * Sign in with email and password
 * @param email User email
 * @param password User password
 * @returns User session or error
 */
export async function signInWithEmail(email: string, password: string) {
  try {
    const response = await apiRequest('signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })

    return {
      user: mapToAuthUser(response.user),
      session: { access_token: response.token, refresh_token: response.token },
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
export async function signInWithOAuth(
  _provider: Provider,
  _redirectTo?: string,
): Promise<void> {
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
  metadata?: { fullName?: string },
) {
  try {
    // First create the user
    await apiRequest('signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, role: 'user', ...metadata }),
    })

    // Then sign them in
    const response = await apiRequest('signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })

    return {
      user: mapToAuthUser(response.user),
      session: { access_token: response.token, refresh_token: response.token },
    }
  } catch (error: unknown) {
    console.error('Error signing up:', error)
    throw error
  }
}

/**
 * Sign out the current user
 */
export async function signOut(token?: string): Promise<boolean> {
  try {
    // If auth is disabled, just return success
    if (
      typeof window !== 'undefined' &&
      window.location.hostname === 'localhost' &&
      (import.meta.env.DISABLE_AUTH === 'true' ||
        import.meta.env.PUBLIC_DISABLE_AUTH === 'true')
    ) {
      return true
    }

    const authToken =
      token ||
      (typeof window !== 'undefined'
        ? localStorage.getItem('auth_token')
        : null)

    if (!authToken) {
      return true // Already signed out
    }

    await apiRequest('signout', {
      method: 'POST',
      headers: {
        Authorization: authToken.startsWith('Bearer ')
          ? authToken
          : `Bearer ${authToken}`,
      },
    })
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
export async function getCurrentUser(
  authHeader?: string,
): Promise<AuthUser | null> {
  try {
    // If auth is disabled, return mock user
    if (
      typeof window !== 'undefined' &&
      window.location.hostname === 'localhost' &&
      (import.meta.env.DISABLE_AUTH === 'true' ||
        import.meta.env.PUBLIC_DISABLE_AUTH === 'true')
    ) {
      return {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        image: '',
        role: 'user' as UserRole,
        fullName: 'Test User',
        roles: ['user' as UserRole],
        emailVerified: true,
        createdAt: new Date().toISOString(),
        lastSignIn: new Date().toISOString(),
        avatarUrl: '',
        metadata: {},
      }
    }

    // Get auth header from localStorage if not provided
    const token =
      authHeader ||
      (typeof window !== 'undefined'
        ? localStorage.getItem('auth_token')
        : null)

    if (!token) {
      return null
    }

    const response = await apiRequest('profile', {
      method: 'GET',
      headers: {
        Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      },
    })

    return mapToAuthUser(response.user)
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
export async function resetPassword(
  email: string,
  redirectTo?: string,
): Promise<void> {
  try {
    await apiRequest('reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, redirectTo }),
    })
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
  currentPassword: string,
  newPassword: string,
) {
  try {
    // Note: This API might need to be updated to handle userId and currentPassword
    await apiRequest('update-password', {
      method: 'POST',
      body: JSON.stringify({ userId, currentPassword, password: newPassword }),
    })
    return true
  } catch (error: unknown) {
    console.error('Error updating password:', error)
    throw error
  }
}

/**
 * Update password using reset token
 * @param email User email
 * @param token Reset token
 * @param newPassword New password
 */
export async function updatePasswordWithToken(
  email: string,
  token: string,
  newPassword: string,
) {
  try {
    if (!mongoAuthService) {
      throw new Error('MongoDB authentication service not available')
    }

    // Verify the reset token
    const isValid = await mongoAuthService.verifyPasswordResetToken(email, token)
    if (!isValid) {
      throw new Error('Invalid or expired reset token')
    }

    // Update the password
    await mongoAuthService.changePasswordByEmail(email, newPassword)

    // Invalidate the reset token
    await mongoAuthService.invalidatePasswordResetToken(email)

    return true
  } catch (error: unknown) {
    console.error('Error updating password with token:', error)
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
export function verifyAuthToken(
  token: string,
  purpose: string,
): Record<string, unknown> | null {
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
  _userId: string,
  profile: {
    fullName?: string
    avatarUrl?: string
    metadata?: Record<string, unknown>
  },
) {
  try {
    await apiRequest('profile', {
      method: 'PUT',
      body: JSON.stringify(profile),
      headers: {
        Authorization: `Bearer ${localStorage.getItem('auth_token')}`, // Assuming token is stored
      },
    })

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
// export { MongoAuthService as AuthService }
