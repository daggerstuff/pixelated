// Business Documents Routes
// CRUD operations and document management

import express, { Router, Request, Response } from 'express'
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/error-handler'
import { requirePermission, requireRole } from '../middleware/auth'
import { BusinessDocument } from '../../lib/database/mongodb/schemas'
import { getPostgresPool } from '../../lib/database/connection'
import * as documentService from '../services/document-service'

const router: Router = express.Router()

// ============================================================================
// CREATE DOCUMENT
// ============================================================================

router.post(
    '/',
    requirePermission('edit'),
    asyncHandler(async (req: Request, res: Response) => {
        const { title, type, category, content, description } = req.body

        // Validation
        if (!title || !type || !category) {
            throw new ValidationError('Missing required fields: title, type, category')
        }

        // Create document
        const document = await documentService.createDocument(
            {
                title,
                type,
                category,
                content,
                description,
                owner: req.user!.id
            },
            req.user!.id
        )

        res.status(201).json({
            success: true,
            data: document
        })
    })
)

// ============================================================================
// LIST DOCUMENTS
// ============================================================================

router.get(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
        const { page = 1, limit = 20, status, type, category, search } = req.query

        const pageNum = Math.max(1, parseInt(page as string) || 1)
        const pageLimit = Math.min(100, parseInt(limit as string) || 20)
        const skip = (pageNum - 1) * pageLimit

        // Build query filter
        const filter: any = {
            $or: [
                { owner: req.user!.id },
                { 'permissions.view': req.user!.id },
                { 'permissions.edit': req.user!.id }
            ]
        }

        if (status) filter.status = status
        if (type) filter.type = type
        if (category) filter.category = category

        if (search) {
            filter.$text = { $search: search }
        }

        // Query
        const documents = await BusinessDocument.find(filter)
            .skip(skip)
            .limit(pageLimit)
            .sort({ updatedAt: -1 })
            .lean()

        const total = await BusinessDocument.countDocuments(filter)

        res.json({
            success: true,
            data: documents,
            pagination: {
                page: pageNum,
                limit: pageLimit,
                total,
                pages: Math.ceil(total / pageLimit)
            }
        })
    })
)

// ============================================================================
// GET SINGLE DOCUMENT
// ============================================================================

router.get(
    '/:documentId',
    asyncHandler(async (req: Request, res: Response) => {
        const { documentId } = req.params

        const document = await documentService.getDocument(documentId, req.user!.id)

        if (!document) {
            throw new NotFoundError('Document', documentId)
        }

        res.json({
            success: true,
            data: document
        })
    })
)

// ============================================================================
// UPDATE DOCUMENT
// ============================================================================

router.put(
    '/:documentId',
    requirePermission('edit'),
    asyncHandler(async (req: Request, res: Response) => {
        const { documentId } = req.params
        const { title, content, status, description } = req.body

        const document = await documentService.updateDocument(
            documentId,
            {
                title,
                content,
                status,
                description
            },
            req.user!.id
        )

        if (!document) {
            throw new NotFoundError('Document', documentId)
        }

        res.json({
            success: true,
            data: document
        })
    })
)

// ============================================================================
// DELETE DOCUMENT
// ============================================================================

router.delete(
    '/:documentId',
    requireRole(['admin', 'manager']),
    asyncHandler(async (req: Request, res: Response) => {
        const { documentId } = req.params

        const deleted = await documentService.deleteDocument(
            documentId,
            req.user!.id
        )

        if (!deleted) {
            throw new NotFoundError('Document', documentId)
        }

        res.json({
            success: true,
            message: 'Document deleted successfully'
        })
    })
)

// ============================================================================
// SHARE DOCUMENT
// ============================================================================

router.post(
    '/:documentId/share',
    asyncHandler(async (req: Request, res: Response) => {
        const { documentId } = req.params
        const { sharedWith, permissionLevel } = req.body

        if (!sharedWith || !permissionLevel) {
            throw new ValidationError('Missing required fields: sharedWith, permissionLevel')
        }

        const document = await documentService.shareDocument(
            documentId,
            sharedWith,
            permissionLevel,
            req.user!.id
        )

        res.json({
            success: true,
            data: document
        })
    })
)

// ============================================================================
// ADD COMMENT
// ============================================================================

router.post(
    '/:documentId/comments',
    asyncHandler(async (req: Request, res: Response) => {
        const { documentId } = req.params
        const { content, parentCommentId } = req.body

        if (!content) {
            throw new ValidationError('Comment content is required')
        }

        const pool = getPostgresPool()
        const result = await pool.query(
            `INSERT INTO comments (document_id, author_id, content, parent_comment_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, content, author_id, created_at`,
            [documentId, req.user!.id, content, parentCommentId || null]
        )

        res.status(201).json({
            success: true,
            data: result.rows[0]
        })
    })
)

// ============================================================================
// GET DOCUMENT COMMENTS
// ============================================================================

router.get(
    '/:documentId/comments',
    asyncHandler(async (req: Request, res: Response) => {
        const { documentId } = req.params

        const pool = getPostgresPool()
        const result = await pool.query(
            `SELECT c.id, c.content, c.author_id, u.name as author_name, c.created_at, c.resolved
       FROM comments c
       JOIN users u ON c.author_id = u.id
       WHERE c.document_id = $1
       ORDER BY c.created_at DESC`,
            [documentId]
        )

        res.json({
            success: true,
            data: result.rows
        })
    })
)

// ============================================================================
// DOCUMENT HISTORY / VERSIONS
// ============================================================================

router.get(
    '/:documentId/versions',
    asyncHandler(async (req: Request, res: Response) => {
        const { documentId } = req.params

        const pool = getPostgresPool()
        const result = await pool.query(
            `SELECT id, version_number, title, created_by, created_at, change_summary
       FROM document_versions
       WHERE document_id = $1
       ORDER BY version_number DESC`,
            [documentId]
        )

        res.json({
            success: true,
            data: result.rows
        })
    })
)

// ============================================================================
// EXPORT DOCUMENT
// ============================================================================

router.get(
    '/:documentId/export',
    asyncHandler(async (req: Request, res: Response) => {
        const { documentId } = req.params
        const { format = 'json' } = req.query

        const document = await documentService.getDocument(documentId, req.user!.id)

        if (!document) {
            throw new NotFoundError('Document', documentId)
        }

        if (format === 'md') {
            res.setHeader('Content-Type', 'text/markdown')
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="${document.slug}.md"`
            )
            res.send(document.content.markdown)
        } else {
            res.setHeader('Content-Type', 'application/json')
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="${document.slug}.json"`
            )
            res.json(document)
        }
    })
)

export default router
