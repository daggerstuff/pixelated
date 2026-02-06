import { Request, Response, NextFunction } from 'express'
import { authenticateRequest } from '../../lib/auth/auth0-middleware'

/**
 * Express middleware for Auth0 authentication
 * Validates JWT tokens and attaches user information to the request
 * 
 * This middleware should be applied to protected Express API routes.
 * For Astro middleware integration, see src/middleware.ts
 */
export async function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        // Create a Web API Request-compatible object from Express Request
        // The authenticateRequest function is designed for Web API Request,
        // but we can adapt the Express Request to work with it
        const webApiRequest = new globalThis.Request(
            `${req.protocol}://${req.get('host')}${req.originalUrl || req.url}`,
            {
                method: req.method,
                headers: new Headers(req.headers as Record<string, string>),
            }
        )

        // Use the existing Auth0 authentication logic
        const authResult = await authenticateRequest(webApiRequest)

        if (!authResult.success) {
            res.status(401).json({
                error: authResult.error || 'Authentication required',
                code: 'UNAUTHORIZED'
            })
            return
        }

        // Attach user to request object for downstream middleware
        if (authResult.request?.user) {
            (req as any).user = {
                ...authResult.request.user,
                emailVerified: authResult.request.user.emailVerified ?? false
            }
        }

        next()
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Authentication failed'
        res.status(401).json({
            error: errorMessage,
            code: 'AUTH_ERROR'
        })
    }
}

/**
 * Middleware to check if user has specific roles
 * @param allowedRoles - Array of role names that are allowed to access the route
 */
export function requireRoles(allowedRoles: string[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const user = (req as any).user

        if (!user) {
            res.status(401).json({
                error: 'Authentication required',
                code: 'UNAUTHORIZED'
            })
            return
        }

        const userRoles = user.roles || []
        const hasRequiredRole = allowedRoles.some((role) =>
            userRoles.includes(role)
        )

        if (!hasRequiredRole) {
            res.status(403).json({
                error: 'Insufficient permissions',
                code: 'FORBIDDEN',
                required: allowedRoles
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
    return (req: Request, res: Response, next: NextFunction): void => {
        const user = (req as any).user

        if (!user) {
            res.status(401).json({
                error: 'Authentication required',
                code: 'UNAUTHORIZED'
            })
            return
        }

        const userPermissions = user.permissions || []
        const hasAllPermissions = requiredPermissions.every((permission) =>
            userPermissions.includes(permission)
        )

        if (!hasAllPermissions) {
            res.status(403).json({
                error: 'Insufficient permissions',
                code: 'FORBIDDEN',
                required: requiredPermissions
            })
            return
        }

        next()
    }
}
