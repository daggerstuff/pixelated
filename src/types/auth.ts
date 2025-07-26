/**
 * Auth provider options for OAuth
 */
export type Provider = 'google' | 'github'

/**
 * User role types in the application
 */
export type UserRole = 'admin' | 'therapist' | 'client' | 'guest'

/**
 * Authenticated user data structure
 */
export interface AuthUser {
  id: string | unknown
  email: string | unknown
  name: string | unknown
  image: string | unknown
  role: UserRole | unknown
  fullName: string | unknown
  roles: UserRole[]
  emailVerified: boolean | unknown
  createdAt: string | unknown
  lastSignIn: string | unknown
  avatarUrl?: string
  metadata?: Record<string, unknown>
}

/**
 * Auth token payload structure
 */
export interface AuthTokenPayload {
  userId: string
  purpose: string
  expiresAt?: number
  [key: string]: unknown
}

/**
 * Authentication results from login/signup operations
 */
export interface AuthResult {
  success: boolean
  user?: AuthUser
  session?: unknown
  error?: unknown
}

/**
 * Props for authentication component states
 */
export interface AuthComponentProps {
  redirectTo?: unknown
}

/**
 * Authentication state for global context
 */
export interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  hasRole: (role: UserRole | UserRole[]) => boolean
}
