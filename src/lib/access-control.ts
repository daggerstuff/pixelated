import type { AstroCookies } from 'astro'
import { createAuditLog, AuditEventType } from '../lib/audit'
import { getCurrentUser, hasRole } from './auth'

// Define permission types
export type Resource =
  | 'conversations'
  | 'messages'
  | 'users'
  | 'settings'
  | 'admin'
export type Action = 'create' | 'read' | 'update' | 'delete' | 'list' | 'manage'
export type Permission = `${Action}:${Resource}`

// Define role hierarchy
export const ROLES = {
  USER: 'user',
  STAFF: 'staff',
  ADMIN: 'admin',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

// Define role-based permissions
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [ROLES.USER]: [
    'create:conversations',
    'read:conversations',
    'update:conversations',
    'delete:conversations',
    'list:conversations',
    'create:messages',
    'read:messages',
    'update:messages',
    'read:users',
    'update:users',
    'read:settings',
    'update:settings',
  ],
  [ROLES.STAFF]: [
    'create:conversations',
    'read:conversations',
    'update:conversations',
    'delete:conversations',
    'list:conversations',
    'create:messages',
    'read:messages',
    'update:messages',
    'read:users',
    'update:users',
    'read:settings',
    'update:settings',
    'list:users',
    'read:admin',
  ],
  [ROLES.ADMIN]: [
    'create:conversations',
    'read:conversations',
    'update:conversations',
    'delete:conversations',
    'list:conversations',
    'create:messages',
    'read:messages',
    'update:messages',
    'delete:messages',
    'read:users',
    'update:users',
    'delete:users',
    'list:users',
    'read:settings',
    'update:settings',
    'read:admin',
    'manage:admin',
  ],
}

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) || false
}

/**
 * Check if the current user has a specific permission
 */
export async function hasPermission(
  cookies: AstroCookies,
  permission: Permission,
): Promise<boolean> {
  const user = await getCurrentUser(cookies)

  if (!user) {
    return false
  }

  const userRole = user.role as Role
  const hasPermission = roleHasPermission(userRole, permission)

  // Log access control check for sensitive operations
  if (
    permission.startsWith('delete:') ||
    permission.includes(':admin') ||
    permission.startsWith('manage:')
  ) {
    await createAuditLog(
      AuditEventType.ACCESS,
      'permission_check',
      user.id,
      'access_control',
      {
        permission,
        granted: hasPermission,
      },
    )
  }

  return hasPermission
}

/**
 * Check if the current user is an admin
 */
export async function isAdmin(cookies: AstroCookies): Promise<boolean> {
  return hasRole(cookies, ROLES.ADMIN)
}

/**
 * Check if the current user is staff or admin
 */
export async function isStaffOrAdmin(cookies: AstroCookies): Promise<boolean> {
  const user = await getCurrentUser(cookies)
  if (!user) {
    return false
  }
  return hasRole(cookies, ROLES.STAFF) || hasRole(cookies, ROLES.ADMIN)
}

/**
 * Create a middleware function that checks for a specific permission
 */
export function requirePermission(permission: Permission) {
  return async ({
    cookies,
    redirect,
  }: {
    cookies: AstroCookies
    redirect: (path: string) => Response
  }) => {
    const user = await getCurrentUser(cookies)

    if (!user) {
      return redirect(
        `/signin?error=${encodeURIComponent(
          'You must be signed in to access this page',
        )}`,
      )
    }

    const userRole = user.role as Role
    const hasPermission = roleHasPermission(userRole, permission)

    // Log access control check
    await createAuditLog(
      AuditEventType.ACCESS,
      'permission_check',
      user.id,
      'access_control',
      {
        permission,
        granted: hasPermission,
      },
    )

    if (!hasPermission) {
      return redirect(
        `/dashboard?error=${encodeURIComponent(
          'You do not have permission to access this page',
        )}`,
      )
    }

    return null // Continue to the page
  }
}
