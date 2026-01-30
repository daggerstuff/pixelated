import { Router } from 'express'
import { UserService } from '@/services/userService'
import {
  authenticateToken,
  requireAdmin,
  AuthenticatedRequest,
} from '@/middleware/auth'
import { UserRole } from '@/types/user'

const router = Router()

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
    } catch (error) {
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
      const user = await UserService.getUserById(req.params.id)
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
    } catch (error) {
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
  async (req: AuthenticatedRequest, res) => {
    try {
      const { role } = req.body
      if (!Object.values(UserRole).includes(role)) {
        res.status(400).json({
          success: false,
          error: { message: 'Invalid role' },
        })
        return
      }

      const user = await UserService.updateUserRole(req.params.id, role)
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
    } catch (error) {
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
  async (req: AuthenticatedRequest, res) => {
    try {
      const { email, role } = req.body
      const result = await UserService.inviteUser(email, role)
      res.status(201).json({
        success: true,
        data: result,
      })
    } catch (error) {
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
      const user = await UserService.deactivateUser(req.params.id)
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
    } catch (error) {
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
      const user = await UserService.activateUser(req.params.id)
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
    } catch (error) {
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
