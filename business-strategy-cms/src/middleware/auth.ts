import { Request, Response, NextFunction } from 'express'
import { AuthService } from '@/services/authService'
import { UserRole } from '@/types/user'

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string
    email: string
    role: UserRole
  }
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

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
  } catch (error) {
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
