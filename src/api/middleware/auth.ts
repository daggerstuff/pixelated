import type { NextFunction } from 'express'

import { authenticateRequest } from '../../lib/auth/auth0-middleware'

/**
 * Express middleware for Auth0 authentication
 * Validates JWT tokens and attaches user information to the request
 *
 * This middleware should be applied to protected Express API routes.
 * For Astro middleware integration, see src/middleware.ts
 */

export type AuthenticatedUser = {
  sub?: string
  id?: string
  email?: string
  roles?: string[]
  permissions?: string[]
  emailVerified?: boolean
  [key: string]: unknown
}

export type AuthRequest = {
  protocol: string
  originalUrl?: string
  url?: string
  method: string
  headers: Record<string, string | undefined>
  get: (name: string) => string | undefined
  user?: AuthenticatedUser
}

export type AuthResponse = {
  status: (statusCode: number) => AuthResponse
  json: (body: unknown) => AuthResponse
}

export async function authMiddleware(
  req: AuthRequest,
  res: AuthResponse,
  next: NextFunction,
): Promise<void> {
  try {
    // Adapt the Express Request into a standard Web API Request object to support
    // the shared `authenticateRequest` function used by both Express and Astro middleware.
    const headers = Object.entries(req.headers).reduce<Record<string, string>>(
      (acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value
        }

        return acc
      },
      {},
    )
    const webApiRequest = new globalThis.Request(
      `${req.protocol}://${req.get('host')}${req.originalUrl ?? req.url}`,
      {
        method: req.method,
        headers: new Headers(headers),
      },
    )

    // Use the existing Auth0 authentication logic
    const authResult = await authenticateRequest(webApiRequest)

    if (!authResult.success) {
      res.status(401).json({
        error: authResult.error ?? 'Authentication required',
        code: 'UNAUTHORIZED',
      })
      return
    }

    // Attach user to request object for downstream middleware
    if (authResult.request?.user) {
      req.user = {
        ...authResult.request.user,
        emailVerified: authResult.request.user.emailVerified ?? false,
      }
    }

    next()
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Authentication failed'
    res.status(401).json({
      error: errorMessage,
      code: 'AUTH_ERROR',
    })
  }
}

/**
 * Middleware to check if user has specific roles
 * @param allowedRoles - Array of role names that are allowed to access the route
 */
export function requireRoles(allowedRoles: string[]) {
  return (req: AuthRequest, res: AuthResponse, next: NextFunction): void => {
    const user = req.user

    if (!user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      })
      return
    }

    const userRoles = user.roles ?? []
    const hasRequiredRole = allowedRoles.some((role) =>
      userRoles.includes(role),
    )

    if (!hasRequiredRole) {
      res.status(403).json({
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        required: allowedRoles,
      })
      return
    }

    next()
  }
}

/**
 * Middleware to check if user has specific permissions
 * @param requiredPermissions - Array of permission strings required
 */
export function requirePermissions(requiredPermissions: string[]) {
  return (req: AuthRequest, res: AuthResponse, next: NextFunction): void => {
    const user = req.user

    if (!user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      })
      return
    }

    const userPermissions = user.permissions ?? []
    const hasAllPermissions = requiredPermissions.every((permission) =>
      userPermissions.includes(permission),
    )

    if (!hasAllPermissions) {
      res.status(403).json({
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        required: requiredPermissions,
      })
      return
    }

    next()
  }
}
