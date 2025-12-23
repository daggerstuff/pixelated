import { Router } from 'express'
import { UserService } from '@/services/userService'
import { AuthService } from '@/services/authService'

const router = Router()

// Complete user onboarding
router.post('/complete', async (req, res) => {
  try {
    const { userId, firstName, lastName, newPassword } = req.body

    if (!userId || !firstName || !lastName || !newPassword) {
      res.status(400).json({
        success: false,
        error: { message: 'All fields are required' },
      })
      return
    }

    const user = await UserService.completeOnboarding(
      userId,
      firstName,
      lastName,
      newPassword,
    )
    if (!user) {
      res.status(404).json({
        success: false,
        error: { message: 'User not found' },
      })
      return
    }

    // Generate new tokens for the user
    const tokens = await AuthService.refreshToken('dummy-refresh-token')

    res.json({
      success: true,
      data: { user, tokens },
      message: 'Onboarding completed successfully',
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Onboarding failed',
      },
    })
  }
})

// Check if user needs onboarding
router.get('/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const user = await UserService.getUserById(userId)

    if (!user) {
      res.status(404).json({
        success: false,
        error: { message: 'User not found' },
      })
      return
    }

    const needsOnboarding =
      !user.firstName || !user.lastName || !user.isEmailVerified

    res.json({
      success: true,
      data: {
        needsOnboarding,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          isEmailVerified: user.isEmailVerified,
        },
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message:
          error instanceof Error
            ? error.message
            : 'Failed to check onboarding status',
      },
    })
  }
})

export { router as onboardingRouter }
