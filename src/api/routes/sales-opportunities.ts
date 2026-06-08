// Sales Opportunities Routes\nimport express, { Router, Request, Response } from 'express'\n\nimport { authMiddleware } from '../middleware/auth'\nimport { asyncHandler, ValidationError } from '../middleware/error-handler'\nimport {\n  listSalesOpportunities,\n  createSalesOpportunity,\n  getSalesOpportunity,\n  updateSalesOpportunity,\n  deleteSalesOpportunity,\n  updateStage,\n  addContact,\n  addActivity,\n} from '../services/sales-service'\n\nconst router: Router = express.Router()\n\n// All sales opportunity routes require authentication\nrouter.use(authMiddleware)\n\nrouter.get(\n  '/',\n  asyncHandler(async (req: Request, res: Response) => {\n    const {page, limit, stage} = req.query\n    const { user } = req as any\n\n    const result = await listSalesOpportunities(user.id, {\n      page: page ? parseInt(page as string) : 1,\n      limit: limit ? parseInt(limit as string) : 50,\n      stage: stage as string,\n      status: undefined,\n    })\n\n    res.json({ success: true, ...result })\n  }),\n)\n\nrouter.post(\n  '/',\n  asyncHandler(async (req: Request, res: Response) => {\n    const { title, value, stage, expectedCloseDate, probability } =\n      req.body\n    const { user } = req as any\n\n    if (!title || !value) {\n      throw new ValidationError('title and value are required', {\n        title: !title ? 'Title is required' : '',\n        value: !value ? 'Value is required' : '',\n      })\n    }\n\n    const opportunity = await createSalesOpportunity({\n      title,\n      amount: value,\n      stage,\n      closeDate: expectedCloseDate,\n      probability,\n      ownerId: user.id,\n    })\n\n    res.status(201).json({ success: true, data: opportunity })\n  }),\n)\n\nrouter.get(\n  '/:opportunityId',\n  asyncHandler(async (req: Request, res: Response) => {\n    const opportunityId = req.params.opportunityId as string\n    const { user } = req as any\n\n    const opportunity = await getSalesOpportunity(opportunityId, user.id)\n    res.json({ success: true, data: opportunity })\n  }),\n)\n\nrouter.put(\n  '/:opportunityId',\n  asyncHandler(async (req: Request, res: Response) => {\n    const opportunityId = req.params.opportunityId as string\n    const {\n      title,\n      value,\n      stage,\n      contacts,\n      expectedCloseDate,\n      probability,\n      status,\n    } = req.body\n    const { user } = req as any\n\n    const opportunity = await updateSalesOpportunity(opportunityId, user.id, {\n      title,\n      value,\n      stage,\n      contacts,\n      expectedCloseDate,\n      probability,\n      status,\n    })\n\n    res.json({ success: true, data: opportunity })\n  }),\n)\n\nrouter.delete(\n  '/:opportunityId',\n  asyncHandler(async (req: Request, res: Response) => {\n    const opportunityId = req.params.opportunityId as string\n    const { user } = req as any\n\n    await deleteSalesOpportunity(opportunityId, user.id)\n    res.json({ success: true })\n  }),\n)\n\nrouter.post(\n  '/:opportunityId/stage',\n  asyncHandler(async (req: Request, res: Response) => {\n    const opportunityId = req.params.opportunityId as string\n    const { stage } = req.body\n    const { user } = req as any\n\n    if (!stage) {\n      throw new ValidationError('stage is required', {\n        stage: 'Stage is required',\n      })\n    }\n\n    const opportunity = await updateStage(opportunityId, user.id, stage)\n\n    res.json({ success: true, data: opportunity })\n  }),\n)\n\nrouter.post(\n  '/:opportunityId/contacts',\n  asyncHandler(async (req: Request, res: Response) => {\n    const opportunityId = req.params.opportunityId as string\n    const { contact } = req.body\n    const { user } = req as any\n\n    if (!contact) {\n      throw new ValidationError('contact is required', {\n        contact: 'Contact is required',\n      })\n    }\n\n    const opportunity = await addContact(opportunityId, user.id, contact)\n    res.json({ success: true, data: opportunity })\n  }),\n)\n\nrouter.post(\n  '/:opportunityId/notes',\n  asyncHandler(async (req: Request, res: Response) => {\n    const opportunityId = req.params.opportunityId as string\n    const { note } = req.body\n    const { user } = req as any\n\n    if (!note) {\n      throw new ValidationError('note is required', {\n        note: 'Note is required',\n      })\n    }\n\n    const opportunity = await addActivity(opportunityId, user.id, {\n      type: 'note',\n      description: note,\n    })\n\n    res.json({ success: true, data: opportunity })\n  }),\n)\n\nexport default router\n
// Sales Opportunities Routes
import express, { Router, Request, Response } from 'express'

import { authMiddleware } from '../middleware/auth'
import { asyncHandler, ValidationError } from '../middleware/error-handler'

interface SalesOpportunityBody {
  title?: string
  amount?: number
  stage?: string
  description?: string
  accountName?: string
  probability?: number
  closeDate?: string
  contacts?: unknown[]
  status?: string
}

interface ContactBody {
  name?: string
  email?: string
  phone?: string
  role?: string
}

interface ActivityBody {
  type?: string
  description?: string
  metadata?: Record<string, unknown>
}
import {
  listSalesOpportunities,
  createSalesOpportunity,
  getSalesOpportunity,
  updateSalesOpportunity,
  deleteSalesOpportunity,
  updateStage,
  addContact,
  addActivity,
} from '../services/sales-service'

const router: Router = express.Router()

// All sales opportunity routes require authentication
router.use(authMiddleware)

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const pageParam = req.query['page']
    const limitParam = req.query['limit']
    const stageParam = req.query['stage']
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }

    const result = await listSalesOpportunities(userId, {
      page: typeof pageParam === 'string' ? parseInt(pageParam) : 1,
      limit: typeof limitParam === 'string' ? parseInt(limitParam) : 50,
      stage: typeof stageParam === 'string' ? stageParam : undefined,
    })

    res.json({ success: true, ...result })
  }),
)

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as SalesOpportunityBody
    const { title, amount, stage, description } = body
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }

    if (!title || !amount || !stage) {
      throw new ValidationError('title, amount, and stage are required', {
        title: !title ? 'Title is required' : '',
        amount: !amount ? 'Amount is required' : '',
        stage: !stage ? 'Stage is required' : '',
      })
    }

    const opportunity = await createSalesOpportunity({
      title,
      description,
      ownerId: userId,
      accountName: body.accountName,
      amount,
      probability: body.probability,
      stage,
      closeDate: body.closeDate ? new Date(body.closeDate) : undefined,
    })

    res.status(201).json({ success: true, data: opportunity })
  }),
)

router.get(
  '/:opportunityId',
  asyncHandler(async (req: Request, res: Response) => {
    const opportunityId = String(req.params['opportunityId'] ?? '')
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }

    const opportunity = await getSalesOpportunity(opportunityId, userId)

    res.json({ success: true, data: opportunity })
  }),
)

router.put(
  '/:opportunityId',
  asyncHandler(async (req: Request, res: Response) => {
    const opportunityId = String(req.params['opportunityId'] ?? '')
    const body = req.body as SalesOpportunityBody
    const { title, amount, stage } = body
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }

    const opportunity = await updateSalesOpportunity(opportunityId, userId, {
      title,
      value: amount,
      stage,
      contacts: body.contacts as Record<string, unknown>[] | undefined,
      expectedCloseDate: body.closeDate ? new Date(body.closeDate) : undefined,
      probability: body.probability,
      status: body.status,
    })

    res.json({ success: true, data: opportunity })
  }),
)

router.delete(
  '/:opportunityId',
  asyncHandler(async (req: Request, res: Response) => {
    const opportunityId = String(req.params['opportunityId'] ?? '')
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }

    await deleteSalesOpportunity(opportunityId, userId)

    res.json({ success: true, message: 'Opportunity deleted' })
  }),
)

router.put(
  '/:opportunityId/stage',
  asyncHandler(async (req: Request, res: Response) => {
    const opportunityId = String(req.params['opportunityId'] ?? '')
    const body = req.body as SalesOpportunityBody
    const { stage } = body
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }

    if (!stage) {
      throw new ValidationError('stage is required', {
        stage: 'Stage is required',
      })
    }

    const opportunity = await updateStage(opportunityId, userId, stage)

    res.json({ success: true, data: opportunity })
  }),
)

router.post(
  '/:opportunityId/contacts',
  asyncHandler(async (req: Request, res: Response) => {
    const opportunityId = String(req.params['opportunityId'] ?? '')
    const body = req.body as ContactBody
    const { name, email, phone, role } = body
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }

    if (!name) {
      throw new ValidationError('contact name is required', {
        name: 'Contact name is required',
      })
    }

    const opportunity = await addContact(opportunityId, userId, {
      name,
      email,
      phone,
      role,
    })

    res.json({ success: true, data: opportunity })
  }),
)

router.post(
  '/:opportunityId/activities',
  asyncHandler(async (req: Request, res: Response) => {
    const opportunityId = String(req.params['opportunityId'] ?? '')
    const body = req.body as ActivityBody
    const { type, description, metadata } = body
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }

    if (!type || !description) {
      throw new ValidationError('type and description are required', {
        type: !type ? 'Type is required' : '',
        description: !description ? 'Description is required' : '',
      })
    }

    const opportunity = await addActivity(opportunityId, userId, {
      type: type as Parameters<typeof addActivity>[2]['type'],
      description,
      metadata,
    })

    res.json({ success: true, data: opportunity })
  }),
)

export default router
