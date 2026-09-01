// Strategic Plans Routes
import express, { Router, Request, Response } from 'express'

import {
  listStrategicPlans,
  createStrategicPlan,
  getStrategicPlan,
  updateStrategicPlan,
  deleteStrategicPlan,
  alignProjectToPlan,
  updatePlanStatus,
} from '../lib/services/strategic-plan-service'
import { authMiddleware } from '../middleware/auth'
import { asyncHandler, ValidationError } from '../middleware/error-handler'

interface StrategicPlanBody {
  title?: string
  description?: string
  startDate?: string
  endDate?: string
  objectives?: unknown[]
  budget?: number
  keyResults?: unknown[]
  status?: string
}

interface AlignProjectBody {
  projectId?: string
}

interface StatusBody {
  status?: string
  reason?: string
}

const router: Router = express.Router()

// All strategic plan routes require authentication
router.use(authMiddleware)

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }
    const { page, limit, status } = req.query

    const result = await listStrategicPlans(userId, {
      page: page ? parseInt(String(page)) : 1,
      limit: limit ? parseInt(String(limit)) : 50,
      status: typeof status === 'string' ? status : undefined,
    })

    res.json({ success: true, ...result })
  }),
)

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }
    const body = req.body as StrategicPlanBody
    const { title, description, startDate, endDate, objectives } = body

    if (!title || !startDate || !endDate) {
      throw new ValidationError('title, startDate, and endDate are required', {
        title: !title ? 'Title is required' : '',
        startDate: !startDate ? 'Start date is required' : '',
        endDate: !endDate ? 'End date is required' : '',
      })
    }

    const plan = await createStrategicPlan({
      title,
      description,
      ownerId: userId,
      objectives: objectives as Record<string, unknown>[] | undefined,
      timeline: {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
      budget: body.budget,
      keyResults: body.keyResults as Record<string, unknown>[] | undefined,
    })

    res.status(201).json({ success: true, data: plan })
  }),
)

router.get(
  '/:planId',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }
    const planId = String(req.params['planId'] ?? '')

    const plan = await getStrategicPlan(planId, userId)

    res.json({ success: true, data: plan })
  }),
)

router.put(
  '/:planId',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }
    const planId = String(req.params['planId'] ?? '')
    const body = req.body as StrategicPlanBody
    const {
      title,
      description,
      startDate,
      endDate,
      objectives,
      budget,
      keyResults,
      status,
    } = body

    const plan = await updateStrategicPlan(planId, userId, {
      title,
      description,
      timeline:
        startDate && endDate
          ? { startDate: new Date(startDate), endDate: new Date(endDate) }
          : undefined,
      objectives: objectives as Record<string, unknown>[] | undefined,
      budget,
      keyResults: keyResults as Record<string, unknown>[] | undefined,
      status,
    })

    res.json({ success: true, data: plan })
  }),
)

router.delete(
  '/:planId',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }
    const planId = String(req.params['planId'] ?? '')

    await deleteStrategicPlan(planId, userId)

    res.json({ success: true, message: 'Strategic plan deleted' })
  }),
)

router.post(
  '/:planId/projects',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }
    const planId = String(req.params['planId'] ?? '')
    const body = req.body as AlignProjectBody
    const { projectId } = body

    if (!projectId) {
      throw new ValidationError('projectId is required', {
        projectId: 'Project ID is required',
      })
    }

    const plan = await alignProjectToPlan({
      planId,
      projectId,
      userId,
    })

    res.json({ success: true, data: plan })
  }),
)

router.put(
  '/:planId/status',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }
    const planId = String(req.params['planId'] ?? '')
    const body = req.body as StatusBody
    const { status, reason } = body

    if (!status) {
      throw new ValidationError('status is required', {
        status: 'Status is required',
      })
    }

    const plan = await updatePlanStatus({
      planId,
      status,
      reason,
      userId,
    })

    res.json({ success: true, data: plan })
  }),
)

export default router
