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
    const { page, limit, stage, ownerId } = req.query
    const { user } = req as any

    const result = await listSalesOpportunities(user.id, {
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 50,
      stage: stage as string,
      status: undefined,
    })

    res.json({ success: true, ...result })
  }),
)

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { title, value, stage, contacts, expectedCloseDate, probability } =
      req.body
    const { user } = req as any

    if (!title || !value) {
      throw new ValidationError('title and value are required', {
        title: !title ? 'Title is required' : '',
        value: !value ? 'Value is required' : '',
      })
    }

    const opportunity = await createSalesOpportunity({
      title,
      amount: value,
      stage,
      closeDate: expectedCloseDate,
      probability,
      ownerId: user.id,
    })

    res.status(201).json({ success: true, data: opportunity })
  }),
)

router.get(
  '/:opportunityId',
  asyncHandler(async (req: Request, res: Response) => {
    const opportunityId = req.params.opportunityId as string
    const { user } = req as any

    const opportunity = await getSalesOpportunity(opportunityId, user.id)
    res.json({ success: true, data: opportunity })
  }),
)

router.put(
  '/:opportunityId',
  asyncHandler(async (req: Request, res: Response) => {
    const opportunityId = req.params.opportunityId as string
    const {
      title,
      value,
      stage,
      contacts,
      expectedCloseDate,
      probability,
      status,
    } = req.body
    const { user } = req as any

    const opportunity = await updateSalesOpportunity(opportunityId, user.id, {
      title,
      value,
      stage,
      contacts,
      expectedCloseDate,
      probability,
      status,
    })

    res.json({ success: true, data: opportunity })
  }),
)

router.delete(
  '/:opportunityId',
  asyncHandler(async (req: Request, res: Response) => {
    const opportunityId = req.params.opportunityId as string
    const { user } = req as any

    await deleteSalesOpportunity(opportunityId, user.id)
    res.json({ success: true })
  }),
)

router.post(
  '/:opportunityId/stage',
  asyncHandler(async (req: Request, res: Response) => {
    const opportunityId = req.params.opportunityId as string
    const { stage, notes, probability } = req.body
    const { user } = req as any

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
    const opportunityId = req.params.opportunityId as string
    const { contact } = req.body
    const { user } = req as any

    if (!contact) {
      throw new ValidationError('contact is required', {
        contact: 'Contact is required',
      })
    }

    const opportunity = await addContact(opportunityId, user.id, contact)
    res.json({ success: true, data: opportunity })
  }),
)

router.post(
  '/:opportunityId/notes',
  asyncHandler(async (req: Request, res: Response) => {
    const opportunityId = req.params.opportunityId as string
    const { note } = req.body
    const { user } = req as any

    if (!note) {
      throw new ValidationError('note is required', {
        note: 'Note is required',
      })
    }

    const opportunity = await addActivity(opportunityId, user.id, {
      type: 'note',
      description: note,
    })

    res.json({ success: true, data: opportunity })
  }),
)

export default router
