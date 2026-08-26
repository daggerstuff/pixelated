// Business Documents Routes
// CRUD operations and document management

import express, { Router, Request, Response } from 'express'

import { getPostgresPool } from '../../lib/db/connection'
import { BusinessDocument } from '../../lib/db/mongodb/schemas'
import {
  asyncHandler,
  NotFoundError,
  ValidationError,
} from '../middleware/error-handler'
import * as documentService from '../lib/services/document-service'

// Temporary placeholder middleware - auth handled at Astro layer
const requirePermission =
  (_permission: string) => (_req: Request, _res: Response, next: () => void) =>
    next()
const requireRole =
  (_roles: string[]) => (_req: Request, _res: Response, next: () => void) =>
    next()

// Helper to ensure param is a string (Express types params as string | string[])
const ensureString = (param: unknown): string => {
  if (Array.isArray(param)) {
    return ensureString(param[0])
  }
  if (typeof param === 'string') {
    return param
  }
  if (param && typeof param === 'object') {
    const values = Object.values(param)
    if (values.length > 0) {
      const firstValue = values[0]
      return typeof firstValue === 'string'
        ? firstValue
        : typeof firstValue === 'object' && firstValue !== null
          ? String(firstValue)
          : String(firstValue ?? '')
    }
    return ''
  }
  return param !== undefined && param !== null ? String(param) : ''
}
const router: Router = express.Router()

router.post(
  '/',
  requirePermission('edit'),
  asyncHandler(async (req: unknown, res: unknown) => {
    const expressReq = req as Request
    const expressRes = res as Response
    const userId = expressReq.user?.id
    if (!userId) {
      expressRes.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }
    const { title, type, category, content, description } = expressReq.body

    if (!title || !type || !category) {
      throw new ValidationError(
        'Missing required fields: title, type, category',
      )
    }

    const document = await documentService.createDocument(
      {
        title,
        type,
        category,
        content,
        description,
        owner: userId,
      },
      userId,
    )

    expressRes.status(201).json({
      success: true,
      data: document,
    })
  }),
)

router.get(
  '/',
  asyncHandler(async (req: unknown, res: unknown) => {
    const expressReq = req as Request
    const expressRes = res as Response
    const userId = expressReq.user?.id
    if (!userId) {
      expressRes.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }
    const {
      page: pageQuery,
      limit: limitQuery,
      status,
      type,
      category,
      search: searchQuery,
    } = expressReq.query

    const page = ensureString(pageQuery)
    const limit = ensureString(limitQuery)
    const search = ensureString(searchQuery)

    const pageNum = Math.max(1, parseInt(page) || 1)
    const pageLimit = Math.min(100, parseInt(limit) || 20)
    const skip = (pageNum - 1) * pageLimit

    const filter: Record<string, unknown> = {
      $or: [
        { owner: userId },
        { 'permissions.view': userId },
        { 'permissions.edit': userId },
      ],
    }

    if (status) filter['status'] = status
    if (type) filter['type'] = type
    if (category) filter['category'] = category

    if (search) {
      filter['$text'] = { $search: search }
    }

    const documents = await BusinessDocument.find(filter)
      .skip(skip)
      .limit(pageLimit)
      .sort({ updatedAt: -1 })
      .lean()

    const total = await BusinessDocument.countDocuments(filter)

    expressRes.json({
      success: true,
      data: documents,
      pagination: {
        page: pageNum,
        limit: pageLimit,
        total,
        pages: Math.ceil(total / pageLimit),
      },
    })
  }),
)

router.get(
  '/:documentId',
  asyncHandler(async (req: unknown, res: unknown) => {
    const expressReq = req as Request
    const expressRes = res as Response
    const userId = expressReq.user?.id
    if (!userId) {
      expressRes.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }
    const documentId = ensureString(expressReq.params['documentId'])

    const document = await documentService.getDocument(documentId, userId)

    if (!document) {
      throw new NotFoundError('Document', documentId)
    }

    expressRes.json({
      success: true,
      data: document,
    })
  }),
)

router.put(
  '/:documentId',
  requirePermission('edit'),
  asyncHandler(async (req: unknown, res: unknown) => {
    const expressReq = req as Request
    const expressRes = res as Response
    const userId = expressReq.user?.id
    if (!userId) {
      expressRes.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }
    const documentId = ensureString(expressReq.params['documentId'])
    const { title, content, status, description } = expressReq.body

    const document = await documentService.updateDocument(
      documentId,
      {
        title,
        content,
        status,
        description,
      },
      userId,
    )

    if (!document) {
      throw new NotFoundError('Document', documentId)
    }

    expressRes.json({
      success: true,
      data: document,
    })
  }),
)

router.delete(
  '/:documentId',
  requireRole(['admin', 'manager']),
  asyncHandler(async (req: unknown, res: unknown) => {
    const expressReq = req as Request
    const expressRes = res as Response
    const userId = expressReq.user?.id
    if (!userId) {
      expressRes.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }
    const documentId = ensureString(expressReq.params['documentId'])

    const deleted = await documentService.deleteDocument(documentId, userId)

    if (!deleted) {
      throw new NotFoundError('Document', documentId)
    }

    expressRes.json({
      success: true,
      message: 'Document deleted successfully',
    })
  }),
)

router.post(
  '/:documentId/share',
  asyncHandler(async (req: unknown, res: unknown) => {
    const expressReq = req as Request
    const expressRes = res as Response
    const userId = expressReq.user?.id
    if (!userId) {
      expressRes.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }
    const documentId = ensureString(expressReq.params['documentId'])
    const { sharedWith, permissionLevel } = expressReq.body

    if (!sharedWith || !permissionLevel) {
      throw new ValidationError(
        'Missing required fields: sharedWith, permissionLevel',
      )
    }

    const document = await documentService.shareDocument(
      documentId,
      sharedWith,
      permissionLevel,
      userId,
    )

    expressRes.json({
      success: true,
      data: document,
    })
  }),
)

router.post(
  '/:documentId/comments',
  asyncHandler(async (req: unknown, res: unknown) => {
    const expressReq = req as Request
    const expressRes = res as Response
    const userId = expressReq.user?.id
    if (!userId) {
      expressRes.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }
    const documentId = ensureString(expressReq.params['documentId'])
    const { content, parentCommentId } = expressReq.body

    if (!content) {
      throw new ValidationError('Comment content is required')
    }

    const pool = getPostgresPool()
    const result = await pool.query(
      `INSERT INTO comments (document_id, author_id, content, parent_comment_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, content, author_id, created_at`,
      [documentId, userId, content, parentCommentId ?? null],
    )

    expressRes.status(201).json({
      success: true,
      data: result.rows[0],
    })
  }),
)

router.get(
  '/:documentId/comments',
  asyncHandler(async (req: unknown, res: unknown) => {
    const expressReq = req as Request
    const expressRes = res as Response
    const documentId = ensureString(expressReq.params['documentId'])

    const pool = getPostgresPool()
    const result = await pool.query(
      `SELECT c.id, c.content, c.author_id, u.name as author_name, c.created_at, c.resolved
       FROM comments c
       JOIN users u ON c.author_id = u.id
       WHERE c.document_id = $1
       ORDER BY c.created_at DESC`,
      [documentId],
    )

    expressRes.json({
      success: true,
      data: result.rows,
    })
  }),
)

router.get(
  '/:documentId/versions',
  asyncHandler(async (req: unknown, res: unknown) => {
    const expressReq = req as Request
    const expressRes = res as Response
    const documentId = ensureString(expressReq.params['documentId'])

    const pool = getPostgresPool()
    const result = await pool.query(
      `SELECT id, version_number, title, created_by, created_at, change_summary
       FROM document_versions
       WHERE document_id = $1
       ORDER BY version_number DESC`,
      [documentId],
    )

    expressRes.json({
      success: true,
      data: result.rows,
    })
  }),
)

router.get(
  '/:documentId/export',
  asyncHandler(async (req: unknown, res: unknown) => {
    const expressReq = req as Request
    const expressRes = res as Response
    const userId = expressReq.user?.id
    if (!userId) {
      expressRes.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }
    const documentId = ensureString(expressReq.params['documentId'])
    const { format: formatQuery = 'json' } = expressReq.query
    const format = ensureString(formatQuery)

    const document = await documentService.getDocument(documentId, userId)

    if (!document) {
      throw new NotFoundError('Document', documentId)
    }

    if (format === 'md') {
      expressRes.setHeader('Content-Type', 'text/markdown')
      expressRes.setHeader(
        'Content-Disposition',
        `attachment; filename="${document.slug}.md"`,
      )
      const markdownContent = document.content?.markdown
      if (!markdownContent) {
        throw new NotFoundError('Document content', documentId)
      }
      expressRes.send(markdownContent)
    } else {
      expressRes.setHeader('Content-Type', 'application/json')
      expressRes.setHeader(
        'Content-Disposition',
        `attachment; filename="${document.slug}.json"`,
      )
      expressRes.json(document)
    }
  }),
)

export default router
