// Strategic Plans Routes\nimport express, { Router, Request, Response } from 'express'\n\nimport { authMiddleware } from '../middleware/auth'\nimport { asyncHandler, ValidationError } from '../middleware/error-handler'\nimport {\n  listStrategicPlans,\n  createStrategicPlan,\n  getStrategicPlan,\n  updateStrategicPlan,\n  deleteStrategicPlan,\n  alignProjectToPlan,\n  updatePlanStatus,\n} from '../services/strategic-plan-service'\n\nconst router: Router = express.Router()\n\n// All strategic plan routes require authentication\nrouter.use(authMiddleware)\n\nrouter.get(\n  '/',\n  asyncHandler(async (req: Request, res: Response) => {\n    const {page, limit, status} = req.query\n    const { user } = req as any\n\n    const result = await listStrategicPlans(user.id, {\n      page: page ? parseInt(page as string) : 1,\n      limit: limit ? parseInt(limit as string) : 50,\n      status: status as string,\n    })\n\n    res.json({\n      success: true,\n      ...result,\n    })\n  }),\n)\n\nrouter.post(\n  '/',\n  asyncHandler(async (req: Request, res: Response) => {\n    const { title, description, objectives } = req.body\n    const { user } = req as any\n\n    if (!title) {\n      throw new ValidationError('Plan title is required', {\n        title: 'Title is required',\n      })\n    }\n\n    const plan = await createStrategicPlan({\n      title,\n      description,\n      objectives,\n      ownerId: user.id,\n    })\n\n    res.status(201).json({\n      success: true,\n      data: plan,\n    })\n  }),\n)\n\nrouter.get(\n  '/:planId',\n  asyncHandler(async (req: Request, res: Response) => {\n    const planId = req.params.planId as string\n    const { user } = req as any\n\n    const plan = await getStrategicPlan(planId, user.id)\n\n    res.json({\n      success: true,\n      data: plan,\n    })\n  }),\n)\n\nrouter.put(\n  '/:planId',\n  asyncHandler(async (req: Request, res: Response) => {\n    const planId = req.params.planId as string\n    const { title, description, horizon, objectives, metrics, status } =\n      req.body\n    const { user } = req as any\n\n    const plan = await updateStrategicPlan(planId, user.id, {\n      title,\n      description,\n      horizon,\n      objectives,\n      metrics,\n      status,\n    })\n\n    res.json({\n      success: true,\n      data: plan,\n    })\n  }),\n)\n\nrouter.delete(\n  '/:planId',\n  asyncHandler(async (req: Request, res: Response) => {\n    const planId = req.params.planId as string\n    const { user } = req as any\n\n    await deleteStrategicPlan(planId, user.id)\n\n    res.json({ success: true })\n  }),\n)\n\nrouter.post(\n  '/:planId/align',\n  asyncHandler(async (req: Request, res: Response) => {\n    const planId = req.params.planId as string\n    const { projectId, okrId } = req.body\n    const { user } = req as any\n\n    if (!projectId && !okrId) {\n      throw new ValidationError('projectId or okrId required', {\n        projectId: !projectId ? 'Project ID is required' : '',\n        okrId: !okrId ? 'OKR ID is required' : '',\n      })\n    }\n\n    const plan = await alignProjectToPlan({\n      planId,\n      projectId,\n      okrId,\n      userId: user.id,\n    })\n\n    res.json({\n      success: true,\n      data: plan,\n    })\n  }),\n)\n\nrouter.post(\n  '/:planId/status',\n  asyncHandler(async (req: Request, res: Response) => {\n    const planId = req.params.planId as string\n    const { status, reason } = req.body\n    const { user } = req as any\n\n    if (!status) {\n      throw new ValidationError('status is required', {\n        status: 'Status is required',\n      })\n    }\n\n    const plan = await updatePlanStatus({\n      planId,\n      status,\n      reason,\n      userId: user.id,\n    })\n\n    res.json({\n      success: true,\n      data: plan,\n    })\n  }),\n)\n\nexport default router\n
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
