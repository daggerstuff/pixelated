import type { AstroCookies } from 'astro'

import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

import type { AuthRole } from '../config/auth.config'
import { authConfig, hasRolePrivilege } from '../config/auth.config'
import {
  createHIPAACompliantAuditLog,
  AuditEventType,
  AuditEventStatus,
  type AuditDetails,
} from './audit'
import type { AuditMetadata } from './audit/types'
import { getIdentityProvider } from './auth/identity-provider'
const logger = createBuildSafeLogger('auth-legacy')

let warnedAboutDeprecation = false

if (process.env['NODE_ENV'] !== 'test' && !warnedAboutDeprecation) {
  warnedAboutDeprecation = true
  logger.warn(
    '[auth-legacy] This module is the final thin shim before removal. ' +
      'All new code should use src/lib/auth/identity-provider.ts directly. ' +
      'Run `pnpm tsx scripts/auth-cutover-check.ts <user-ids>` with ' +
      'AUTH_DUAL_WRITE=true to validate parity before migrating call sites. ' +
      'See PIX-215 PR4 for the shim removal timeline.',
  )
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const authRoles = new Set<string>(authConfig.roles.hierarchy)

const isAuthRole = (value: unknown): value is AuthRole =>
  typeof value === 'string' && authRoles.has(value)

const toAuthRole = (value: unknown): AuthRole =>
  isAuthRole(value) ? value : authConfig.roles.default

const toMetadataRecord = (value: unknown): Record<string, unknown> =>
  isRecord(value) ? value : {}

const toAuditDetails = (
  metadata: AuditMetadata | null | undefined,
): AuditDetails => {
  if (!metadata) {
    return {}
  }

  const details: AuditDetails = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      details[key] = value
    }
  }

  return details
}

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
interface CookieAccessor {
  get(name: string):
    | {
        value: string
        json: () => unknown
      }
    | undefined
}

export async function getCurrentUser(
  cookies: CookieAccessor,
): Promise<AuthUser | null> {
  const accessToken = cookies.get(authConfig.cookies.accessToken)?.value
  if (!accessToken) {
    return null
  }

  const provider = getIdentityProvider()
  try {
    const decoded = await provider.validateToken(accessToken, 'access')
    const userId = decoded.userId
    if (typeof userId !== 'string') {
      return null
    }

    const user = await provider.getUserById(userId)
    if (!user) {
      return null
    }

    return {
      id: user.id,
      email: user.email,
      role: toAuthRole(user.role),
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      lastLogin: user.lastLogin ? new Date(user.lastLogin) : null,
      metadata: toMetadataRecord(user.userMetadata),
    }
  } catch (error: unknown) {
    logger.error('Error getting current user:', error)
    return null
  }
}

/**
 * Check if the user is authenticated
 */
export async function isAuthenticated(cookies: AstroCookies): Promise<boolean> {
  if (typeof window !== 'undefined') {
    return false
  }

  const accessToken = cookies.get(authConfig.cookies.accessToken)?.value
  const refreshToken = cookies.get(authConfig.cookies.refreshToken)?.value

  if (!accessToken || !refreshToken) {
    return false
  }

  try {
    const decoded = await getIdentityProvider().validateToken(
      accessToken,
      'access',
    )
    return !!decoded
  } catch (error: unknown) {
    logger.error('Error checking authentication:', error)
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
      ...(entry.metadata && { details: toAuditDetails(entry.metadata) }),
      eventType: AuditEventType.SECURITY,
      status: AuditEventStatus.SUCCESS,
    })
  } catch (error: unknown) {
    logger.error('Error logging auth audit event:', error)
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
    userId: userId ?? 'system',
    action,
    resource,
    ...(resourceId && { resourceId }),
    ...(metadata && { details: toAuditDetails(metadata) }),
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

  private getCookiesFromRequest(request: Request): CookieAccessor {
    const cookieHeader = request.headers.get('cookie') ?? ''
    const cookies = new Map(
      cookieHeader.split(';').map((c) => {
        const [key, ...v] = c.trim().split('=')
        return [key, v.join('=')]
      }),
    )

    const cookieReader = {
      get: (name: string) => {
        const value = cookies.get(name)
        return value
          ? {
              value,
              json: () => {
                try {
                  return JSON.parse(value) as unknown
                } catch {
                  return {}
                }
              },
            }
          : undefined
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
    }

    return {
      ...cookieReader,
    }
  }
}

export const auth = new Auth()
