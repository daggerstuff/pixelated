import { Router, type Request } from 'express'
import { Pool } from 'pg'

import { uploadConfig } from '../middleware/upload.js'
import { DocumentVersioningService } from '../services/DocumentVersioningService.js'
import { FileStorageService } from '../services/FileStorageService.js'

interface FileMetadata {
  id: string
  originalName: string
  fileName: string
  mimeType: string
  size: number
  url: string
  thumbnailUrl?: string
  uploadedBy: string
  uploadedAt: Date
  folderId?: string
  version: number
  isPublic: boolean
  tags: string[]
  metadata: Record<string, unknown>
}

interface FileRecord {
  id: string
  original_name: string
  file_name: string
  mime_type: string
  size: number
  url: string
  thumbnail_url?: string | null
  uploaded_by: string
  uploaded_at: Date
  folder_id?: string | null
  version: number
  is_public: boolean
  tags?: string[] | null
  metadata?: Record<string, unknown> | null
}

interface UploadFileVersionBody {
  originalFileId?: string
  changes?: string
}

interface PresignedUploadBody {
  fileName?: string
  mimeType?: string
  folder?: string
  isPublic?: boolean | string
}

interface CreateFolderBody {
  name: string
  parentId?: string
}

const router = Router()

const parseQueryNumber = (value: unknown, fallback: number): number => {
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10)
    return Number.isNaN(parsed) ? fallback : parsed
  }
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    typeof value[0] === 'string'
  ) {
    const parsed = parseInt(value[0], 10)
    return Number.isNaN(parsed) ? fallback : parsed
  }
  return fallback
}

const parseQueryString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value
  }
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    typeof value[0] === 'string'
  ) {
    return value[0]
  }
  return undefined
}

const parseStringArrayQuery = (value: unknown): string[] => {
  if (typeof value === 'string') {
    return [value]
  }
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string')
  }
  return []
}

const parseBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true'
  }
  return fallback
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

const toRecord = (value: unknown): Record<string, unknown> => {
  if (isRecord(value)) {
    return value
  }
  return {}
}

const fileRecordToMetadata = (row: FileRecord): FileMetadata => ({
  id: row.id,
  originalName: row.original_name,
  fileName: row.file_name,
  mimeType: row.mime_type,
  size: row.size,
  url: row.url,
  thumbnailUrl: row.thumbnail_url ?? undefined,
  uploadedBy: row.uploaded_by,
  uploadedAt: row.uploaded_at,
  folderId: row.folder_id ?? undefined,
  version: row.version,
  isPublic: row.is_public,
  tags: row.tags ?? [],
  metadata: toRecord(row.metadata),
})

export function createFileRoutes(db: Pool) {
  const fileStorage = new FileStorageService()
  const versioningService = new DocumentVersioningService(db)

  // Upload new file
  router.post(
    '/upload',
    uploadConfig.businessFiles.single('file'),
    async (
      req: Request<Record<string, string>, unknown, UploadFileVersionBody>,
      res,
    ) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'No file provided' })
        }

        const userId = req.user?.id ?? 'anonymous'
        const { originalFileId, changes } = req.body

        const result = await versioningService.createFileVersion(
          req.file,
          userId,
          originalFileId,
          changes,
        )

        return res.json({
          success: true,
          file: result.file,
          version: result.version,
        })
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error instanceof Error
              ? error.message
              : 'Unknown error'
            : 'Unknown error'
        return res.status(500).json({ error: message })
      }
    },
  )

  // Get presigned upload URL
  router.post(
    '/presigned-upload',
    async (
      req: Request<Record<string, string>, unknown, PresignedUploadBody>,
      res,
    ) => {
      try {
        const { fileName, mimeType, folder, isPublic = false } = req.body
        const userId = req.user?.id ?? 'anonymous'
        const isPublicFlag = parseBoolean(isPublic)

        const presignedUrl = await fileStorage.getPresignedUploadUrl(
          fileName ?? '',
          mimeType ?? '',
          userId,
          {
            folder,
            isPublic: isPublicFlag,
          },
        )

        return res.json(presignedUrl)
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error instanceof Error
              ? error.message
              : 'Unknown error'
            : 'Unknown error'
        return res.status(500).json({ error: message })
      }
    },
  )

  // Get file version history
  router.get('/:fileId/versions', async (req, res) => {
    try {
      const fileId = req.params['fileId']
      if (!fileId) {
        return res.status(400).json({ error: 'File ID is required' })
      }
      const userId = req.user?.id ?? 'anonymous'

      const history = await versioningService.getVersionHistory(fileId)

      // Check permissions
      if (history.file.uploadedBy !== userId && !history.file.isPublic) {
        return res.status(403).json({ error: 'Access denied' })
      }

      return res.json(history)
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Unknown error'
      return res.status(500).json({ error: message })
    }
  })

  // Get specific file version
  router.get('/:fileId/versions/:version', async (req, res) => {
    try {
      const fileId = req.params['fileId']
      const version = req.params['version']
      if (!fileId || !version) {
        return res
          .status(400)
          .json({ error: 'File ID and version are required' })
      }

      const versionNumber = parseInt(version, 10)
      if (Number.isNaN(versionNumber)) {
        return res.status(400).json({ error: 'Invalid version number' })
      }

      const versionRecord = await versioningService.getFileVersion(
        fileId,
        versionNumber,
      )
      if (!versionRecord) {
        return res.status(404).json({ error: 'Version not found' })
      }

      return res.json(versionRecord)
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Unknown error'
      return res.status(500).json({ error: message })
    }
  })

  // Download file version
  router.get('/:fileId/versions/:version/download', async (req, res) => {
    try {
      const fileId = req.params['fileId']
      const version = req.params['version']
      if (!fileId || !version) {
        return res
          .status(400)
          .json({ error: 'File ID and version are required' })
      }

      const versionNumber = parseInt(version, 10)
      if (Number.isNaN(versionNumber)) {
        return res.status(400).json({ error: 'Invalid version number' })
      }

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

      return res.json({ downloadUrl })
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Unknown error'
      return res.status(500).json({ error: message })
    }
  })

  // Rollback to previous version
  router.post('/:fileId/versions/:version/rollback', async (req, res) => {
    try {
      const fileId = req.params['fileId']
      const version = req.params['version']
      if (!fileId || !version) {
        return res
          .status(400)
          .json({ error: 'File ID and version are required' })
      }
      const userId = req.user?.id ?? 'anonymous'
      const versionNumber = parseInt(version, 10)
      if (Number.isNaN(versionNumber)) {
        return res.status(400).json({ error: 'Invalid version number' })
      }

      const newVersion = await versioningService.rollbackToVersion(
        fileId,
        versionNumber,
        userId,
      )

      return res.json({
        success: true,
        version: newVersion,
      })
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Unknown error'
      return res.status(500).json({ error: message })
    }
  })

  // Delete file version
  router.delete('/:fileId/versions/:version', async (req, res) => {
    try {
      const fileId = req.params['fileId']
      const version = req.params['version']
      if (!fileId || !version) {
        return res
          .status(400)
          .json({ error: 'File ID and version are required' })
      }
      const userId = req.user?.id ?? 'anonymous'
      const versionNumber = parseInt(version, 10)
      if (Number.isNaN(versionNumber)) {
        return res.status(400).json({ error: 'Invalid version number' })
      }

      // Check if user has permission to delete
      const fileResult = await db.query<{ uploaded_by: string }>(
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

      return res.json({ success: true })
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Unknown error'
      return res.status(500).json({ error: message })
    }
  })

  // Create folder
  router.post(
    '/folders',
    async (
      req: Request<Record<string, string>, unknown, CreateFolderBody>,
      res,
    ) => {
      try {
        const { name, parentId } = req.body
        if (!name) {
          return res.status(400).json({ error: 'Folder name is required' })
        }
        const userId = req.user?.id ?? 'anonymous'

        const folderId = await versioningService.createFolder(
          name,
          userId,
          parentId,
        )

        return res.json({
          success: true,
          folderId,
        })
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error instanceof Error
              ? error.message
              : 'Unknown error'
            : 'Unknown error'
        return res.status(500).json({ error: message })
      }
    },
  )

  // Get folder contents
  router.get('/folders/:folderId/contents', async (req, res) => {
    try {
      const folderId = req.params['folderId']
      if (!folderId) {
        return res.status(400).json({ error: 'Folder ID is required' })
      }
      const userId = req.user?.id ?? 'anonymous'

      const contents = await versioningService.getFolderContents(
        folderId,
        userId,
      )

      return res.json(contents)
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Unknown error'
      return res.status(500).json({ error: message })
    }
  })

  // List user's files
  router.get('/user/:userId', async (req, res) => {
    try {
      const userId = req.params['userId']
      const folderId = parseQueryString(req.query['folderId'])
      const tags = parseStringArrayQuery(req.query['tags'])
      const limit = parseQueryNumber(req.query['limit'], 50)
      const offset = parseQueryNumber(req.query['offset'], 0)
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' })
      }

      let query = `
        SELECT f.* FROM files f
        WHERE f.uploaded_by = $1
      `
      const params: Array<string | number | string[]> = [userId]

      if (folderId) {
        query += ` AND f.folder_id = $${params.length + 1}`
        params.push(folderId)
      }

      if (tags.length > 0) {
        query += ` AND f.tags @> $${params.length + 1}`
        params.push(tags)
      }

      query += ` ORDER BY f.uploaded_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
      params.push(limit, offset)

      const result = await db.query<FileRecord>(query, params)
      const files: FileMetadata[] = result.rows.map((row) =>
        fileRecordToMetadata(row),
      )

      return res.json(files)
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Unknown error'
      return res.status(500).json({ error: message })
    }
  })

  // Search files
  router.get('/search', async (req, res) => {
    try {
      const q = parseQueryString(req.query['q'])
      const userId = parseQueryString(req.query['userId']) ?? 'anonymous'
      const mimeType = parseQueryString(req.query['mimeType'])
      const tags = parseStringArrayQuery(req.query['tags'])
      const limit = parseQueryNumber(req.query['limit'], 20)
      const offset = parseQueryNumber(req.query['offset'], 0)

      let query = `
        SELECT f.* FROM files f
        WHERE (f.is_public = TRUE OR f.uploaded_by = $1)
      `
      const params: Array<string | number | string[]> = [userId]

      if (q) {
        query += ` AND (f.original_name ILIKE $${params.length + 1} OR f.tags @> ARRAY[$${params.length + 2}])`
        params.push(`%${q}%`, q)
      }

      if (mimeType) {
        query += ` AND f.mime_type = $${params.length + 1}`
        params.push(mimeType)
      }

      if (tags.length > 0) {
        query += ` AND f.tags && $${params.length + 1}`
        params.push(tags)
      }

      query += ` ORDER BY f.uploaded_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
      params.push(limit, offset)

      const result = await db.query<FileRecord>(query, params)
      const files: FileMetadata[] = result.rows.map((row) =>
        fileRecordToMetadata(row),
      )

      return res.json(files)
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Unknown error'
      return res.status(500).json({ error: message })
    }
  })

  return router
}
