// Sales Opportunities Routes
import express, { Router, Request, Response } from 'express'

import { authMiddleware } from '../middleware/auth'
import { asyncHandler, ValidationError } from '../middleware/error-handler'
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
    const { page, limit, stage } = req.query
    const { user } = req as { user: { id: string } }

    const result = await listSalesOpportunities(user.id, {
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 50,
      stage: typeof stage === 'string' ? stage : undefined,
    })

    res.json({ success: true, ...result })
  }),
)

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { title, amount, stage, description } = req.body
    const { user } = req as { user: { id: string } }

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
      ownerId: user.id,
      accountName: req.body.accountName,
      amount,
      probability: req.body.probability,
      stage,
      closeDate: req.body.closeDate ? new Date(req.body.closeDate) : undefined,
    })

    res.status(201).json({ success: true, data: opportunity })
  }),
)

router.get(
  '/:opportunityId',
  asyncHandler(async (req: Request, res: Response) => {
    const opportunityId = req.params['opportunityId'] as string
    const { user } = req as { user: { id: string } }

    const opportunity = await getSalesOpportunity(opportunityId, user.id)

    res.json({ success: true, data: opportunity })
  }),
)

router.put(
  '/:opportunityId',
  asyncHandler(async (req: Request, res: Response) => {
    const opportunityId = req.params['opportunityId'] as string
    const { title, amount, stage } = req.body
    const { user } = req as { user: { id: string } }

    const opportunity = await updateSalesOpportunity(opportunityId, user.id, {
      title,
      value: amount,
      stage,
      contacts: req.body.contacts,
      expectedCloseDate: req.body.closeDate
        ? new Date(req.body.closeDate)
        : undefined,
      probability: req.body.probability,
      status: req.body.status,
    })

    res.json({ success: true, data: opportunity })
  }),
)

router.delete(
  '/:opportunityId',
  asyncHandler(async (req: Request, res: Response) => {
    const opportunityId = req.params['opportunityId'] as string
    const { user } = req as { user: { id: string } }

    await deleteSalesOpportunity(opportunityId, user.id)

    res.json({ success: true, message: 'Opportunity deleted' })
  }),
)

router.put(
  '/:opportunityId/stage',
  asyncHandler(async (req: Request, res: Response) => {
    const opportunityId = req.params['opportunityId'] as string
    const { stage } = req.body
    const { user } = req as { user: { id: string } }

    if (!stage) {
      throw new ValidationError('stage is required', {
        stage: 'Stage is required',
      })
    }

    const opportunity = await updateStage(opportunityId, user.id, stage)

    res.json({ success: true, data: opportunity })
  }),
)

router.post(
  '/:opportunityId/contacts',
  asyncHandler(async (req: Request, res: Response) => {
    const opportunityId = req.params['opportunityId'] as string
    const { name, email, phone, role } = req.body
    const { user } = req as { user: { id: string } }

    if (!name) {
      throw new ValidationError('contact name is required', {
        name: 'Contact name is required',
      })
    }

    const opportunity = await addContact(opportunityId, user.id, {
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
    const opportunityId = req.params['opportunityId'] as string
    const { type, description, metadata } = req.body
    const { user } = req as { user: { id: string } }

    if (!type || !description) {
      throw new ValidationError('type and description are required', {
        type: !type ? 'Type is required' : '',
        description: !description ? 'Description is required' : '',
      })
    }

    const opportunity = await addActivity(opportunityId, user.id, {
      type,
      description,
      metadata,
    })

    res.json({ success: true, data: opportunity })
  }),
)

export default router
