import { useCallback, useEffect, useState } from 'react'
import type { AuthRole } from '../config/auth.config.js'
import type { AuthUser, Provider, UserRole, AuthResult } from '../types/auth.js'
import {
  getCurrentUser,
  signInWithEmail,
  signUp as authSignUp,
  signInWithOAuth as authSignInWithOAuth,
  signOut as authSignOut,
  resetPassword as authResetPassword,
  verifyOtp as authVerifyOtp,
  updateProfile as authUpdateProfile,
} from '../services/auth.service.js'
import {
  type UseAuthReturn,
  type RoleMapping,
  type ProfileUpdateParams,
  type OtpVerificationParams,
  type AuthError,
  AuthErrorCode,
  createAuthError,
  isAuthError,
  isAuthUser,
  } from './auth-types'

// Map AuthRole to UserRole
const roleMap: RoleMapping = {
  admin: 'admin',
  staff: 'admin', // Map staff to admin UserRole
  therapist: 'therapist',
  user: 'client', // Map user to client UserRole
  guest: 'guest',
}

/**
 * Hook for managing authentication state and operations
 * @returns Authentication state and methods
 */
export function useAuth(): UseAuthReturn {
  // Strongly typed state
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<AuthError | null>(null)

  // Check if user has specific role(s) with proper type inference
  const hasRole = useCallback(
    (role: AuthRole | AuthRole[] | UserRole | UserRole[]): boolean => {
      if (!user?.roles?.length) {
        return false
      }

      const checkRole = (r: AuthRole | UserRole): boolean => {
        const mappedRole =
          (r as AuthRole) in roleMap ? roleMap[r as AuthRole] : (r as UserRole)
        return user.roles.includes(mappedRole)
      }

      return Array.isArray(role) ? role.some(checkRole) : checkRole(role)
    },
    [user],
  )

  // Load user on initial mount with proper error handling
  useEffect(() => {
    let mounted = true

    const loadUser = async (): Promise<void> => {
      try {
        setLoading(true)
        const currentUser = await getCurrentUser()

        if (!mounted) {
          return
        }

        if (isAuthUser(currentUser)) {
          setUser(currentUser)
        } else {
          throw createAuthError(
            'Invalid user data received',
            AuthErrorCode.INVALID_USER,
          )
        }
      } catch (err: unknown) {
        if (!mounted) {
          return
        }

        console.error('Error loading user:', err)
        setUser(null)
        setError(
          isAuthError(err)
            ? err
            : createAuthError(
                'Failed to load user',
                AuthErrorCode.NETWORK_ERROR,
              ),
        )
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadUser()
    return () => {
      mounted = false
    }
  }, [])

  // Sign in with proper type inference and error handling
  const signIn = async (
    email: string,
    password: string,
  ): Promise<AuthResult> => {
    try {
      setLoading(true)
      setError(null)

      const result = await signInWithEmail(email, password)

      if (!result || !result.user) {
        throw createAuthError(
          'Authentication failed',
          AuthErrorCode.AUTH_FAILED,
        )
      }

      setUser(result.user)
      return { success: true, user: result.user, session: result.session }
    } catch (err: unknown) {
      const authError = isAuthError(err)
        ? err
        : createAuthError(
            err instanceof Error
              ? (err as Error)?.message || String(err)
              : 'Authentication failed',
            AuthErrorCode.AUTH_FAILED,
          )

      setError(authError)
      return { success: false, error: authError.message }
    } finally {
      setLoading(false)
    }
  }

  // Sign up with proper type inference and error handling
  const signUp = async (
    email: string,
    password: string,
    fullName: string,
  ): Promise<AuthResult> => {
    try {
      setLoading(true)
      setError(null)

      const result = await authSignUp(email, password, { fullName })

      if (!result || !result.user) {
        throw createAuthError(
          'Registration failed',
          AuthErrorCode.SIGNUP_FAILED,
        )
      }

      setUser(result.user)
      return { success: true, user: result.user, session: result.session }
    } catch (err: unknown) {
      const authError = isAuthError(err)
        ? err
        : createAuthError(
            err instanceof Error
              ? (err as Error)?.message || String(err)
              : 'Registration failed',
            AuthErrorCode.SIGNUP_FAILED,
          )

      setError(authError)
      return { success: false, error: authError.message }
    } finally {
      setLoading(false)
    }
  }

  // Sign in with OAuth with proper error handling
  const signInWithOAuth = async (
    provider: Provider,
    redirectTo?: string,
  ): Promise<void> => {
    try {
      setLoading(true)
      setError(null)
      await authSignInWithOAuth(provider, redirectTo)
    } catch (err: unknown) {
      const authError = isAuthError(err)
        ? err
        : createAuthError(
            err instanceof Error
              ? (err as Error)?.message || String(err)
              : 'OAuth sign in failed',
            AuthErrorCode.OAUTH_FAILED,
          )
      setError(authError)
      throw authError
    } finally {
      setLoading(false)
    }
  }

  // Sign out with proper error handling
  const signOut = async (): Promise<void> => {
    try {
      setLoading(true)
      setError(null)
      await authSignOut()
      setUser(null)
    } catch (err: unknown) {
      const authError = isAuthError(err)
        ? err
        : createAuthError(
            err instanceof Error
              ? (err as Error)?.message || String(err)
              : 'Sign out failed',
            AuthErrorCode.SIGNOUT_FAILED,
          )
      setError(authError)
      throw authError
    } finally {
      setLoading(false)
    }
  }

  // Reset password with proper error handling
  const resetPassword = async (
    email: string,
    redirectTo?: string,
  ): Promise<boolean> => {
    try {
      setError(null)
      await authResetPassword(email, redirectTo)
      return true
    } catch (err: unknown) {
      const authError = isAuthError(err)
        ? err
        : createAuthError(
            err instanceof Error
              ? (err as Error)?.message || String(err)
              : 'Password reset failed',
            AuthErrorCode.RESET_FAILED,
          )
      setError(authError)
      throw authError
    }
  }

  // Verify OTP with proper type inference and error handling
  const verifyOtp = async (
    params: OtpVerificationParams,
  ): Promise<AuthResult> => {
    try {
      setError(null)
      const response = await authVerifyOtp(params)

      if (!response || !response.success) {
        throw createAuthError(
          (response && response.error) || 'OTP verification failed',
          AuthErrorCode.OTP_FAILED,
        )
      }

      if (response.user) {
        setUser(response.user)
      }

      return response
    } catch (err: unknown) {
      const authError = isAuthError(err)
        ? err
        : createAuthError(
            err instanceof Error
              ? (err as Error)?.message || String(err)
              : 'OTP verification failed',
            AuthErrorCode.OTP_FAILED,
          )
      setError(authError)
      return { success: false, error: authError.message }
    }
  }

  // Update profile with proper type inference and error handling
  const updateProfile = async (profile: ProfileUpdateParams): Promise<void> => {
    if (!user?.id) {
      throw createAuthError('No authenticated user', AuthErrorCode.NO_USER)
    }

    try {
      setError(null)
      const result = await authUpdateProfile(user.id as string, profile)

      if (result && result.error) {
        throw isAuthError(result.error)
          ? result.error
          : createAuthError(
              'Profile update failed',
              AuthErrorCode.UPDATE_FAILED,
            )
      }

      // Update local user state with new profile data
      setUser((prev) => {
        if (!prev) {
          return null
        }

        return {
          ...prev,
          fullName: profile.fullName ?? prev.fullName,
          ...(profile.avatarUrl && { avatarUrl: profile.avatarUrl }),
          metadata: {
            ...(prev.metadata as Record<string, unknown>),
            ...profile.metadata,
          },
        } as AuthUser
      })
    } catch (err: unknown) {
      const authError = isAuthError(err)
        ? err
        : createAuthError(
            err instanceof Error
              ? (err as Error)?.message || String(err)
              : 'Profile update failed',
            AuthErrorCode.UPDATE_FAILED,
          )
      setError(authError)
      throw authError
    }
  }

  return {
    user,
    isLoading: loading,
    isAuthenticated: !!user,
    hasRole,
    error,
    signIn,
    signInWithOAuth,
    signUp,
    verifyOtp,
    resetPassword,
    signOut,
    updateProfile,
  }
}
