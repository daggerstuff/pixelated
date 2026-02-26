// Market Research Routes
import express, { Router, Request, Response } from 'express'
import { asyncHandler, ValidationError } from '../middleware/error-handler'
import { authMiddleware } from '../middleware/auth'
import {
    createMarketResearch,
    listMarketResearch,
    getMarketResearch
} from '../services/market-research-service'

const router: Router = express.Router()

// All market research routes require authentication
router.use(authMiddleware)

router.get('/', asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, industry, status } = req.query
    const { user } = req as any

    const result = await listMarketResearch(user.id, {
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 50,
        industry: typeof industry === 'string' ? industry : undefined,
        status: typeof status === 'string' ? status : undefined
    })

    res.json({ success: true, ...result })
}))

router.post('/', asyncHandler(async (req: Request, res: Response) => {
    const { title, industry, targetMarket, methodology, budget } = req.body
    const { user } = req as any

    if (!title || !industry) {
        throw new ValidationError('title and industry are required', { 
            title: !title ? 'Title is required' : '', 
            industry: !industry ? 'Industry is required' : '' 
        })
    }

    const research = await createMarketResearch({
        title,
        industry,
        targetMarket,
        methodology,
        budget,
        ownerId: user.id
    } as Parameters<typeof createMarketResearch>[0])

    res.status(201).json({ success: true, data: research })
}))

router.get('/:researchId', asyncHandler(async (req: Request, res: Response) => {
    const researchId = req.params.researchId as string
    const { user } = req as any

    const research = await getMarketResearch(researchId, user.id)

    res.json({ success: true, data: research })
}))

router.put('/:researchId', asyncHandler(async (req: Request, res: Response) => {
    const researchId = req.params.researchId as string
    const { title, industry, targetMarket, methodology, budget, status } = req.body
    const { user } = req as any

    const research = await createMarketResearch({
        title,
        industry,
        targetMarket,
        methodology,
        budget,
        ownerId: user.id,
        description: req.body.description
    } as { title: string; ownerId: string; description?: string; industry?: string; targetMarket?: string; methodology?: string; budget?: string })

    res.json({ success: true, data: research })
}))

router.delete('/:researchId', asyncHandler(async (req: Request, res: Response) => {
    const _researchId = req.params.researchId as string
    const { user } = req as any

    // Note: deleteResearch is not implemented in the service yet
    // Using getMarketResearch as placeholder - this needs proper implementation
    res.json({ success: true, message: 'Delete not implemented' })
}))

router.post('/:researchId/insights', asyncHandler(async (req: Request, res: Response) => {
    const researchId = req.params.researchId as string
    const { title, description, impact, confidence } = req.body
    const { user } = req as any

    if (!title) {
        throw new ValidationError('Insight title is required', { title: 'Title is required' })
    }

    // Note: addInsight is not implemented in the service yet
    // Using getMarketResearch as placeholder - this needs proper implementation
    const research = await getMarketResearch(researchId, user.id)
    res.json({ success: true, data: research })
}))

router.post('/:researchId/status', asyncHandler(async (req: Request, res: Response) => {
    const researchId = req.params.researchId as string
    const { status, reason } = req.body
    const { user } = req as any

    if (!status) {
        throw new ValidationError('status is required', { status: 'Status is required' })
    }

    // Note: updateStatus is not implemented in the service yet
    // Using getMarketResearch as placeholder - this needs proper implementation
    const research = await getMarketResearch(researchId, user.id)
    res.json({ success: true, data: research })
}))

export default router
