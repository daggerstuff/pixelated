// Strategic Plans Routes
import express, { Router, Request, Response } from 'express'

import { authMiddleware } from '../middleware/auth'
import { asyncHandler, ValidationError } from '../middleware/error-handler'
import {
  listStrategicPlans,
  createStrategicPlan,
  getStrategicPlan,
  updateStrategicPlan,
  deleteStrategicPlan,
  alignProjectToPlan,
  updatePlanStatus,
} from '../services/strategic-plan-service'

const router: Router = express.Router()

// All strategic plan routes require authentication
router.use(authMiddleware)

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, status } = req.query
    const { user } = req as { user: { id: string } }

    const result = await listStrategicPlans(user.id, {
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 50,
      status: typeof status === 'string' ? status : undefined,
    })

    res.json({ success: true, ...result })
  }),
)

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { title, description, startDate, endDate, objectives } = req.body
    const { user } = req as { user: { id: string } }

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
      ownerId: user.id,
      objectives,
      timeline: {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
      budget: req.body.budget,
      keyResults: req.body.keyResults,
    })

    res.status(201).json({ success: true, data: plan })
  }),
)

router.get(
  '/:planId',
  asyncHandler(async (req: Request, res: Response) => {
    const planId = req.params['planId'] as string
    const { user } = req as { user: { id: string } }

    const plan = await getStrategicPlan(planId, user.id)

    res.json({ success: true, data: plan })
  }),
)

router.put(
  '/:planId',
  asyncHandler(async (req: Request, res: Response) => {
    const planId = req.params['planId'] as string
    const {
      title,
      description,
      startDate,
      endDate,
      objectives,
      budget,
      keyResults,
      status,
    } = req.body
    const { user } = req as { user: { id: string } }

    const plan = await updateStrategicPlan(planId, user.id, {
      title,
      description,
      timeline:
        startDate && endDate
          ? { startDate: new Date(startDate), endDate: new Date(endDate) }
          : undefined,
      objectives,
      budget,
      keyResults,
      status,
    } as Parameters<typeof updateStrategicPlan>[2])

    res.json({ success: true, data: plan })
  }),
)

router.delete(
  '/:planId',
  asyncHandler(async (req: Request, res: Response) => {
    const planId = req.params['planId'] as string
    const { user } = req as { user: { id: string } }

    await deleteStrategicPlan(planId, user.id)

    res.json({ success: true, message: 'Strategic plan deleted' })
  }),
)

router.post(
  '/:planId/projects',
  asyncHandler(async (req: Request, res: Response) => {
    const planId = req.params['planId'] as string
    const { projectId } = req.body
    const { user } = req as { user: { id: string } }

    if (!projectId) {
      throw new ValidationError('projectId is required', {
        projectId: 'Project ID is required',
      })
    }

    const plan = await alignProjectToPlan({
      planId,
      projectId,
      userId: user.id,
    })

    res.json({ success: true, data: plan })
  }),
)

router.put(
  '/:planId/status',
  asyncHandler(async (req: Request, res: Response) => {
    const planId = req.params['planId'] as string
    const { status, reason } = req.body
    const { user } = req as { user: { id: string } }

    if (!status) {
      throw new ValidationError('status is required', {
        status: 'Status is required',
      })
    }

    const plan = await updatePlanStatus({
      planId,
      status,
      reason,
      userId: user.id,
    })

    res.json({ success: true, data: plan })
  }),
)

export default router
