// Market Research Routes
import express, { Router, Request, Response } from 'express'
import { asyncHandler, ValidationError } from '../middleware/error-handler'
import { authMiddleware } from '../middleware/auth'
import {
    createResearch,
    listResearch,
    getResearch,
    updateResearch,
    deleteResearch,
    addInsight,
    updateStatus
} from '../services/market-research-service'

const router: Router = express.Router()

// All market research routes require authentication
router.use(authMiddleware)

router.get('/', asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, industry, status } = req.query
    const { user } = req as any

    const result = await listResearch({
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 50,
        industry: industry as string,
        status: status as string,
        userId: user.id
    })

    res.json({ success: true, ...result })
}))

router.post('/', asyncHandler(async (req: Request, res: Response) => {
    const { title, industry, targetMarket, methodology, budget } = req.body
    const { user } = req as any

    if (!title || !industry) {
        throw new ValidationError('title and industry are required', { title: !title, industry: !industry })
    }

    const research = await createResearch({
        title,
        industry,
        targetMarket,
        methodology,
        budget,
        ownerId: user.id
    })

    res.status(201).json({ success: true, data: research })
}))

router.get('/:researchId', asyncHandler(async (req: Request, res: Response) => {
    const { researchId } = req.params
    const { user } = req as any

    const research = await getResearch(researchId, user.id)

    res.json({ success: true, data: research })
}))

router.put('/:researchId', asyncHandler(async (req: Request, res: Response) => {
    const { researchId } = req.params
    const { title, industry, targetMarket, methodology, budget, status } = req.body
    const { user } = req as any

    const research = await updateResearch(researchId, user.id, {
        title,
        industry,
        targetMarket,
        methodology,
        budget,
        status
    })

    res.json({ success: true, data: research })
}))

router.delete('/:researchId', asyncHandler(async (req: Request, res: Response) => {
    const { researchId } = req.params
    const { user } = req as any

    await deleteResearch(researchId, user.id)
    res.json({ success: true })
}))

router.post('/:researchId/insights', asyncHandler(async (req: Request, res: Response) => {
    const { researchId } = req.params
    const { title, description, impact, confidence } = req.body
    const { user } = req as any

    if (!title) {
        throw new ValidationError('Insight title is required', { title: true })
    }

    const research = await addInsight(researchId, user.id, {
        title,
        description,
        impact,
        confidence
    })

    res.json({ success: true, data: research })
}))

router.post('/:researchId/status', asyncHandler(async (req: Request, res: Response) => {
    const { researchId } = req.params
    const { status, reason } = req.body
    const { user } = req as any

    if (!status) {
        throw new ValidationError('status is required', { status: true })
    }

    const research = await updateStatus({ researchId, status, reason, userId: user.id })

    res.json({ success: true, data: research })
}))

export default router
