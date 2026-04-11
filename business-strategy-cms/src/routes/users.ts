import { Router, type Router as ExpressRouter } from 'express'

import {
  authenticateToken,
  requireAdmin,
  AuthenticatedRequest,
} from '@/middleware/auth'
import { UserService } from '@/services/userService'
import { UserRole } from '@/types/user'

const router: ExpressRouter = Router()

type UpdateRoleBody = {
  role?: unknown
}

type InviteBody = {
  email?: unknown
  role?: unknown
}

type UpdateRoleRequest = AuthenticatedRequest & {
  body: UpdateRoleBody
}

type InviteRequest = AuthenticatedRequest & {
  body: InviteBody
}

const parseUserRole = (value: unknown): UserRole | undefined => {
  if (typeof value !== 'string') {
    return undefined
  }

  return Object.values(UserRole).includes(value) ? (value as UserRole) : undefined
}

// Get all users (Admin only)
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  async (_req: AuthenticatedRequest, res) => {
    try {
      const users = await UserService.getAllUsers()
      res.json({
        success: true,
        data: users,
      })
    } catch (error: unknown) {
      res.status(500).json({
        success: false,
        error: {
          message:
            error instanceof Error ? error.message : 'Failed to fetch users',
        },
      })
    }
  },
)

// Get user by ID (Admin only)
router.get(
  '/:id',
  authenticateToken,
  requireAdmin,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.params['id']
      if (!userId) {
        res.status(400).json({
          success: false,
          error: { message: 'User ID is required' },
        })
        return
      }

      const user = await UserService.getUserById(userId)
      if (!user) {
        res.status(404).json({
          success: false,
          error: { message: 'User not found' },
        })
        return
      }
      res.json({
        success: true,
        data: user,
      })
    } catch (error: unknown) {
      res.status(500).json({
        success: false,
        error: {
          message:
            error instanceof Error ? error.message : 'Failed to fetch user',
        },
      })
    }
  },
)

// Update user role (Admin only)
router.put(
  '/:id/role',
  authenticateToken,
  requireAdmin,
  async (req: UpdateRoleRequest, res) => {
    try {
      const role = parseUserRole(req.body.role)
      if (!role) {
        res.status(400).json({
          success: false,
          error: { message: 'Invalid role' },
        })
        return
      }

      const userId = req.params['id']
      if (!userId) {
        res.status(400).json({
          success: false,
          error: { message: 'User ID is required' },
        })
        return
      }

      const user = await UserService.updateUserRole(userId, role)
      if (!user) {
        res.status(404).json({
          success: false,
          error: { message: 'User not found' },
        })
        return
      }

      res.json({
        success: true,
        data: user,
      })
    } catch (error: unknown) {
      res.status(500).json({
        success: false,
        error: {
          message:
            error instanceof Error
              ? error.message
              : 'Failed to update user role',
        },
      })
    }
  },
)

// Invite new user (Admin only)
router.post(
  '/invite',
  authenticateToken,
  requireAdmin,
  async (req: InviteRequest, res) => {
    try {
      if (typeof req.body.email !== 'string' || !req.body.email.trim()) {
        res.status(400).json({
          success: false,
          error: { message: 'Valid email is required' },
        })
        return
      }

      const role = parseUserRole(req.body.role)
      if (!role) {
        res.status(400).json({
          success: false,
          error: { message: 'Invalid role' },
        })
        return
      }

      const email = req.body.email.trim()
      const result = await UserService.inviteUser(email, role)
      res.status(201).json({
        success: true,
        data: result,
      })
    } catch (error: unknown) {
      res.status(400).json({
        success: false,
        error: {
          message:
            error instanceof Error ? error.message : 'Failed to invite user',
        },
      })
    }
  },
)

// Deactivate user (Admin only)
router.put(
  '/:id/deactivate',
  authenticateToken,
  requireAdmin,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.params['id']
      if (!userId) {
        res.status(400).json({
          success: false,
          error: { message: 'User ID is required' },
        })
        return
      }

      const user = await UserService.deactivateUser(userId)
      if (!user) {
        res.status(404).json({
          success: false,
          error: { message: 'User not found' },
        })
        return
      }

      res.json({
        success: true,
        data: user,
      })
    } catch (error: unknown) {
      res.status(500).json({
        success: false,
        error: {
          message:
            error instanceof Error
              ? error.message
              : 'Failed to deactivate user',
        },
      })
    }
  },
)

// Activate user (Admin only)
router.put(
  '/:id/activate',
  authenticateToken,
  requireAdmin,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.params['id']
      if (!userId) {
        res.status(400).json({
          success: false,
          error: { message: 'User ID is required' },
        })
        return
      }

      const user = await UserService.activateUser(userId)
      if (!user) {
        res.status(404).json({
          success: false,
          error: { message: 'User not found' },
        })
        return
      }

      res.json({
        success: true,
        data: user,
      })
    } catch (error: unknown) {
      res.status(500).json({
        success: false,
        error: {
          message:
            error instanceof Error ? error.message : 'Failed to activate user',
        },
      })
    }
  },
)

export { router as userRouter }
