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
  id: string
  email: string
  name: string
  image: string
  role: UserRole
  fullName: string
  roles: UserRole[]
  emailVerified: boolean
  createdAt: string
  lastSignIn: string
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
 * Authentication session data structure
 */
export interface Session {
  user: AuthUser
  expires: string
  accessToken?: string
  refreshToken?: string
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
