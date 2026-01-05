import type { AstroCookies } from 'astro'
import type { AuthRole } from '../config/auth.config'
import type { AuditMetadata } from './audit/types'
import { authConfig, hasRolePrivilege } from '../config/auth.config'
import {
  createHIPAACompliantAuditLog,
  AuditEventType,
  AuditEventStatus,
  type AuditDetails,
} from './audit'
// legacy supabase import removed; using adapter dynamically where needed
// Note: This is an Astro project, Next.js types are not needed here
// TODO: Replace with Astro-compatible types when implementing API auth

export interface AuthUser {
  id: string
  email: string
  role: AuthRole
  fullName?: string | null
  avatarUrl?: string | null
  lastLogin?: Date | null
  metadata?: Record<string, unknown>
}

/**
 * Get the current authenticated user from cookies
 */
export async function getCurrentUser(
  cookies: AstroCookies,
): Promise<AuthUser | null> {
  const accessToken = cookies.get(authConfig.cookies.accessToken)?.value

  if (!accessToken) {
    return null
  }

  try {
    const decoded = await (
      await import('@/adapters/betterAuthMongoAdapter')
    ).verifyToken(accessToken)
    if (!decoded) {
      return null
    }

    // Assuming the decoded token contains the user ID
    const { userId } = decoded

    // Fetch user from the database
    const user = await (
      await import('@/adapters/betterAuthMongoAdapter')
    ).getUserById(userId)
    if (!user) {
      return null
    }

    // Type assertion for user profile to handle the unknown type
    const userProfile = user.profile as
      | { firstName?: string; lastName?: string; avatarUrl?: string }
      | undefined

    return {
      id: user._id.toString(),
      email: user.email,
      role: user.role as AuthRole,
      fullName: userProfile?.firstName
        ? `${userProfile.firstName} ${userProfile.lastName || ''}`.trim()
        : null,
      avatarUrl: userProfile?.avatarUrl,
      lastLogin: user.lastLogin,
      metadata: (user.profile as Record<string, unknown>) || {},
    }
  } catch (error: unknown) {
    console.error('Error getting current user:', error)
    return null
  }
}

/**
 * Check if the user is authenticated
 */
export async function isAuthenticated(cookies: AstroCookies): Promise<boolean> {
  // Always return false in the browser context to prevent redirects
  if (typeof window !== 'undefined') {
    return false
  }

  // In server context, we can actually check authentication
  const accessToken = cookies.get(authConfig.cookies.accessToken)?.value
  const refreshToken = cookies.get(authConfig.cookies.refreshToken)?.value

  // If no tokens, not authenticated
  if (!accessToken || !refreshToken) {
    return false
  }

  try {
    // For now, just having valid tokens is enough
    // In production, you'd validate the tokens
    return true
  } catch (error: unknown) {
    console.error('Error checking authentication:', error)
    return false
  }
}

/**
 * Check if the user has the required role
 */
export async function hasRole(
  cookies: AstroCookies,
  requiredRole: AuthRole,
): Promise<boolean> {
  const user = await getCurrentUser(cookies)
  if (!user) {
    return false
  }

  return hasRolePrivilege(user.role, requiredRole)
}

/**
 * Log an audit event from auth module
 */
export async function createAuthAuditLog(entry: {
  userId: string
  action: string
  resource: string
  resourceId?: string
  metadata?: AuditMetadata
}): Promise<void> {
  try {
    await createHIPAACompliantAuditLog({
      userId: entry.userId,
      action: entry.action,
      resource: entry.resource,
      ...(entry.resourceId && { resourceId: entry.resourceId }),
      ...(entry.metadata && { details: entry.metadata as AuditDetails }),
      eventType: AuditEventType.SECURITY,
      status: AuditEventStatus.SUCCESS,
    })
  } catch (error: unknown) {
    console.error('Error logging auth audit event:', error)
  }
}

/**
 * Log an audit event using positional parameters
 */
export async function createAuditLogFromParams(
  userId: string | null,
  action: string,
  resource: string,
  resourceId?: string | null,
  metadata?: AuditMetadata | null,
): Promise<void> {
  await createHIPAACompliantAuditLog({
    userId: userId || 'system',
    action,
    resource,
    ...(resourceId && { resourceId }),
    ...(metadata && { details: metadata as AuditDetails }),
    eventType: AuditEventType.SYSTEM,
    status: AuditEventStatus.SUCCESS,
  })
}

/**
 * Require authentication for a route
 */
export async function requireAuth({
  cookies,
  redirect,
  request,
}: {
  cookies: AstroCookies
  redirect: (url: string) => Response
  request: Request
}) {
  const user = await getCurrentUser(cookies)

  if (!user) {
    const loginUrl = new URL(authConfig.redirects.authRequired, request.url)
    loginUrl.searchParams.set('redirect', request.url)
    return redirect(loginUrl.toString())
  }

  return null
}

/**
 * Require a specific role for a route
 */
export async function requireRole({
  cookies,
  redirect,
  request,
  role,
}: {
  cookies: AstroCookies
  redirect: (url: string) => Response
  request: Request
  role: AuthRole
}) {
  const user = await getCurrentUser(cookies)

  if (!user) {
    const loginUrl = new URL(authConfig.redirects.authRequired, request.url)
    loginUrl.searchParams.set('redirect', request.url)
    return redirect(loginUrl.toString())
  }

  if (!hasRolePrivilege(user.role, role)) {
    return redirect(authConfig.redirects.forbidden)
  }

  return null
}

export class Auth {
  async verifySession(request: Request): Promise<{ userId: string } | null> {
    const cookies = this.getCookiesFromRequest(request)
    const user = await getCurrentUser(cookies)
    return user ? { userId: user.id } : null
  }

  private getCookiesFromRequest(request: Request): AstroCookies {
    const cookieHeader = request.headers.get('cookie') || ''
    const cookies = new Map(
      cookieHeader.split(';').map((c) => {
        const [key, ...v] = c.trim().split('=')
        return [key, v.join('=')]
      }),
    )

    return {
      get: (name: string) => {
        const value = cookies.get(name)
        return value ? { value, json: () => JSON.parse(value) } : undefined
      },
      has: (name: string) => cookies.has(name),
      set: () => {
        throw new Error('Setting cookies is not supported in this context.')
      },
      delete: () => {
        throw new Error('Deleting cookies is not supported in this context.')
      },
      getAll: () => {
        return Array.from(cookies.entries()).map(([name, value]) => ({
          name,
          value,
        }))
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
  }
}

export const auth = new Auth()
