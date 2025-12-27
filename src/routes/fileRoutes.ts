import { Router } from 'express'
import { uploadConfig } from '../middleware/upload.js'
import { FileStorageService } from '../services/FileStorageService.js'
import { DocumentVersioningService } from '../services/DocumentVersioningService.js'
import { Pool } from 'pg'

const router = Router()

export function createFileRoutes(db: Pool) {
  const fileStorage = new FileStorageService()
  const versioningService = new DocumentVersioningService(db)

  // Upload new file
  router.post(
    '/upload',
    uploadConfig.businessFiles.single('file'),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'No file provided' })
        }

        const userId = req.user?.id || 'anonymous'
        const { originalFileId, changes } = req.body

        const result = await versioningService.createFileVersion(
          req.file,
          userId,
          originalFileId || undefined,
          changes,
        )

        res.json({
          success: true,
          file: result.file,
          version: result.version,
        })
      } catch (error) {
        res.status(500).json({ error: error.message })
      }
    },
  )

  // Get presigned upload URL
  router.post('/presigned-upload', async (req, res) => {
    try {
      const { fileName, mimeType, folder, isPublic = false } = req.body
      const userId = req.user?.id || 'anonymous'

      const presignedUrl = await fileStorage.getPresignedUploadUrl(
        fileName,
        mimeType,
        userId,
        { folder, isPublic },
      )

      res.json(presignedUrl)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // Get file version history
  router.get('/:fileId/versions', async (req, res) => {
    try {
      const { fileId } = req.params
      const userId = req.user?.id || 'anonymous'

      const history = await versioningService.getVersionHistory(fileId)

      // Check permissions
      if (history.file.uploadedBy !== userId && !history.file.isPublic) {
        return res.status(403).json({ error: 'Access denied' })
      }

      res.json(history)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // Get specific file version
  router.get('/:fileId/versions/:version', async (req, res) => {
    try {
      const { fileId, version } = req.params
      const userId = req.user?.id || 'anonymous'
      const versionNumber = parseInt(version)

      const versionRecord = await versioningService.getFileVersion(
        fileId,
        versionNumber,
      )
      if (!versionRecord) {
        return res.status(404).json({ error: 'Version not found' })
      }

      res.json(versionRecord)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // Download file version
  router.get('/:fileId/versions/:version/download', async (req, res) => {
    try {
      const { fileId, version } = req.params
      const userId = req.user?.id || 'anonymous'
      const versionNumber = parseInt(version)

      const versionRecord = await versioningService.getFileVersion(
        fileId,
        versionNumber,
      )
      if (!versionRecord) {
        return res.status(404).json({ error: 'Version not found' })
      }

      // Generate presigned download URL
      const downloadUrl = await fileStorage.getPresignedDownloadUrl(
        versionRecord.s3Key,
      )

      res.json({ downloadUrl })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // Rollback to previous version
  router.post('/:fileId/versions/:version/rollback', async (req, res) => {
    try {
      const { fileId, version } = req.params
      const userId = req.user?.id || 'anonymous'
      const versionNumber = parseInt(version)

      const newVersion = await versioningService.rollbackToVersion(
        fileId,
        versionNumber,
        userId,
      )

      res.json({
        success: true,
        version: newVersion,
      })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // Delete file version
  router.delete('/:fileId/versions/:version', async (req, res) => {
    try {
      const { fileId, version } = req.params
      const userId = req.user?.id || 'anonymous'
      const versionNumber = parseInt(version)

      // Check if user has permission to delete
      const fileResult = await db.query(
        'SELECT uploaded_by FROM files WHERE id = $1',
        [fileId],
      )
      if (fileResult.rows.length === 0) {
        return res.status(404).json({ error: 'File not found' })
      }

      if (fileResult.rows[0].uploaded_by !== userId) {
        return res.status(403).json({ error: 'Access denied' })
      }

      await versioningService.deleteFileVersion(fileId, versionNumber)

      res.json({ success: true })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // Create folder
  router.post('/folders', async (req, res) => {
    try {
      const { name, parentId } = req.body
      const userId = req.user?.id || 'anonymous'

      const folderId = await versioningService.createFolder(
        name,
        userId,
        parentId,
      )

      res.json({
        success: true,
        folderId,
      })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // Get folder contents
  router.get('/folders/:folderId/contents', async (req, res) => {
    try {
      const { folderId } = req.params
      const userId = req.user?.id || 'anonymous'

      const contents = await versioningService.getFolderContents(
        folderId,
        userId,
      )

      res.json(contents)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // List user's files
  router.get('/user/:userId', async (req, res) => {
    try {
      const { userId } = req.params
      const { limit = 50, offset = 0, folderId, tags } = req.query

      let query = `
        SELECT f.* FROM files f
        WHERE f.uploaded_by = $1
      `
      const params = [userId]

      if (folderId) {
        query += ` AND f.folder_id = $${params.length + 1}`
        params.push(folderId as string)
      }

      if (tags && Array.isArray(tags)) {
        query += ` AND f.tags @> $${params.length + 1}`
        params.push(tags)
      }

      query += ` ORDER BY f.uploaded_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
      params.push(limit, offset)

      const result = await db.query(query, params)

      const files: FileMetadata[] = result.rows.map((row) => ({
        id: row.id,
        originalName: row.original_name,
        fileName: row.file_name,
        mimeType: row.mime_type,
        size: row.size,
        url: row.url,
        thumbnailUrl: row.thumbnail_url,
        uploadedBy: row.uploaded_by,
        uploadedAt: row.uploaded_at,
        folderId: row.folder_id,
        version: row.version,
        isPublic: row.is_public,
        tags: row.tags || [],
        metadata: row.metadata || {},
      }))

      res.json(files)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // Search files
  router.get('/search', async (req, res) => {
    try {
      const { q, userId, mimeType, tags, limit = 20, offset = 0 } = req.query

      let query = `
        SELECT f.* FROM files f
        WHERE (f.is_public = TRUE OR f.uploaded_by = $1)
      `
      const params = [userId || 'anonymous']

      if (q) {
        query += ` AND (f.original_name ILIKE $${params.length + 1} OR f.tags @> ARRAY[$${params.length + 2}])`
        params.push(`%${q}%`, q)
      }

      if (mimeType) {
        query += ` AND f.mime_type = $${params.length + 1}`
        params.push(mimeType as string)
      }

      if (tags && Array.isArray(tags)) {
        query += ` AND f.tags && $${params.length + 1}`
        params.push(tags)
      }

      query += ` ORDER BY f.uploaded_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
      params.push(limit, offset)

      const result = await db.query(query, params)

      const files: FileMetadata[] = result.rows.map((row) => ({
        id: row.id,
        originalName: row.original_name,
        fileName: row.file_name,
        mimeType: row.mime_type,
        size: row.size,
        url: row.url,
        thumbnailUrl: row.thumbnail_url,
        uploadedBy: row.uploaded_by,
        uploadedAt: row.uploaded_at,
        folderId: row.folder_id,
        version: row.version,
        isPublic: row.is_public,
        tags: row.tags || [],
        metadata: row.metadata || {},
      }))

      res.json(files)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  return router
}
