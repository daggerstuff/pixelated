import type { AuthRole } from '../config/auth.config.js'
import type {
  AuthResult,
  AuthState,
  AuthUser,
  Provider,
  UserRole,
  Session,
} from '../types/auth.js'

/**
 * Role mapping type
 */
export type RoleMapping = Record<AuthRole, UserRole>

/**
 * Profile update parameters
 */
export interface ProfileUpdateParams {
  /** User's full name */
  fullName?: string
  /** URL to user's avatar */
  avatarUrl?: string
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * OTP verification parameters
 */
export interface OtpVerificationParams {
  /** The OTP token */
  token: string
  /** Type of OTP verification */
  type?: 'email' | 'sms' | 'recovery' | 'email_change'
  /** Email address for verification */
  email?: string
  /** Phone number for verification */
  phone?: string
}

/**
 * Auth hook error type
 */
export interface AuthError extends Error {
  /** Error code */
  code?: string
  /** HTTP status code if applicable */
  status?: number
  /** Additional error details */
  details?: Record<string, unknown>
}

/**
 * Auth hook state
 */
export interface AuthHookState extends AuthState {
  /** Current error if any */
  error: AuthError | null
  /** Whether authentication is in progress */
  isLoading: boolean
  /** Whether user is authenticated */
  isAuthenticated: boolean
  /** Function to check if user has specific role(s) */
  hasRole: (role: AuthRole | AuthRole[] | UserRole | UserRole[]) => boolean
}

/**
 * Auth hook methods
 */
export interface AuthHookMethods {
  /** Sign in with email and password */
  signIn: (email: string, password: string) => Promise<AuthResult>
  /** Sign up with email and password */
  signUp: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<AuthResult>
  /** Sign out current user */
  signOut: () => Promise<void>
  /** Sign in with OAuth provider */
  signInWithOAuth: (provider: Provider, redirectTo?: string) => Promise<void>
  /** Reset password for email */
  resetPassword: (email: string, redirectTo?: string) => Promise<boolean>
  /** Verify OTP token */
  verifyOtp?: (params: OtpVerificationParams) => Promise<AuthResult>
  /** Update user profile */
  updateProfile: (profile: ProfileUpdateParams) => Promise<void>
}

/**
 * Complete auth hook return type
 */
export type UseAuthReturn = AuthHookState & AuthHookMethods

/**
 * Auth operation result type
 */
export type AuthOperationResult<T> = Promise<{
  success: boolean
  data?: T
  error?: AuthError
  session?: Session
}>

/**
 * Auth error codes
 */
export const AuthErrorCode = {
  AUTH_FAILED: 'AUTH_FAILED',
  SIGNUP_FAILED: 'SIGNUP_FAILED',
  OAUTH_FAILED: 'OAUTH_FAILED',
  SIGNOUT_FAILED: 'SIGNOUT_FAILED',
  RESET_FAILED: 'RESET_FAILED',
  OTP_FAILED: 'OTP_FAILED',
  UPDATE_FAILED: 'UPDATE_FAILED',
  NO_USER: 'NO_USER',
  INVALID_USER: 'INVALID_USER',
  INVALID_TOKEN: 'INVALID_TOKEN',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const

export type AuthErrorCode = typeof AuthErrorCode[keyof typeof AuthErrorCode]

/**
 * Type guard to check if a value is an AuthError
 */
export function isAuthError(error: unknown): error is AuthError {
  return error instanceof Error && 'code' in error
}

/**
 * Type guard to check if a value is an AuthUser
 */
export function isAuthUser(user: unknown): user is AuthUser {
  return (
    typeof user === 'object' &&
    user !== null &&
    'id' in user &&
    typeof (user as AuthUser).id === 'string'
  )
}

/**
 * Type guard to check if a value is an AuthResult
 */
export function isAuthResult(result: unknown): result is AuthResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    'success' in result &&
    typeof (result as AuthResult).success === 'boolean'
  )
}

/**
 * Helper to create a typed AuthError
 */
export function createAuthError(
  message: string,
  code?: AuthErrorCode,
  details?: Record<string, unknown>
): AuthError {
  const error = new Error(message) as AuthError
  (error as Error)?.name = 'AuthError'
  if (code) error.code = code
  if (details) error.details = details
  return error
}

// Re-export auth types for convenience
export type {
  AuthResult,
  AuthState,
  AuthUser,
  Provider,
  UserRole,
  Session,
}
