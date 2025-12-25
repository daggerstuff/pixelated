import { Router } from 'express'
import { DocumentService } from '@/services/documentService'
import {
  authenticateToken,
  AuthenticatedRequest,
  requireCreator,
} from '@/middleware/auth'
import {
  DocumentCreate,
  DocumentUpdate,
  DocumentCategory,
  DocumentStatus,
} from '@/types/document'

const router = Router()

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
    } catch (error) {
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
    const filters = {
      category: req.query.category as DocumentCategory,
      status: req.query.status as DocumentStatus,
      authorId: req.query.authorId as string,
      tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
      searchTerm: req.query.search as string,
    }

    const result = await DocumentService.getDocuments(filters)
    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
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
      const document = await DocumentService.getDocument(req.params.id)
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
    } catch (error) {
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
      const updates: DocumentUpdate = req.body
      const userId = req.user!.userId

      const document = await DocumentService.updateDocument(
        req.params.id,
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
    } catch (error) {
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
      const userId = req.user!.userId
      const success = await DocumentService.deleteDocument(
        req.params.id,
        userId,
      )

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
    } catch (error) {
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
      const { userId: collaboratorId } = req.body
      const requesterId = req.user!.userId

      const document = await DocumentService.addCollaborator(
        req.params.id,
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
    } catch (error) {
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
      const requesterId = req.user!.userId
      const document = await DocumentService.removeCollaborator(
        req.params.id,
        req.params.userId,
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
    } catch (error) {
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
      const versions = await DocumentService.getDocumentVersions(req.params.id)
      res.json({
        success: true,
        data: versions,
      })
    } catch (error) {
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
      const version = parseInt(req.params.version)
      const documentVersion = await DocumentService.getDocumentVersion(
        req.params.id,
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
    } catch (error) {
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
      const userId = req.user!.userId
      const document = await DocumentService.publishDocument(
        req.params.id,
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
    } catch (error) {
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
      const userId = req.user!.userId
      const document = await DocumentService.archiveDocument(
        req.params.id,
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
    } catch (error) {
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
