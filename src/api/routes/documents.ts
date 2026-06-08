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


    // Validation
    if (!title || !type || !category) {
      throw new ValidationError(
        'Missing required fields: title, type, category',
      )
    }

    // Create document
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


    if (!document) {
      throw new NotFoundError('Document', documentId)
    }

    expressRes.json({
      success: true,
      data: document,
    })
  }),
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
