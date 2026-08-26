import type { AuthRole } from '../../config/auth.config'
import { authenticateRequest } from './auth0-middleware'
import { getRolePermissions, type UserRole } from './auth0-rbac-service'
import type { AuthUser } from './types'

/**
 * Protect API route by verifying Auth0 token
 * This is a compatibility wrapper for the legacy protectApi used in various endpoints.
 *
 * @param request The incoming Request object
 * @returns An object containing success status and user data
 */
export async function protectApi(request: Request) {
  const result = await authenticateRequest(request)

  if (!result.success || !result.request?.user) {
    return {
      success: false,
      error: result.error ?? 'Authentication failed',
    }
  }

  // Enhance user object with permissions
  const userFn = result.request.user
  const role = normalizeAuthRole(userFn.role)
  const userRole = normalizeUserRole(userFn.role)
  const authUser: AuthUser = {
    id: userFn.id,
    email: userFn.email,
    role,
    fullName: userFn.fullName,
    emailVerified: userFn.emailVerified ?? false,
    permissions: getRolePermissions(userRole),
    avatarUrl: userFn.avatarUrl,
    createdAt: userFn.createdAt,
    lastLogin: userFn.lastLogin,
    appMetadata: userFn.appMetadata,
    userMetadata: userFn.userMetadata,
    name: userFn.fullName,
  }

  return {
    success: true,
    userId: authUser.id,
    user: authUser,
    tokenId: result.request.tokenId,
  }
}

function normalizeAuthRole(value: unknown): AuthRole {
  return value === 'admin' ||
    value === 'staff' ||
    value === 'therapist' ||
    value === 'user' ||
    value === 'guest'
    ? value
    : 'guest'
}

function normalizeUserRole(value: unknown): UserRole {
  return value === 'admin' ||
    value === 'therapist' ||
    value === 'patient' ||
    value === 'researcher' ||
    value === 'support' ||
    value === 'guest'
    ? value
    : 'guest'
}
