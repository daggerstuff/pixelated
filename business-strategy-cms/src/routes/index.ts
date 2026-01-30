import { Router } from 'express'
import { authRouter } from './auth'
import { userRouter } from './users'
import { onboardingRouter } from './onboarding'
import { documentRouter } from './documents'
import { marketRouter } from './market'
import { strategyRouter } from './strategy'

const router = Router()

// Health check endpoint
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API routes
router.use('/auth', authRouter)
router.use('/users', userRouter)
router.use('/onboarding', onboardingRouter)
router.use('/documents', documentRouter)
router.use('/market', marketRouter)
router.use('/strategy', strategyRouter)
// router.use('/workflows', workflowRoutes)

export { router as apiRouter }
