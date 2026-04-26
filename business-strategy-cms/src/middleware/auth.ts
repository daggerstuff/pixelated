import { Request, Response, NextFunction } from 'express'

import { AuthService } from '@/services/authService'
import { type JwtPayload, UserRole } from '@/types/user'

export interface AuthenticatedRequest<
  P extends Record<string, string> = Record<string, string>,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = Record<string, string | string[] | undefined>,
> extends Request<P, ResBody, ReqBody, ReqQuery> {
  user?: JwtPayload
}

/**
 * Middleware to authenticate API requests via JWT.
 * Extracts the Bearer token from the Authorization header and verifies it.
 * If valid, attaches the decoded user payload to the request object for downstream use.
 * This ensures that protected routes have access to verified user context without re-authenticating.
 *
 * @param req - The incoming request, extended to potentially hold user data
 * @param res - The outgoing response
 * @param next - Function to pass control to the next middleware
 */
export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers['authorization']
  const token = authHeader?.split(' ')[1]

  if (!token) {
    res.status(401).json({
      success: false,
      error: { message: 'Access token required' },
    })
    return
  }

  try {
    const payload = await AuthService.verifyToken(token)
    if (!payload) {
      res.status(401).json({
        success: false,
        error: { message: 'Invalid or expired token' },
      })
      return
    }

    req.user = payload
    next()
  } catch {
    res.status(401).json({
      success: false,
      error: { message: 'Invalid token' },
    })
  }
}

export const requireRole = (roles: UserRole[]) => {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { message: 'Authentication required' },
      })
      return
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: { message: 'Insufficient permissions' },
      })
      return
    }

    next()
  }
}

export const requireAdmin = requireRole([UserRole.ADMINISTRATOR])
export const requireEditor = requireRole([
  UserRole.ADMINISTRATOR,
  UserRole.EDITOR,
])
export const requireCreator = requireRole([
  UserRole.ADMINISTRATOR,
  UserRole.EDITOR,
  UserRole.CONTENT_CREATOR,
])
export const requireViewer = requireRole([
  UserRole.ADMINISTRATOR,
  UserRole.EDITOR,
  UserRole.CONTENT_CREATOR,
  UserRole.VIEWER,
])
