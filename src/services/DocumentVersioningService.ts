import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
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
      await drizzle(client).execute(sql`BEGIN`)

      let fileId: string
      let newVersion: number

      if (originalFileId) {
        // This is a new version of an existing file
        const currentVersionResult = await drizzle(client).execute(sql`SELECT MAX(version) as max_version FROM file_versions WHERE file_id = ${originalFileId}`)
        newVersion = (currentVersionResult.rows[0]?.max_version || 0) + 1
        fileId = originalFileId

        // Update the original file record
        await drizzle(client).execute(sql`UPDATE files SET updated_at = NOW() WHERE id = ${fileId}`)
      } else {
        // This is a new file
        fileId = uuidv4()
        newVersion = 1

        // Create file record
        await drizzle(client).execute(
          sql`INSERT INTO files (id, original_name, file_name, mime_type, size, url, uploaded_by, s3_key, version)
           VALUES (${fileId}, ${file.originalname}, ${file.originalname}, ${file.mimetype}, ${file.size}, ${''}, ${userId}, ${''}, ${undefined})`
        )
      }

      // Upload file to S3
      const fileMetadata = await this.fileStorage.uploadFile(file, userId)

      // Create version record
      const versionId = uuidv4()
      await drizzle(client).execute(
        sql`INSERT INTO file_versions (id, file_id, version, file_name, size, url, s3_key, uploaded_by, changes, checksum, is_current)
         VALUES (${versionId}, ${fileId}, ${newVersion}, ${file.originalname}, ${file.size}, ${fileMetadata.url}, ${fileMetadata.fileName}, ${userId}, ${changes || `Version ${newVersion}`}, ${await this.generateChecksum(file.buffer)}, TRUE)`
      )

      await drizzle(client).execute(sql`COMMIT`)

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
      await drizzle(client).execute(sql`ROLLBACK`)
      throw error
    } finally {
      client.release()
    }
  }

  async getFileVersion(
    fileId: string,
    version: number,
  ): Promise<DocumentVersion | null> {
    const result = await drizzle(this.db).execute(sql`SELECT * FROM file_versions WHERE file_id = ${fileId} AND version = ${version}`)

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
    const result = await drizzle(this.db).execute(sql`SELECT * FROM file_versions WHERE file_id = ${fileId} AND is_current = TRUE`)

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
    const fileResult = await drizzle(this.db).execute(sql`SELECT * FROM files WHERE id = ${fileId}`)

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

    const versionsResult = await drizzle(this.db).execute(sql`SELECT * FROM file_versions WHERE file_id = ${fileId} ORDER BY version DESC`)

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
      await drizzle(client).execute(sql`BEGIN`)

      // Get the target version
      const targetVersionResult = await drizzle(client).execute(sql`SELECT * FROM file_versions WHERE file_id = ${fileId} AND version = ${targetVersion}`)

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

      await drizzle(client).execute(sql`COMMIT`)
      return newVersion
    } catch (error) {
      await drizzle(client).execute(sql`ROLLBACK`)
      throw error
    } finally {
      client.release()
    }
  }

  async deleteFileVersion(fileId: string, version: number): Promise<void> {
    const client = await this.db.connect()

    try {
      await drizzle(client).execute(sql`BEGIN`)

      // Get the version to delete
      const versionResult = await drizzle(client).execute(sql`SELECT s3_key FROM file_versions WHERE file_id = ${fileId} AND version = ${version}`)

      if (versionResult.rows.length === 0) {
        throw new Error('Version not found')
      }

      const s3Key = versionResult.rows[0].s3_key

      // Delete from S3
      await this.fileStorage.deleteFile(s3Key)

      // Delete from database
      await drizzle(client).execute(sql`DELETE FROM file_versions WHERE file_id = ${fileId} AND version = ${version}`)

      await drizzle(client).execute(sql`COMMIT`)
    } catch (error) {
      await drizzle(client).execute(sql`ROLLBACK`)
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

    await drizzle(this.db).execute(sql`INSERT INTO folders (id, name, parent_id, owner_id) VALUES (${folderId}, ${name}, ${parentId || null}, ${userId})`)

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
    const filesResult = await drizzle(this.db).execute(
      sql`SELECT f.*, fp.permission_type
       FROM files f
       LEFT JOIN file_permissions fp ON f.id = fp.file_id AND fp.user_id = ${userId}
       WHERE f.folder_id = ${folderId} AND (f.is_public = TRUE OR f.uploaded_by = ${userId} OR fp.permission_type IS NOT NULL)
       ORDER BY f.uploaded_at DESC`
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
    const foldersResult = await drizzle(this.db).execute(
      sql`SELECT f.id, f.name, COUNT(files.id) as file_count
       FROM folders f
       LEFT JOIN files ON files.folder_id = f.id
       WHERE f.parent_id = ${folderId} AND f.owner_id = ${userId}
       GROUP BY f.id, f.name
       ORDER BY f.name`
    )

    const folders = foldersResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      fileCount: parseInt(row.file_count),
    }))

    return { files, folders }
  }

  private async generateChecksum(_buffer: Buffer): Promise<string> {
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
    const versionResult = await drizzle(this.db).execute(sql`SELECT MAX(version) as max_version FROM file_versions WHERE file_id = ${fileId}`)
    const newVersion = (versionResult.rows[0]?.max_version || 0) + 1

    const versionId = uuidv4()
    await drizzle(this.db).execute(
      sql`INSERT INTO file_versions (id, file_id, version, file_name, size, url, s3_key, uploaded_by, changes, checksum, is_current)
       VALUES (${versionId}, ${fileId}, ${newVersion}, ${`version-${newVersion}`}, 0, '', ${s3Key}, ${userId}, ${changes || `Version ${newVersion}`}, ${await this.generateChecksum(Buffer.from(''))}, TRUE)`
    )

    const newVersionRecord = await this.getFileVersion(fileId, newVersion)
    if (!newVersionRecord) {
      throw new Error('Failed to create file version from existing')
    }

    return newVersionRecord
  }
}
