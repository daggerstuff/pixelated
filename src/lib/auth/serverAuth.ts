import type { AuthRole } from '../../config/auth.config'
import type {
  ProtectRouteOptions,
  ProtectedAPIRoute,
  BaseAPIContext,
  AuthAPIContext,
} from './apiRouteTypes'
import { authenticateRequest, requireRole } from './auth0-middleware'
import { getRolePermissions, type UserRole } from './auth0-rbac-service'
import type { AuthUser } from './types'

/**
 * Implementation of protectRoute higher-order function.
 * Wraps an API route handler with authentication and authorization checks.
 *
 * Supports two calling conventions:
 * 1. Curried: `protectRoute(options)(handler)` — used in evidence/index.ts, irb.ts
 * 2. Direct: `protectRoute(options, handler)` — used in query/index.ts, preview.ts, audit.ts
 */

export function protectRoute(options?: ProtectRouteOptions): (handler: ProtectedAPIRoute) => (context: BaseAPIContext) => Promise<Response>
export function protectRoute(
  options: ProtectRouteOptions,
  handler: ProtectedAPIRoute,
): (context: BaseAPIContext) => Promise<Response>
export function protectRoute(
  options: ProtectRouteOptions = {},
  handler?: ProtectedAPIRoute,
): unknown {
  const wrap = (h: ProtectedAPIRoute) => {
    return async (context: BaseAPIContext) => {
      // 1. Authenticate request
      const authResult = await authenticateRequest(context.request)

      if (!authResult.success || !authResult.request) {
        return (
          authResult.response ??
          new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }

      // 2. Check role if required
      if (options.requiredRole) {
        const roleResult = await requireRole(authResult.request, [
          options.requiredRole,
        ])
        if (!roleResult.success) {
          return (
            roleResult.response ??
            new Response(JSON.stringify({ error: 'Forbidden' }), {
              status: 403,
              headers: { 'Content-Type': 'application/json' },
            })
          )
        }
      }

      // 3. Attach user to locals for the handler and convert context
      const user = authResult.request.user!
      const role = normalizeAuthRole(user.role)
      const userRole = normalizeUserRole(user.role)
      const authUser: AuthUser = {
        id: user.id,
        email: user.email,
        role,
        fullName: user.fullName,
        emailVerified: user.emailVerified ?? false,
        permissions: getRolePermissions(userRole),
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        appMetadata: user.appMetadata,
        userMetadata: user.userMetadata,
        name: user.fullName,
      }

      const authContext: AuthAPIContext = {
        ...context,
        locals: {
          ...context.locals,
          user: authUser,
        },
        request: context.request,
      }

      return h(authContext)
    }
  }

  if (handler) {
    return wrap(handler)
  }

  return wrap
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

/**
 * Middleware for requiring authentication on Astro pages (SSR).
 */
export async function requirePageAuth(
  context: { request: Request },
  role?: string,
) {
  const authResult = await authenticateRequest(context.request)
  if (!authResult.success) {
    // Redirection should ideally happen in the caller or via a specific Response
    return new Response(null, {
      status: 302,
      headers: { Location: '/login' },
    })
  }
  if (role && authResult.request?.user?.role !== role) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/forbidden' },
    })
  }
  return null
}
