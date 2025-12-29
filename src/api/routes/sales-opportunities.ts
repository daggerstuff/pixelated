// Sales Opportunities Routes
import express, { Router, Request, Response } from 'express'
import { asyncHandler, ValidationError } from '../middleware/error-handler'
import { authMiddleware } from '../middleware/auth'
import {
    listOpportunities,
    createOpportunity,
    getOpportunity,
    updateOpportunity,
    deleteOpportunity,
    addStageUpdate,
    addContact,
    addNote
} from '../services/sales-service'

const router: Router = express.Router()

// All sales opportunity routes require authentication
router.use(authMiddleware)

router.get('/', asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, stage, ownerId } = req.query
    const { user } = req as any

    const result = await listOpportunities({
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 50,
        stage: stage as string,
        ownerId: ownerId as string,
        userId: user.id
    })

    res.json({ success: true, ...result })
}))

router.post('/', asyncHandler(async (req: Request, res: Response) => {
    const { title, value, stage, contacts, expectedCloseDate, probability } = req.body
    const { user } = req as any

    if (!title || !value) {
        throw new ValidationError('title and value are required', { title: !title, value: !value })
    }

    const opportunity = await createOpportunity({
        title,
        value,
        stage,
        contacts,
        expectedCloseDate,
        probability,
        ownerId: user.id
    })

    res.status(201).json({ success: true, data: opportunity })
}))

router.get('/:opportunityId', asyncHandler(async (req: Request, res: Response) => {
    const { opportunityId } = req.params
    const { user } = req as any

    const opportunity = await getOpportunity(opportunityId, user.id)
    res.json({ success: true, data: opportunity })
}))

router.put('/:opportunityId', asyncHandler(async (req: Request, res: Response) => {
    const { opportunityId } = req.params
    const { title, value, stage, contacts, expectedCloseDate, probability, status } = req.body
    const { user } = req as any

    const opportunity = await updateOpportunity(opportunityId, user.id, {
        title,
        value,
        stage,
        contacts,
        expectedCloseDate,
        probability,
        status
    })

    res.json({ success: true, data: opportunity })
}))

router.delete('/:opportunityId', asyncHandler(async (req: Request, res: Response) => {
    const { opportunityId } = req.params
    const { user } = req as any

    await deleteOpportunity(opportunityId, user.id)
    res.json({ success: true })
}))

router.post('/:opportunityId/stage', asyncHandler(async (req: Request, res: Response) => {
    const { opportunityId } = req.params
    const { stage, notes, probability } = req.body
    const { user } = req as any

    if (!stage) {
        throw new ValidationError('stage is required', { stage: true })
    }

    const opportunity = await addStageUpdate({
        opportunityId,
        stage,
        notes,
        probability,
        userId: user.id
    })

    res.json({ success: true, data: opportunity })
}))

router.post('/:opportunityId/contacts', asyncHandler(async (req: Request, res: Response) => {
    const { opportunityId } = req.params
    const { contact } = req.body
    const { user } = req as any

    if (!contact) {
        throw new ValidationError('contact is required', { contact: true })
    }

    const opportunity = await addContact(opportunityId, user.id, contact)
    res.json({ success: true, data: opportunity })
}))

router.post('/:opportunityId/notes', asyncHandler(async (req: Request, res: Response) => {
    const { opportunityId } = req.params
    const { note } = req.body
    const { user } = req as any

    if (!note) {
        throw new ValidationError('note is required', { note: true })
    }

    const opportunity = await addNote(opportunityId, user.id, note)
    res.json({ success: true, data: opportunity })
}))

export default router
