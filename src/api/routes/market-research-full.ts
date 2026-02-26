// Market Research Routes
import express, { Router, Request, Response } from 'express'
import { asyncHandler } from '../middleware/error-handler'
import { authMiddleware } from '../middleware/auth'
import {
    createMarketResearch,
    searchMarketResearch,
    shareMarketResearch
} from '../services/market-research-service'
import { ValidationError } from '../middleware/error-handler'

const router: Router = express.Router()

// All routes require authentication
router.use(authMiddleware)

/**
 * POST /market-research
 * Create new market research document
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
    const { title, description, targetMarkets, researchType, timeline } = req.body
    const { id } = (req as any).user

    if (!title) {
        throw new ValidationError('Research title is required', { title: 'Title is required' })
    }

    const research = await createMarketResearch({
        title,
        description,
        targetMarkets,
        researchType,
        timeline,
        ownerId: id
    })

    res.json({
        success: true,
        data: research
    })
}));

/**
 * GET /market-research/search/:query
 * Search market research
 */
router.get('/search/:query', asyncHandler(async (req: Request, res: Response) => {
    const query = req.params.query as string
    const { id } = (req as any).user

    const results = await searchMarketResearch(query, id)

    res.json({
        success: true,
        data: results
    })
}));

/**
 * POST /market-research/:researchId/share
 * Share research with another user
 */
router.post('/:researchId/share', asyncHandler(async (req: Request, res: Response) => {
    const researchId = req.params.researchId as string
    const { userId, permissionLevel } = req.body
    const { id } = (req as any).user

    if (!userId || !permissionLevel) {
        throw new ValidationError('userId and permissionLevel required', {
            userId: !userId ? 'User ID is required' : '',
            permissionLevel: !permissionLevel ? 'Permission level is required' : ''
        })
    }

    if (!['view', 'edit', 'comment'].includes(permissionLevel)) {
        throw new ValidationError('Invalid permission level', { permissionLevel: 'Invalid permission level' })
    }

    const research = await shareMarketResearch(
        researchId,
        id,
        userId,
        permissionLevel as 'view' | 'edit' | 'comment'
    )

    res.json({
        success: true,
        data: research
    })
}));

export default router
