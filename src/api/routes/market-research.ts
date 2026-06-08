// Market Research Routes\nimport express, { Router, Request, Response } from 'express'\n\nimport { authMiddleware } from '../middleware/auth'\nimport { asyncHandler, ValidationError } from '../middleware/error-handler'\nimport {\n  createMarketResearch,\n  listMarketResearch,\n  getMarketResearch,\n} from '../services/market-research-service'\n\nconst router: Router = express.Router()\n\n// All market research routes require authentication\nrouter.use(authMiddleware)\n\nrouter.get(\n  '/',\n  asyncHandler(async (req: Request, res: Response) => {\n    const { page, limit, industry, status } = req.query\n    const { user } = req as any\n\n    const result = await listMarketResearch(user.id, {\n      page: page ? parseInt(page as string) : 1,\n      limit: limit ? parseInt(limit as string) : 50,\n      industry: typeof industry === 'string' ? industry : undefined,\n      status: typeof status === 'string' ? status : undefined,\n    })\n\n    res.json({ success: true, ...result })\n  }),\n)\n\nrouter.post(\n  '/',\n  asyncHandler(async (req: Request, res: Response) => {\n    const { title, industry, targetMarket, methodology, budget } = req.body\n    const { user } = req as any\n\n    if (!title || !industry) {\n      throw new ValidationError('title and industry are required', {\n        title: !title ? 'Title is required' : '',\n        industry: !industry ? 'Industry is required' : '',\n      })\n    }\n\n    const research = await createMarketResearch({\n      title,\n      industry,\n      targetMarket,\n      methodology,\n      budget,\n      ownerId: user.id,\n    } as Parameters<typeof createMarketResearch>[0])\n\n    res.status(201).json({ success: true, data: research })\n  }),\n)\n\nrouter.get(\n  '/:researchId',\n  asyncHandler(async (req: Request, res: Response) => {\n    const researchId = req.params.researchId as string\n    const { user } = req as any\n\n    const research = await getMarketResearch(researchId, user.id)\n\n    res.json({ success: true, data: research })\n  }),\n)\n\nrouter.put(\n  '/:researchId',\n  asyncHandler(async (req: Request, res: Response) => {\n    const {title, industry, targetMarket, methodology, budget} =\n      req.body\n    const { user } = req as any\n\n    const research = await createMarketResearch({\n      title,\n      industry,\n      targetMarket,\n      methodology,\n      budget,\n      ownerId: user.id,\n      description: req.body.description,\n    } as {\n      title: string\n      ownerId: string\n      description?: string\n      industry?: string\n      targetMarket?: string\n      methodology?: string\n      budget?: string\n    })\n\n    res.json({ success: true, data: research })\n  }),\n)\n\nrouter.delete(\n  '/:researchId',\n  asyncHandler(async (req: Request, res: Response) => {\n\n\n    // Note: deleteResearch is not implemented in the service yet\n    // Using getMarketResearch as placeholder - this needs proper implementation\n    res.json({ success: true, message: 'Delete not implemented' })\n  }),\n)\n\nrouter.post(\n  '/:researchId/insights',\n  asyncHandler(async (req: Request, res: Response) => {\n    const researchId = req.params.researchId as string\n    const { title } = req.body\n    const { user } = req as any\n\n    if (!title) {\n      throw new ValidationError('Insight title is required', {\n        title: 'Title is required',\n      })\n    }\n\n    // Note: addInsight is not implemented in the service yet\n    // Using getMarketResearch as placeholder - this needs proper implementation\n    const research = await getMarketResearch(researchId, user.id)\n    res.json({ success: true, data: research })\n  }),\n)\n\nrouter.post(\n  '/:researchId/status',\n  asyncHandler(async (req: Request, res: Response) => {\n    const researchId = req.params.researchId as string\n    const { status } = req.body\n    const { user } = req as any\n\n    if (!status) {\n      throw new ValidationError('status is required', {\n        status: 'Status is required',\n      })\n    }\n\n    // Note: updateStatus is not implemented in the service yet\n    // Using getMarketResearch as placeholder - this needs proper implementation\n    const research = await getMarketResearch(researchId, user.id)\n    res.json({ success: true, data: research })\n  }),\n)\n\nexport default router\n
// Market Research Routes
import express, { Router, Request, Response } from 'express'

import { authMiddleware } from '../middleware/auth'
import { asyncHandler, ValidationError } from '../middleware/error-handler'
import {
  createMarketResearch,
  listMarketResearch,
  getMarketResearch,
} from '../services/market-research-service'

const router: Router = express.Router()

// All market research routes require authentication
router.use(authMiddleware)

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, industry, status } = req.query
    const { user } = req as { user: { id: string } }

    const result = await listMarketResearch(user.id, {
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 50,
      industry: typeof industry === 'string' ? industry : undefined,
      status: typeof status === 'string' ? status : undefined,
    })

    res.json({ success: true, ...result })
  }),
)

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { title, industry, targetMarket, methodology, budget } = req.body as {
      title?: string
      industry?: string
      targetMarket?: string
      methodology?: string
      budget?: string
    }
    const { user } = req as unknown as { user: { id: string } }

    if (typeof title !== 'string' || typeof industry !== 'string') {
      throw new ValidationError('title and industry are required', {
        title: typeof title !== 'string' ? 'Title is required' : '',
        industry: typeof industry !== 'string' ? 'Industry is required' : '',
      })
    }

    const research = await createMarketResearch({
      title,
      industry,
      targetMarket,
      methodology,
      budget,
      ownerId: user.id,
    } as Parameters<typeof createMarketResearch>[0])

    res.status(201).json({ success: true, data: research as unknown })
  }),
)

router.get(
  '/:researchId',
  asyncHandler(async (req: Request, res: Response) => {
    const researchId = req.params['researchId'] as string
    const { user } = req as unknown as { user: { id: string } }
    const research = await getMarketResearch(researchId, user.id)
    res.json({ success: true, data: research as unknown })
  }),
)

router.put(
  '/:researchId',
  asyncHandler(async (req: Request, res: Response) => {
    const { title, industry, targetMarket, methodology, budget, description } =
      req.body as {
        title?: string
        industry?: string
        targetMarket?: string
        methodology?: string
        budget?: string
        description?: string
      }
    const { user } = req as unknown as { user: { id: string } }

    const research = await createMarketResearch({
      title,
      industry,
      targetMarket,
      methodology,
      budget,
      ownerId: user.id,
      description,
    } as {
      title: string
      ownerId: string
      description?: string
      industry?: string
      targetMarket?: string
      methodology?: string
      budget?: string
    })

    res.json({ success: true, data: research as unknown })
  }),
)

router.delete(
  '/:researchId',
  asyncHandler(async (req: Request, res: Response) => {
    // Note: deleteMarketResearch is not implemented in the service yet
    // Using getMarketResearch as placeholder - this needs proper implementation
    res.json({ success: true, message: 'Delete not implemented' })
  }),
)

router.post(
  '/:researchId/insights',
  asyncHandler(async (req: Request, res: Response) => {
    const researchId = req.params['researchId'] as string
    const { title } = req.body as { title?: string }
    const { user } = req as unknown as { user: { id: string } }

    if (!title) {
      throw new ValidationError('Insight title is required', {
        title: 'Insight title is required',
      })
    }

    // Note: addInsight is not implemented in the service yet
    // Using getMarketResearch as placeholder - this needs proper implementation
    const research = await getMarketResearch(researchId, user.id)
    res.json({ success: true, data: research as unknown })
  }),
)

router.post(
  '/:researchId/status',
  asyncHandler(async (req: Request, res: Response) => {
    const researchId = req.params['researchId'] as string
    const { status } = req.body as { status?: string }
    const { user } = req as unknown as { user: { id: string } }

    if (!status) {
      throw new ValidationError('status is required', {
        status: 'Status is required',
      })
    }

    // Note: updateStatus is not implemented in the service yet
    // Using getMarketResearch as placeholder - this needs proper implementation
    const research = await getMarketResearch(researchId, user.id)
    res.json({ success: true, data: research as unknown })
  }),
)

export default router
