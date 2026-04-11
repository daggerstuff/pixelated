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
  DocumentCategory,
  DocumentStatus,
  DocumentSearchFilters,
} from '@/types/document'

const router = Router()

const getRouteParam = (
  req: AuthenticatedRequest,
  key: string,
): string | null => {
  const value = req.params[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

const getBodyString = (
  req: AuthenticatedRequest,
  key: string,
): string | null => {
  const value = req.body?.[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

const getQueryString = (
  req: AuthenticatedRequest,
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
  async (req: AuthenticatedRequest, res) => {
    try {
      const documentData: DocumentCreate = req.body
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
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const filters: DocumentSearchFilters = {}
    const category = getQueryString(req, 'category')
    const status = getQueryString(req, 'status')
    const authorId = getQueryString(req, 'authorId')
    const tags = getQueryString(req, 'tags')
    const searchTerm = getQueryString(req, 'search')

    if (category) {
      filters.category = category as DocumentCategory
    }

    if (status) {
      filters.status = status as DocumentStatus
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
  async (req: AuthenticatedRequest, res) => {
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
  async (req: AuthenticatedRequest, res) => {
    try {
      const documentId = getRouteParam(req, 'id')
      if (!documentId) {
        res.status(400).json({
          success: false,
          error: { message: 'Document ID is required' },
        })
        return
      }

      const updates: DocumentUpdate = req.body
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
  async (req: AuthenticatedRequest, res) => {
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
  async (req: AuthenticatedRequest, res) => {
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
  async (req: AuthenticatedRequest, res) => {
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
  async (req: AuthenticatedRequest, res) => {
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
  async (req: AuthenticatedRequest, res) => {
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
  async (req: AuthenticatedRequest, res) => {
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
      const document = await DocumentService.publishDocument(
        documentId,
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
  async (req: AuthenticatedRequest, res) => {
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
      const document = await DocumentService.archiveDocument(
        documentId,
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
              : 'Failed to archive document',
        },
      })
    }
  },
)

export { router as documentRouter }
