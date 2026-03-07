import { Router } from 'express'
import { AuthService } from '@/services/authService'
import { UserRegistration, UserCredentials } from '@/types/user'

const router = Router()

// Register new user
router.post('/register', async (req, res) => {
  try {
    const userData: UserRegistration = req.body
    const result = await AuthService.register(userData)
    res.status(201).json({
      success: true,
      data: result,
    })
  } catch (error) {
    res.status(400).json({
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
    const credentials: UserCredentials = req.body
    const result = await AuthService.login(credentials)
    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    res.status(401).json({
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
    const { refreshToken } = req.body
    const tokens = await AuthService.refreshToken(refreshToken)
    res.json({
      success: true,
      data: { tokens },
    })
  } catch (error) {
    res.status(401).json({
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
    const { userId } = req.body
    await AuthService.logout(userId)
    res.json({
      success: true,
      message: 'Logged out successfully',
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Logout failed',
      },
    })
  }
})

export { router as authRouter }
