/**
 * Authentication and Authorization Configuration Object
 *
 * This file contains configuration settings for authentication,
 * including session duration, cookie options, redirect paths,
 * and other auth-related settings.
 */

export type AuthRole = 'admin' | 'staff' | 'therapist' | 'user' | 'guest'

export interface AuthConfig {
  /** Session duration in seconds (default: 1 week) */
  sessionDuration: number

  /** Cookie options */
  cookies: {
    /** Access token cookie name */
    accessToken: string
    /** Refresh token cookie name */
    refreshToken: string
    /** Cookie path */
    path: string
    /** Cookie domain (undefined for current domain) */
    domain?:
      | string
      /** Secure cookie flag (HTTPS only) */
      | undefined
    /** Secure cookie flag (HTTPS only) */
    secure: boolean
    /** HTTP only flag (not accessible via JavaScript) */
    httpOnly: boolean
    /** Same site cookie policy */
    sameSite: 'strict' | 'lax' | 'none'
  }

  /** Redirect paths */
  redirects: {
    /** Path to redirect after successful login */
    afterLogin: string
    /** Path to redirect after logout */
    afterLogout: string
    /** Path to redirect when authentication is required */
    authRequired: string
    /** Path to redirect when access is forbidden */
    forbidden: string
  }

  /** Role configuration */
  roles: {
    /** Default role for new users */
    default: AuthRole
    /** Role hierarchy (ordered from highest to lowest privileges) */
    hierarchy: AuthRole[]
  }

  /** Rate limiting for auth-related requests */
  rateLimit: {
    /** Maximum login attempts before temporary lockout */
    maxLoginAttempts: number
    /** Lockout duration in seconds after too many failed attempts */
    lockoutDuration: number
  }
}

/**
 * Authentication configuration object
 */
export const authConfig: AuthConfig = {
  sessionDuration: 7 * 24 * 60 * 60, // 1 week in seconds

  cookies: {
    accessToken: 'auth-token',
    refreshToken: 'refresh-token',
    path: '/',
    domain: undefined,
    secure: true,
    httpOnly: true,
    sameSite: 'lax',
  },

  redirects: {
    afterLogin: '/dashboard',
    afterLogout: '/',
    authRequired: '/login',
    forbidden: '/access-denied',
  },

  roles: {
    default: 'user',
    hierarchy: ['admin', 'staff', 'therapist', 'user', 'guest'],
  },

  rateLimit: {
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60, // 15 minutes in seconds
  },
}

/**
 * Check if a role has higher or equal privileges than another role
 *
 * @param userRole - The user's role
 * @param requiredRole - The required role for an action
 * @returns True if the user's role has sufficient privileges
 */
export function hasRolePrivilege(
  userRole: AuthRole,
  requiredRole: AuthRole,
): boolean {
  const { hierarchy } = authConfig.roles

  // Get the indices of both roles in the hierarchy
  const userRoleIndex = hierarchy.indexOf(userRole)
  const requiredRoleIndex = hierarchy.indexOf(requiredRole)

  // Lower index means higher privilege (admin is 0)
  return (
    userRoleIndex !== -1 &&
    requiredRoleIndex !== -1 &&
    userRoleIndex <= requiredRoleIndex
  )
}

export default authConfig
