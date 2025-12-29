// Strategic Plans Routes
import express, { Router, Request, Response } from 'express'
import { asyncHandler, ValidationError } from '../middleware/error-handler'
import { authMiddleware } from '../middleware/auth'
import {
    listPlans,
    createPlan,
    getPlan,
    updatePlan,
    deletePlan,
    alignProject,
    updateStatus
} from '../services/strategic-plan-service'

const router: Router = express.Router()

// All strategic plan routes require authentication
router.use(authMiddleware)

router.get('/', asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, status, ownerId } = req.query
    const { user } = req as any

    const result = await listPlans({
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 50,
        status: status as string,
        ownerId: ownerId as string,
        userId: user.id
    })

    res.json({
        success: true,
        ...result
    })
}))

router.post('/', asyncHandler(async (req: Request, res: Response) => {
    const { title, description, horizon, objectives, metrics } = req.body
    const { user } = req as any

    if (!title) {
        throw new ValidationError('Plan title is required', { title: true })
    }

    const plan = await createPlan({
        title,
        description,
        horizon,
        objectives,
        metrics,
        ownerId: user.id
    })

    res.status(201).json({
        success: true,
        data: plan
    })
}))

router.get('/:planId', asyncHandler(async (req: Request, res: Response) => {
    const { planId } = req.params
    const { user } = req as any

    const plan = await getPlan(planId, user.id)

    res.json({
        success: true,
        data: plan
    })
}))

router.put('/:planId', asyncHandler(async (req: Request, res: Response) => {
    const { planId } = req.params
    const { title, description, horizon, objectives, metrics, status } = req.body
    const { user } = req as any

    const plan = await updatePlan(planId, user.id, {
        title,
        description,
        horizon,
        objectives,
        metrics,
        status
    })

    res.json({
        success: true,
        data: plan
    })
}))

router.delete('/:planId', asyncHandler(async (req: Request, res: Response) => {
    const { planId } = req.params
    const { user } = req as any

    await deletePlan(planId, user.id)

    res.json({ success: true })
}))

router.post('/:planId/align', asyncHandler(async (req: Request, res: Response) => {
    const { planId } = req.params
    const { projectId, okrId } = req.body
    const { user } = req as any

    if (!projectId && !okrId) {
        throw new ValidationError('projectId or okrId required', { projectId: !projectId, okrId: !okrId })
    }

    const plan = await alignProject({
        planId,
        projectId,
        okrId,
        userId: user.id
    })

    res.json({
        success: true,
        data: plan
    })
}))

router.post('/:planId/status', asyncHandler(async (req: Request, res: Response) => {
    const { planId } = req.params
    const { status, reason } = req.body
    const { user } = req as any

    if (!status) {
        throw new ValidationError('status is required', { status: true })
    }

    const plan = await updateStatus({ planId, status, reason, userId: user.id })

    res.json({
        success: true,
        data: plan
    })
}))

export default router
