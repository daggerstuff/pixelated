import { Router } from 'express'

import { AuthService } from '@/services/authService'
import { UserRegistration, UserCredentials } from '@/types/user'

const router = Router()

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isUserRegistration = (value: unknown): value is UserRegistration => {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value['email'] === 'string' &&
    typeof value['username'] === 'string' &&
    typeof value['firstName'] === 'string' &&
    typeof value['lastName'] === 'string' &&
    typeof value['password'] === 'string'
  )
}

const isUserCredentials = (value: unknown): value is UserCredentials =>
  isRecord(value) &&
  typeof value['email'] === 'string' &&
  typeof value['password'] === 'string'

const getStringField = (value: unknown, key: string): string | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const field = value[key]
  return typeof field === 'string' ? field : undefined
}

// Register new user
router.post('/register', async (req, res) => {
  try {
    if (!isUserRegistration(req.body)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid registration payload' },
      })
    }

    const userData = req.body
    const result = await AuthService.register(userData)
    return res.status(201).json({
      success: true,
      data: result,
    })
  } catch (error: unknown) {
    return res.status(400).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Registration failed',
      },
    })
  }
})

// Login user
router.post('/login', async (req, res) => {
  try {
    if (!isUserCredentials(req.body)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid login payload' },
      })
    }

    const credentials = req.body
    const result = await AuthService.login(credentials)
    return res.json({
      success: true,
      data: result,
    })
  } catch (error: unknown) {
    return res.status(401).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Login failed',
      },
    })
  }
})

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = getStringField(req.body, 'refreshToken')
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: { message: 'Refresh token is required' },
      })
    }

    const tokens = await AuthService.refreshToken(refreshToken)
    return res.json({
      success: true,
      data: { tokens },
    })
  } catch (error: unknown) {
    return res.status(401).json({
      success: false,
      error: {
        message:
          error instanceof Error ? error.message : 'Token refresh failed',
      },
    })
  }
})

// Logout user
router.post('/logout', async (req, res) => {
  try {
    const userId = getStringField(req.body, 'userId')
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: { message: 'User ID is required' },
      })
    }

    await AuthService.logout(userId)
    return res.json({
      success: true,
      message: 'Logged out successfully',
    })
  } catch (error: unknown) {
    return res.status(400).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Logout failed',
      },
    })
  }
})

export { router as authRouter }
