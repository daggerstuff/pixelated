// Business Documents Routes
// CRUD operations and document management

import express, { Router, Request, Response } from 'express'

import { getPostgresPool } from '../../lib/database/connection'
// COMMENTED OUT: Legacy auth middleware - using Astro Auth0 instead
// import { requirePermission, requireRole } from '../middleware/auth'
import { BusinessDocument } from '../../lib/database/mongodb/schemas'
import {
  asyncHandler,
  NotFoundError,
  ValidationError,
} from '../middleware/error-handler'
import * as documentService from '../services/document-service'

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
    // Handle ParsedQs or other objects
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
// Helper to coerce Express param/query to string
const coerceString = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return coerceString(value[0])
  if (value && typeof value === 'object') {
    const vals = Object.values(value as Record<string, unknown>)
    if (vals.length > 0) return coerceString(vals[0])
    return ''
  }
  if (value !== undefined && value !== null) {
    return String(value as string | number | boolean)
  }
  return ''
}

// Typed request body interfaces
interface DocumentBody {
  title?: string
  type?: string
  category?: string
  content?: Record<string, unknown>
  description?: string
  status?: string
}

interface ShareBody {
  sharedWith?: string
  permissionLevel?: string
}

interface CommentBody {
  content?: string
  parentCommentId?: string
}

const router: Router = express.Router()

// ============================================================================
// CREATE DOCUMENT
// ============================================================================

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
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }
    const body = (req as unknown as { body: DocumentBody }).body
    const { title, type, category, content, description } = body

    // Validation
    if (!title || !type || !category) {
      throw new ValidationError(
        'Missing required fields: title, type, category',
      )
    }

    // Create document
    const document = await documentService.createDocument(
    const document = (await documentService.createDocument(
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
    )) as unknown

    res.status(201).json({
      success: true,
      data: document,
    })
  }),
)

// ============================================================================
// LIST DOCUMENTS
// ============================================================================

router.get(
  '/',
  asyncHandler(async (req: unknown, res: unknown) => {
    const expressReq = req as Request
    const expressRes = res as Response
    const userId = expressReq.user?.id
    if (!userId) {
      expressRes.status(401).json({ success: false, error: 'Unauthorized' })
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
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
    } = req.query as Record<string, unknown>

    const page = coerceString(pageQuery)
    const limit = coerceString(limitQuery)
    const search = coerceString(searchQuery)

    const pageNum = Math.max(1, parseInt(page) || 1)
    const pageLimit = Math.min(100, parseInt(limit) || 20)
    const skip = (pageNum - 1) * pageLimit

    // Build query filter
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

    // Query
    const documents = await BusinessDocument.find(filter)
      .skip(skip)
      .limit(pageLimit)
      .sort({ updatedAt: -1 })
      .lean()

    const total = await BusinessDocument.countDocuments(filter)

    expressRes.json({
    // Query — cast Mongoose model to avoid no-unsafe on chain methods
    const DocModel = BusinessDocument as unknown as {
      find(f: Record<string, unknown>): {
        skip(n: number): { limit(n: number): { sort(o: Record<string, number>): { lean(): Promise<unknown[]> } } }
      }
      countDocuments(f: Record<string, unknown>): Promise<number>
    }

    const documents = await DocModel.find(filter)
      .skip(skip)
      .limit(pageLimit)
      .sort({ updatedAt: -1 })
      .lean()

    const total = await DocModel.countDocuments(filter)

    res.json({
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

// ============================================================================
// GET SINGLE DOCUMENT
// ============================================================================

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
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }
    const documentId = coerceString(req.params['documentId'])

    const document = (await documentService.getDocument(documentId, userId)) as unknown

    if (!document) {
      throw new NotFoundError('Document', documentId)
    }

    expressRes.json({
    res.json({
      success: true,
      data: document,
    })
  }),
)

// ============================================================================
// UPDATE DOCUMENT
// ============================================================================

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
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }
    const documentId = coerceString(req.params['documentId'])
    const body = (req as unknown as { body: DocumentBody }).body
    const { title, content, status, description } = body

    const document = (await documentService.updateDocument(
      documentId,
      {
        title,
        content: content,
        status: status as Parameters<
          typeof documentService.updateDocument
        >[1]['status'],
        description,
      },
      userId,
    )) as unknown

    if (!document) {
      throw new NotFoundError('Document', documentId)
    }

    expressRes.json({
    res.json({
      success: true,
      data: document,
    })
  }),
)

// ============================================================================
// DELETE DOCUMENT
// ============================================================================

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
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }
    const documentId = coerceString(req.params['documentId'])

    const deleted = await documentService.deleteDocument(documentId, userId)

    if (!deleted) {
      throw new NotFoundError('Document', documentId)
    }

    expressRes.json({
    res.json({
      success: true,
      message: 'Document deleted successfully',
    })
  }),
)

// ============================================================================
// SHARE DOCUMENT
// ============================================================================

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
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }
    const documentId = coerceString(req.params['documentId'])
    const body = (req as unknown as { body: ShareBody }).body
    const { sharedWith, permissionLevel } = body

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
    const document = (await documentService.shareDocument(
      documentId,
      sharedWith,
      permissionLevel as Parameters<typeof documentService.shareDocument>[2],
      userId,
    )) as unknown

    res.json({
      success: true,
      data: document,
    })
  }),
)

// ============================================================================
// ADD COMMENT
// ============================================================================

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
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }
    const documentId = coerceString(req.params['documentId'])
    const body = (req as unknown as { body: CommentBody }).body
    const { content, parentCommentId } = body

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
    res.status(201).json({
      success: true,
      data: result.rows[0],
    })
  }),
)

// ============================================================================
// GET DOCUMENT COMMENTS
// ============================================================================

router.get(
  '/:documentId/comments',
  asyncHandler(async (req: unknown, res: unknown) => {
    const expressReq = req as Request
    const expressRes = res as Response
    const documentId = ensureString(expressReq.params['documentId'])
  asyncHandler(async (req: Request, res: Response) => {
    const documentId = coerceString(req.params['documentId'])

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
    res.json({
      success: true,
      data: result.rows,
    })
  }),
)

// ============================================================================
// DOCUMENT HISTORY / VERSIONS
// ============================================================================

router.get(
  '/:documentId/versions',
  asyncHandler(async (req: unknown, res: unknown) => {
    const expressReq = req as Request
    const expressRes = res as Response
    const documentId = ensureString(expressReq.params['documentId'])
  asyncHandler(async (req: Request, res: Response) => {
    const documentId = coerceString(req.params['documentId'])

    const pool = getPostgresPool()
    const result = await pool.query(
      `SELECT id, version_number, title, created_by, created_at, change_summary
       FROM document_versions
       WHERE document_id = $1
       ORDER BY version_number DESC`,
      [documentId],
    )

    expressRes.json({
    res.json({
      success: true,
      data: result.rows,
    })
  }),
)

// ============================================================================
// EXPORT DOCUMENT
// ============================================================================

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
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }
    const documentId = coerceString(req.params['documentId'])
    const formatQuery = (req.query as Record<string, unknown>)['format']
    const format = coerceString(formatQuery) || 'json'

    const document = (await documentService.getDocument(documentId, userId)) as unknown as {
      slug?: string
      content?: { markdown?: string }
    } | null

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
      res.setHeader('Content-Type', 'text/markdown')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${document.slug}.md"`,
      )
      const markdownContent: string | undefined = document.content?.markdown
      if (!markdownContent) {
        throw new NotFoundError('Document content', documentId)
      }
      res.send(markdownContent)
    } else {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${document.slug}.json"`,
      )
      res.json(document)
    }
  }),
)

export default router
