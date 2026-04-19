import { Router } from 'express'

import {
  authenticateToken,
  AuthenticatedRequest,
  requireCreator,
} from '@/middleware/auth'
import { DocumentService } from '@/services/documentService'
import {
  DocumentCreate,
  DocumentUpdate,
  DocumentMetadata,
  DocumentCategory,
  DocumentStatus,
  DocumentSearchFilters,
} from '@/types/document'

const router = Router()

type DocumentRequest = AuthenticatedRequest<
  Record<string, string>,
  unknown,
  Record<string, unknown>
>

const parseStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined

  const items = value
  const validItems: string[] = []

  for (const item of items) {
    if (typeof item === 'string' && item.length > 0) {
      validItems.push(item)
    }
  }

  return validItems.length > 0 ? validItems : undefined
}

const isDocumentCategory = (value: unknown): value is DocumentCategory =>
  value === DocumentCategory.BUSINESS_PLAN ||
  value === DocumentCategory.MARKET_ANALYSIS ||
  value === DocumentCategory.COMPETITIVE_ANALYSIS ||
  value === DocumentCategory.MARKETING_STRATEGY ||
  value === DocumentCategory.FINANCIAL_PROJECTION ||
  value === DocumentCategory.OPERATIONS_PLAN ||
  value === DocumentCategory.EXECUTIVE_SUMMARY ||
  value === DocumentCategory.CUSTOM

const isDocumentStatus = (value: unknown): value is DocumentStatus =>
  value === DocumentStatus.DRAFT ||
  value === DocumentStatus.IN_REVIEW ||
  value === DocumentStatus.APPROVED ||
  value === DocumentStatus.PUBLISHED ||
  value === DocumentStatus.ARCHIVED

const parseMetadata = (value: unknown): Partial<DocumentMetadata> | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined
  }

  return value
}

const parseDocumentCreate = (body: Record<string, unknown>): DocumentCreate => {
  const title = typeof body['title'] === 'string' ? body['title'].trim() : ''
  const content = typeof body['content'] === 'string' ? body['content'].trim() : ''
  const category = isDocumentCategory(body['category']) ? body['category'] : undefined

  if (!title) {
    throw new Error('Title is required')
  }

  if (!content) {
    throw new Error('Content is required')
  }

  if (!category) {
    throw new Error('Category is required')
  }

  const createPayload: DocumentCreate = {
    title,
    content,
    category,
  }

  const summary = typeof body['summary'] === 'string' ? body['summary'].trim() : undefined
  if (summary !== undefined) {
    createPayload.summary = summary
  }

  const tags = parseStringArray(body['tags'])
  if (tags !== undefined) {
    createPayload.tags = tags
  }

  if (typeof body['parentDocumentId'] === 'string') {
    createPayload.parentDocumentId = body['parentDocumentId']
  }

  if (isDocumentStatus(body['status'])) {
    createPayload.status = body['status']
  }

  const collaborators = parseStringArray(body['collaborators'])
  if (collaborators !== undefined) {
    createPayload.collaborators = collaborators
  }

  const metadata = parseMetadata(body['metadata'])
  if (metadata !== undefined) {
    createPayload.metadata = metadata
  }

  return createPayload
}

const parseDocumentUpdate = (body: Record<string, unknown>): DocumentUpdate => {
  const updates: DocumentUpdate = {}

  if (typeof body['title'] === 'string' && body['title'].trim().length > 0) {
    updates.title = body['title'].trim()
  }

  if (typeof body['content'] === 'string' && body['content'].trim().length > 0) {
    updates.content = body['content'].trim()
  }

  if (typeof body['summary'] === 'string') {
    updates.summary = body['summary'].trim()
  }

  if (isDocumentCategory(body['category'])) {
    updates.category = body['category']
  }

  const tags = parseStringArray(body['tags'])
  if (tags) {
    updates.tags = tags
  }

  if (isDocumentStatus(body['status'])) {
    updates.status = body['status']
  }

  const metadata = parseMetadata(body['metadata'])
  if (metadata) {
    updates.metadata = metadata
  }

  return updates
}

const getRouteParam = (
  req: DocumentRequest,
  key: string,
): string | null => {
  const value = req.params[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

const getBodyString = (
  req: DocumentRequest,
  key: string,
): string | null => {
  const value = req.body[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

const getQueryString = (
  req: DocumentRequest,
  key: string,
): string | undefined => {
  const value = req.query[key]
  if (typeof value === 'string' && value.length > 0) {
    return value
  }

  if (Array.isArray(value)) {
    const firstValue = value[0]
    return typeof firstValue === 'string' && firstValue.length > 0
      ? firstValue
      : undefined
  }

  return undefined
}

// Create new document
router.post(
  '/',
  authenticateToken,
  requireCreator,
  async (req: DocumentRequest, res) => {
    try {
      const documentData = parseDocumentCreate(req.body)
      const authorId = req.user!.userId

      const document = await DocumentService.createDocument(
        documentData,
        authorId,
      )
      res.status(201).json({
        success: true,
        data: document,
      })
    } catch (error: unknown) {
      res.status(400).json({
        success: false,
        error: {
          message:
            error instanceof Error
              ? error.message
              : 'Failed to create document',
        },
      })
    }
  },
)

// Get all documents with filters
router.get('/', authenticateToken, async (req: DocumentRequest, res) => {
  try {
    const filters: DocumentSearchFilters = {}
    const category = getQueryString(req, 'category')
    const status = getQueryString(req, 'status')
    const authorId = getQueryString(req, 'authorId')
    const tags = getQueryString(req, 'tags')
    const searchTerm = getQueryString(req, 'search')

    if (isDocumentCategory(category)) {
      filters.category = category
    }

    if (isDocumentStatus(status)) {
      filters.status = status
    }

    if (authorId) {
      filters.authorId = authorId
    }

    if (tags) {
      filters.tags = tags.split(',')
    }

    if (searchTerm) {
      filters.searchTerm = searchTerm
    }

    const result = await DocumentService.getDocuments(filters)
    res.json({
      success: true,
      data: result,
    })
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      error: {
        message:
          error instanceof Error ? error.message : 'Failed to fetch documents',
      },
    })
  }
})

// Get document by ID
router.get(
  '/:id',
  authenticateToken,
  async (req: DocumentRequest, res) => {
    try {
      const documentId = getRouteParam(req, 'id')
      if (!documentId) {
        res.status(400).json({
          success: false,
          error: { message: 'Document ID is required' },
        })
        return
      }

      const document = await DocumentService.getDocument(documentId)
      if (!document) {
        res.status(404).json({
          success: false,
          error: { message: 'Document not found' },
        })
        return
      }

      res.json({
        success: true,
        data: document,
      })
    } catch (error: unknown) {
      res.status(500).json({
        success: false,
        error: {
          message:
            error instanceof Error ? error.message : 'Failed to fetch document',
        },
      })
    }
  },
)

// Update document
router.put(
  '/:id',
  authenticateToken,
  requireCreator,
  async (req: DocumentRequest, res) => {
    try {
      const documentId = getRouteParam(req, 'id')
      if (!documentId) {
        res.status(400).json({
          success: false,
          error: { message: 'Document ID is required' },
        })
        return
      }

      const updates = parseDocumentUpdate(req.body)
      const userId = req.user!.userId

      const document = await DocumentService.updateDocument(
        documentId,
        updates,
        userId,
      )
      if (!document) {
        res.status(404).json({
          success: false,
          error: { message: 'Document not found' },
        })
        return
      }

      res.json({
        success: true,
        data: document,
      })
    } catch (error: unknown) {
      res.status(400).json({
        success: false,
        error: {
          message:
            error instanceof Error
              ? error.message
              : 'Failed to update document',
        },
      })
    }
  },
)

// Delete document
router.delete(
  '/:id',
  authenticateToken,
  async (req: DocumentRequest, res) => {
    try {
      const documentId = getRouteParam(req, 'id')
      if (!documentId) {
        res.status(400).json({
          success: false,
          error: { message: 'Document ID is required' },
        })
        return
      }

      const userId = req.user!.userId
      const success = await DocumentService.deleteDocument(documentId, userId)

      if (!success) {
        res.status(404).json({
          success: false,
          error: { message: 'Document not found' },
        })
        return
      }

      res.json({
        success: true,
        message: 'Document deleted successfully',
      })
    } catch (error: unknown) {
      res.status(400).json({
        success: false,
        error: {
          message:
            error instanceof Error
              ? error.message
              : 'Failed to delete document',
        },
      })
    }
  },
)

// Add collaborator to document
router.post(
  '/:id/collaborators',
  authenticateToken,
  async (req: DocumentRequest, res) => {
    try {
      const documentId = getRouteParam(req, 'id')
      if (!documentId) {
        res.status(400).json({
          success: false,
          error: { message: 'Document ID is required' },
        })
        return
      }

      const collaboratorId = getBodyString(req, 'userId')
      if (!collaboratorId) {
        res.status(400).json({
          success: false,
          error: { message: 'Collaborator user ID is required' },
        })
        return
      }

      const requesterId = req.user!.userId

      const document = await DocumentService.addCollaborator(
        documentId,
        collaboratorId,
        requesterId,
      )
      if (!document) {
        res.status(404).json({
          success: false,
          error: { message: 'Document not found' },
        })
        return
      }

      res.json({
        success: true,
        data: document,
      })
    } catch (error: unknown) {
      res.status(400).json({
        success: false,
        error: {
          message:
            error instanceof Error
              ? error.message
              : 'Failed to add collaborator',
        },
      })
    }
  },
)

// Remove collaborator from document
router.delete(
  '/:id/collaborators/:userId',
  authenticateToken,
  async (req: DocumentRequest, res) => {
    try {
      const documentId = getRouteParam(req, 'id')
      if (!documentId) {
        res.status(400).json({
          success: false,
          error: { message: 'Document ID is required' },
        })
        return
      }

      const collaboratorId = getRouteParam(req, 'userId')
      if (!collaboratorId) {
        res.status(400).json({
          success: false,
          error: { message: 'Collaborator user ID is required' },
        })
        return
      }

      const requesterId = req.user!.userId
      const document = await DocumentService.removeCollaborator(
        documentId,
        collaboratorId,
        requesterId,
      )

      if (!document) {
        res.status(404).json({
          success: false,
          error: { message: 'Document not found' },
        })
        return
      }

      res.json({
        success: true,
        data: document,
      })
    } catch (error: unknown) {
      res.status(400).json({
        success: false,
        error: {
          message:
            error instanceof Error
              ? error.message
              : 'Failed to remove collaborator',
        },
      })
    }
  },
)

// Get document versions
router.get(
  '/:id/versions',
  authenticateToken,
  async (req: DocumentRequest, res) => {
    try {
      const documentId = getRouteParam(req, 'id')
      if (!documentId) {
        res.status(400).json({
          success: false,
          error: { message: 'Document ID is required' },
        })
        return
      }

      const versions = await DocumentService.getDocumentVersions(documentId)
      res.json({
        success: true,
        data: versions,
      })
    } catch (error: unknown) {
      res.status(500).json({
        success: false,
        error: {
          message:
            error instanceof Error
              ? error.message
              : 'Failed to fetch document versions',
        },
      })
    }
  },
)

// Get specific document version
router.get(
  '/:id/versions/:version',
  authenticateToken,
  async (req: DocumentRequest, res) => {
    try {
      const documentId = getRouteParam(req, 'id')
      if (!documentId) {
        res.status(400).json({
          success: false,
          error: { message: 'Document ID is required' },
        })
        return
      }

      const versionParam = getRouteParam(req, 'version')
      if (!versionParam) {
        res.status(400).json({
          success: false,
          error: { message: 'Document version is required' },
        })
        return
      }

      const version = Number.parseInt(versionParam, 10)
      if (Number.isNaN(version)) {
        res.status(400).json({
          success: false,
          error: { message: 'Document version must be a number' },
        })
        return
      }

      const documentVersion = await DocumentService.getDocumentVersion(
        documentId,
        version,
      )

      if (!documentVersion) {
        res.status(404).json({
          success: false,
          error: { message: 'Document version not found' },
        })
        return
      }

      res.json({
        success: true,
        data: documentVersion,
      })
    } catch (error: unknown) {
      res.status(500).json({
        success: false,
        error: {
          message:
            error instanceof Error
              ? error.message
              : 'Failed to fetch document version',
        },
      })
    }
  },
)

// Publish document
router.put(
  '/:id/publish',
  authenticateToken,
  requireCreator,
  async (req: DocumentRequest, res) => {
    try {
      const documentId = getRouteParam(req, 'id')
      if (!documentId) {
        res.status(400).json({
          success: false,
          error: { message: 'Document ID is required' },
        })
        return
      }

      const userId = req.user!.userId
      const document = await DocumentService.publishDocument(documentId, userId)

      if (!document) {
        res.status(404).json({
          success: false,
          error: { message: 'Document not found' },
        })
        return
      }

      res.json({
        success: true,
        data: document,
      })
    } catch (error: unknown) {
      res.status(400).json({
        success: false,
        error: {
          message:
            error instanceof Error
              ? error.message
              : 'Failed to publish document',
        },
      })
    }
  },
)

// Archive document
router.put(
  '/:id/archive',
  authenticateToken,
  async (req: DocumentRequest, res) => {
    try {
      const documentId = getRouteParam(req, 'id')
      if (!documentId) {
        res.status(400).json({
          success: false,
          error: { message: 'Document ID is required' },
        })
        return
      }

      const userId = req.user!.userId
      const document = await DocumentService.archiveDocument(documentId, userId)

      if (!document) {
        res.status(404).json({
          success: false,
          error: { message: 'Document not found' },
        })
        return
      }

      res.json({
        success: true,
        data: document,
      })
    } catch (error: unknown) {
      res.status(400).json({
        success: false,
        error: {
          message:
            error instanceof Error
              ? error.message
              : 'Failed to archive document',
        },
      })
    }
  },
)

export { router as documentRouter }
