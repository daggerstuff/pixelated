import { Pool } from 'pg'
import { v4 as uuidv4 } from 'uuid'
import { FileStorageService, FileMetadata } from './FileStorageService.js'

export interface DocumentVersion {
  id: string
  fileId: string
  version: number
  fileName: string
  size: number
  url: string
  s3Key: string
  uploadedAt: Date
  uploadedBy: string
  changes?: string
  checksum?: string
  isCurrent: boolean
}

export interface VersionHistory {
  file: FileMetadata
  versions: DocumentVersion[]
  currentVersion: DocumentVersion
}

export class DocumentVersioningService {
  private db: Pool
  private fileStorage: FileStorageService

  constructor(db: Pool) {
    this.db = db
    this.fileStorage = new FileStorageService()
  }

  async createFileVersion(
    file: Express.Multer.File,
    userId: string,
    originalFileId?: string,
    changes?: string,
  ): Promise<{ file: FileMetadata; version: DocumentVersion }> {
    const client = await this.db.connect()

    try {
      await client.query('BEGIN')

      let fileId: string
      let newVersion: number

      if (originalFileId) {
        // This is a new version of an existing file
        const currentVersionResult = await client.query(
          'SELECT MAX(version) as max_version FROM file_versions WHERE file_id = $1',
          [originalFileId],
        )
        newVersion = (currentVersionResult.rows[0]?.max_version || 0) + 1
        fileId = originalFileId

        // Update the original file record
        await client.query(
          'UPDATE files SET updated_at = NOW() WHERE id = $1',
          [fileId],
        )
      } else {
        // This is a new file
        fileId = uuidv4()
        newVersion = 1

        // Create file record
        await client.query(
          `INSERT INTO files (id, original_name, file_name, mime_type, size, url, uploaded_by, s3_key, version)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            fileId,
            file.originalname,
            file.originalname,
            file.mimetype,
            file.size,
            '',
            userId,
            '',
          ],
        )
      }

      // Upload file to S3
      const fileMetadata = await this.fileStorage.uploadFile(file, userId)

      // Create version record
      const versionId = uuidv4()
      await client.query(
        `INSERT INTO file_versions (id, file_id, version, file_name, size, url, s3_key, uploaded_by, changes, checksum, is_current)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)`,
        [
          versionId,
          fileId,
          newVersion,
          file.originalname,
          file.size,
          fileMetadata.url,
          fileMetadata.fileName,
          userId,
          changes || `Version ${newVersion}`,
          await this.generateChecksum(file.buffer),
        ],
      )

      await client.query('COMMIT')

      const versionRecord = await this.getFileVersion(fileId, newVersion)
      if (!versionRecord) {
        throw new Error('Failed to create file version')
      }

      return {
        file: {
          ...fileMetadata,
          id: fileId,
          uploadedBy: userId,
          version: newVersion,
        },
        version: versionRecord,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async getFileVersion(
    fileId: string,
    version: number,
  ): Promise<DocumentVersion | null> {
    const result = await this.db.query(
      'SELECT * FROM file_versions WHERE file_id = $1 AND version = $2',
      [fileId, version],
    )

    if (result.rows.length === 0) {
      return null
    }

    const row = result.rows[0]
    return {
      id: row.id,
      fileId: row.file_id,
      version: row.version,
      fileName: row.file_name,
      size: row.size,
      url: row.url,
      s3Key: row.s3_key,
      uploadedAt: row.uploaded_at,
      uploadedBy: row.uploaded_by,
      changes: row.changes,
      checksum: row.checksum,
      isCurrent: row.is_current,
    }
  }

  async getCurrentVersion(fileId: string): Promise<DocumentVersion | null> {
    const result = await this.db.query(
      'SELECT * FROM file_versions WHERE file_id = $1 AND is_current = TRUE',
      [fileId],
    )

    if (result.rows.length === 0) {
      return null
    }

    const row = result.rows[0]
    return {
      id: row.id,
      fileId: row.file_id,
      version: row.version,
      fileName: row.file_name,
      size: row.size,
      url: row.url,
      s3Key: row.s3_key,
      uploadedAt: row.uploaded_at,
      uploadedBy: row.uploaded_by,
      changes: row.changes,
      checksum: row.checksum,
      isCurrent: row.is_current,
    }
  }

  async getVersionHistory(fileId: string): Promise<VersionHistory> {
    const fileResult = await this.db.query(
      'SELECT * FROM files WHERE id = $1',
      [fileId],
    )

    if (fileResult.rows.length === 0) {
      throw new Error('File not found')
    }

    const fileRow = fileResult.rows[0]
    const file: FileMetadata = {
      id: fileRow.id,
      originalName: fileRow.original_name,
      fileName: fileRow.file_name,
      mimeType: fileRow.mime_type,
      size: fileRow.size,
      url: fileRow.url,
      thumbnailUrl: fileRow.thumbnail_url,
      uploadedBy: fileRow.uploaded_by,
      uploadedAt: fileRow.uploaded_at,
      folderId: fileRow.folder_id,
      version: fileRow.version,
      isPublic: fileRow.is_public,
      tags: fileRow.tags || [],
      metadata: fileRow.metadata || {},
    }

    const versionsResult = await this.db.query(
      'SELECT * FROM file_versions WHERE file_id = $1 ORDER BY version DESC',
      [fileId],
    )

    const versions: DocumentVersion[] = versionsResult.rows.map((row) => ({
      id: row.id,
      fileId: row.file_id,
      version: row.version,
      fileName: row.file_name,
      size: row.size,
      url: row.url,
      s3Key: row.s3_key,
      uploadedAt: row.uploaded_at,
      uploadedBy: row.uploaded_by,
      changes: row.changes,
      checksum: row.checksum,
      isCurrent: row.is_current,
    }))

    const currentVersion = versions.find((v) => v.isCurrent) || versions[0]

    return {
      file,
      versions,
      currentVersion: currentVersion,
    }
  }

  async rollbackToVersion(
    fileId: string,
    targetVersion: number,
    userId: string,
  ): Promise<DocumentVersion> {
    const client = await this.db.connect()

    try {
      await client.query('BEGIN')

      // Get the target version
      const targetVersionResult = await client.query(
        'SELECT * FROM file_versions WHERE file_id = $1 AND version = $2',
        [fileId, targetVersion],
      )

      if (targetVersionResult.rows.length === 0) {
        throw new Error('Target version not found')
      }

      const targetVersionRow = targetVersionResult.rows[0]

      // Create new version based on the target version
      const newVersion = await this.createFileVersionFromExisting(
        fileId,
        targetVersionRow.s3_key,
        userId,
        `Rolled back to version ${targetVersion}`,
      )

      await client.query('COMMIT')
      return newVersion
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async deleteFileVersion(fileId: string, version: number): Promise<void> {
    const client = await this.db.connect()

    try {
      await client.query('BEGIN')

      // Get the version to delete
      const versionResult = await client.query(
        'SELECT s3_key FROM file_versions WHERE file_id = $1 AND version = $2',
        [fileId, version],
      )

      if (versionResult.rows.length === 0) {
        throw new Error('Version not found')
      }

      const s3Key = versionResult.rows[0].s3_key

      // Delete from S3
      await this.fileStorage.deleteFile(s3Key)

      // Delete from database
      await client.query(
        'DELETE FROM file_versions WHERE file_id = $1 AND version = $2',
        [fileId, version],
      )

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async createFolder(
    name: string,
    userId: string,
    parentId?: string,
  ): Promise<string> {
    const folderId = uuidv4()

    await this.db.query(
      'INSERT INTO folders (id, name, parent_id, owner_id) VALUES ($1, $2, $3, $4)',
      [folderId, name, parentId || null, userId],
    )

    return folderId
  }

  async getFolderContents(
    folderId: string,
    userId: string,
  ): Promise<{
    files: FileMetadata[]
    folders: Array<{ id: string; name: string; fileCount: number }>
  }> {
    // Get files in folder
    const filesResult = await this.db.query(
      `SELECT f.*, fp.permission_type 
       FROM files f
       LEFT JOIN file_permissions fp ON f.id = fp.file_id AND fp.user_id = $2
       WHERE f.folder_id = $1 AND (f.is_public = TRUE OR f.uploaded_by = $2 OR fp.permission_type IS NOT NULL)
       ORDER BY f.uploaded_at DESC`,
      [folderId, userId],
    )

    const files: FileMetadata[] = filesResult.rows.map((row) => ({
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

    // Get subfolders
    const foldersResult = await this.db.query(
      `SELECT f.id, f.name, COUNT(files.id) as file_count
       FROM folders f
       LEFT JOIN files ON files.folder_id = f.id
       WHERE f.parent_id = $1 AND f.owner_id = $2
       GROUP BY f.id, f.name
       ORDER BY f.name`,
      [folderId, userId],
    )

    const folders = foldersResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      fileCount: parseInt(row.file_count),
    }))

    return { files, folders }
  }

  private async generateChecksum(buffer: Buffer): Promise<string> {
    // In a real implementation, you'd use crypto.createHash('sha256')
    // For now, return a mock checksum
    return 'mock-checksum-' + Math.random().toString(36).substring(2, 15)
  }

  private async createFileVersionFromExisting(
    fileId: string,
    s3Key: string,
    userId: string,
    changes?: string,
  ): Promise<DocumentVersion> {
    // This would download the file from S3 and re-upload it as a new version
    // For now, create a new version record
    const versionResult = await this.db.query(
      'SELECT MAX(version) as max_version FROM file_versions WHERE file_id = $1',
      [fileId],
    )
    const newVersion = (versionResult.rows[0]?.max_version || 0) + 1

    const versionId = uuidv4()
    await this.db.query(
      `INSERT INTO file_versions (id, file_id, version, file_name, size, url, s3_key, uploaded_by, changes, checksum, is_current)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)`,
      [
        versionId,
        fileId,
        newVersion,
        `version-${newVersion}`,
        0, // Size would be calculated from S3
        '', // URL would be generated
        s3Key,
        userId,
        changes || `Version ${newVersion}`,
        await this.generateChecksum(Buffer.from('')),
      ],
    )

    const newVersionRecord = await this.getFileVersion(fileId, newVersion)
    if (!newVersionRecord) {
      throw new Error('Failed to create file version from existing')
    }

    return newVersionRecord
  }
}
