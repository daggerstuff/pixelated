import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { v4 as uuidv4 } from 'uuid'

import type { FileMetadata } from './FileStorageService.js'
import { FileStorageService } from './FileStorageService.js'

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

interface SqlExecutor {
  execute(query: unknown): Promise<{ rows: Record<string, unknown>[] }>
  transaction<T>(cb: (tx: SqlExecutor) => Promise<T>): Promise<T>
}

export class DocumentVersioningService {
  private readonly db: Pool
  private readonly fileStorage: FileStorageService

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
    const db = drizzle(this.db) as unknown as SqlExecutor

    return await db.transaction(async (tx) => {
      let fileId: string
      let newVersion: number

      if (originalFileId) {
        // This is a new version of an existing file
        const currentVersionResult = await tx.execute(
          sql`SELECT MAX(version) as max_version FROM file_versions WHERE file_id = ${originalFileId}`,
        )
        const maxRow = currentVersionResult.rows[0] as
          | Record<string, unknown>
          | undefined
        newVersion = (Number(maxRow?.['max_version']) || 0) + 1
        fileId = originalFileId

        // Update the original file record
        await tx.execute(
          sql`UPDATE files SET updated_at = NOW() WHERE id = ${fileId}`,
        )
      } else {
        // This is a new file
        fileId = uuidv4()
        newVersion = 1

        // Create file record
        await tx.execute(sql`
          INSERT INTO files (id, original_name, file_name, mime_type, size, url, uploaded_by, s3_key, version)
          VALUES (${fileId}, ${file.originalname}, ${file.originalname}, ${file.mimetype}, ${file.size}, '', ${userId}, '', ${newVersion})
        `)
      }

      // Upload file to S3
      const fileMetadata = await this.fileStorage.uploadFile(file, userId)

      // Create version record
      const versionId = uuidv4()
      await tx.execute(sql`
        INSERT INTO file_versions (id, file_id, version, file_name, size, url, s3_key, uploaded_by, changes, checksum, is_current)
        VALUES (${versionId}, ${fileId}, ${newVersion}, ${file.originalname}, ${file.size}, ${fileMetadata.url}, ${fileMetadata.fileName}, ${userId}, ${changes ?? `Version ${newVersion}`}, ${await this.generateChecksum(file.buffer)}, true)
      `)

      const versionRecord = await this.getFileVersionInternal(
        tx,
        fileId,
        newVersion,
      )
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
    })
  }

  /**
   * Internal helper to fetch file version using either transaction or pool
   */
  private async getFileVersionInternal(
    executor: SqlExecutor,
    fileId: string,
    version: number,
  ): Promise<DocumentVersion | null> {
    const result = await executor.execute({
      text: `SELECT * FROM file_versions WHERE file_id = $1 AND version = $2 LIMIT 1`,
      values: [fileId, version],
    })

    const row = result.rows[0] as Record<string, unknown> | undefined
    if (!row) return null

    return {
      id: row['id'] as string,
      fileId: row['file_id'] as string,
      version: row['version'] as number,
      fileName: row['file_name'] as string,
      size: row['size'] as number,
      url: row['url'] as string,
      s3Key: row['s3_key'] as string,
      uploadedAt: row['uploaded_at'] as Date,
      uploadedBy: row['uploaded_by'] as string,
      changes: row['changes'] as string | undefined,
      checksum: row['checksum'] as string | undefined,
      isCurrent: row['is_current'] as boolean,
    }
  }

  async getFileVersion(
    fileId: string,
    version: number,
  ): Promise<DocumentVersion | null> {
    return this.getFileVersionInternal(drizzle(this.db), fileId, version)
  }

  async getCurrentVersion(fileId: string): Promise<DocumentVersion | null> {
    const db = drizzle(this.db) as unknown as SqlExecutor
    const result = await db.execute(
      sql`SELECT * FROM file_versions WHERE file_id = ${fileId} AND is_current = true LIMIT 1`,
    )

    const row = result.rows[0] as Record<string, unknown> | undefined
    if (!row) return null

    return {
      id: row['id'] as string,
      fileId: row['file_id'] as string,
      version: row['version'] as number,
      fileName: row['file_name'] as string,
      size: row['size'] as number,
      url: row['url'] as string,
      s3Key: row['s3_key'] as string,
      uploadedAt: row['uploaded_at'] as Date,
      uploadedBy: row['uploaded_by'] as string,
      changes: row['changes'] as string | undefined,
      checksum: row['checksum'] as string | undefined,
      isCurrent: row['is_current'] as boolean,
    }
  }

  async getVersionHistory(fileId: string): Promise<VersionHistory> {
    const db = drizzle(this.db) as unknown as SqlExecutor

    const fileResult = await db.execute(
      sql`SELECT * FROM files WHERE id = ${fileId} LIMIT 1`,
    )
    const fileRow = fileResult.rows[0]

    if (!fileRow) {
      throw new Error('File not found')
    }

    const file: FileMetadata = {
      id: fileRow['id'] as string,
      originalName: fileRow['original_name'] as string,
      fileName: fileRow['file_name'] as string,
      mimeType: fileRow['mime_type'] as string,
      size: fileRow['size'] as number,
      url: fileRow['url'] as string,
      thumbnailUrl: fileRow['thumbnail_url'] as string | undefined,
      uploadedBy: fileRow['uploaded_by'] as string,
      uploadedAt: fileRow['uploaded_at'] as Date,
      folderId: fileRow['folder_id'] as string | undefined,
      version: fileRow['version'] as number,
      isPublic: fileRow['is_public'] as boolean,
      tags: (fileRow['tags'] as string[]) || [],
      metadata: (fileRow['metadata'] as Record<string, unknown>) || {},
    }

    const versionsResult = await db.execute(
      sql`SELECT * FROM file_versions WHERE file_id = ${fileId} ORDER BY version DESC`,
    )

    const versions: DocumentVersion[] = versionsResult.rows.map(
      (r: Record<string, unknown>) => ({
        id: r['id'] as string,
        fileId: r['file_id'] as string,
        version: r['version'] as number,
        fileName: r['file_name'] as string,
        size: r['size'] as number,
        url: r['url'] as string,
        s3Key: r['s3_key'] as string,
        uploadedAt: r['uploaded_at'] as Date,
        uploadedBy: r['uploaded_by'] as string,
        changes: r['changes'] as string | undefined,
        checksum: r['checksum'] as string | undefined,
        isCurrent: r['is_current'] as boolean,
      }),
    )

    const currentVersion = versions.find((v) => v.isCurrent) ?? versions[0]

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
    const db = drizzle(this.db) as unknown as SqlExecutor

    return await db.transaction(async (tx) => {
      // Get the target version
      const result = await tx.execute(
        sql`SELECT * FROM file_versions WHERE file_id = ${fileId} AND version = ${targetVersion} LIMIT 1`,
      )
      const targetVersionRow = result.rows[0]

      if (!targetVersionRow) {
        throw new Error('Target version not found')
      }

      // Create new version based on the target version
      return await this.createFileVersionFromExisting(
        tx,
        fileId,
        targetVersionRow['s3_key'] as string,
        userId,
        `Rolled back to version ${targetVersion}`,
      )
    })
  }

  async deleteFileVersion(fileId: string, version: number): Promise<void> {
    const db = drizzle(this.db) as unknown as SqlExecutor

    await db.transaction(async (tx) => {
      const result = await tx.execute(
        sql`SELECT * FROM file_versions WHERE file_id = ${fileId} AND version = ${version} LIMIT 1`,
      )
      const versionRow = result.rows[0]

      if (!versionRow) {
        throw new Error('Version not found')
      }

      const s3Key = versionRow['s3_key'] as string

      // Delete from S3
      await this.fileStorage.deleteFile(s3Key)

      // Delete from database
      await tx.execute(
        sql`DELETE FROM file_versions WHERE file_id = ${fileId} AND version = ${version}`,
      )
    })
  }

  async createFolder(
    name: string,
    userId: string,
    parentId?: string,
  ): Promise<string> {
    const folderId = uuidv4()
    const db = drizzle(this.db) as unknown as SqlExecutor

    await db.execute(sql`
      INSERT INTO folders (id, name, parent_id, owner_id)
      VALUES (${folderId}, ${name}, ${parentId ?? null}, ${userId})
    `)

    return folderId
  }

  async getFolderContents(
    folderId: string,
    userId: string,
  ): Promise<{
    files: FileMetadata[]
    folders: Array<{ id: string; name: string; fileCount: number }>
  }> {
    const db = drizzle(this.db) as unknown as SqlExecutor

    // Get files in folder
    const filesResult = await db.execute(sql`
      SELECT f.*, fp.permission_type
      FROM files f
      LEFT JOIN file_permissions fp ON f.id = fp.file_id AND fp.user_id = ${userId}
      WHERE f.folder_id = ${folderId} AND (f.is_public = TRUE OR f.uploaded_by = ${userId} OR fp.permission_type IS NOT NULL)
      ORDER BY f.uploaded_at DESC
    `)

    const files: FileMetadata[] = filesResult.rows.map(
      (r: Record<string, unknown>) => ({
        id: r['id'] as string,
        originalName: r['original_name'] as string,
        fileName: r['file_name'] as string,
        mimeType: r['mime_type'] as string,
        size: r['size'] as number,
        url: r['url'] as string,
        thumbnailUrl: r['thumbnail_url'] as string | undefined,
        uploadedBy: r['uploaded_by'] as string,
        uploadedAt: r['uploaded_at'] as Date,
        folderId: r['folder_id'] as string | undefined,
        version: r['version'] as number,
        isPublic: r['is_public'] as boolean,
        tags: (r['tags'] as string[]) || [],
        metadata: (r['metadata'] as Record<string, unknown>) || {},
      }),
    )

    // Get subfolders
    const foldersResult = await db.execute(sql`
      SELECT f.id, f.name, COUNT(files.id) as file_count
      FROM folders f
      LEFT JOIN files ON files.folder_id = f.id
      WHERE f.parent_id = ${folderId} AND f.owner_id = ${userId}
      GROUP BY f.id, f.name
      ORDER BY f.name
    `)

    const folders = foldersResult.rows.map((row: Record<string, unknown>) => ({
      id: row['id'] as string,
      name: row['name'] as string,
      fileCount: parseInt(row['file_count'] as string, 10),
    }))

    return { files, folders }
  }

  private async generateChecksum(_buffer: Buffer): Promise<string> {
    return 'mock-checksum-' + Math.random().toString(36).substring(2, 15)
  }

  private async createFileVersionFromExisting(
    executor: SqlExecutor,
    fileId: string,
    s3Key: string,
    userId: string,
    changes?: string,
  ): Promise<DocumentVersion> {
    const versionResult = await executor.execute(
      sql`SELECT MAX(version) as max_version FROM file_versions WHERE file_id = ${fileId}`,
    )
    const versionRow0 = versionResult.rows[0] as
      | Record<string, unknown>
      | undefined
    const newVersion = (Number(versionRow0?.['max_version']) || 0) + 1

    const versionId = uuidv4()
    await executor.execute({
      text: `INSERT INTO file_versions (id, file_id, version, file_name, size, url, s3_key, uploaded_by, changes, checksum, is_current)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      values: [
        versionId,
        fileId,
        newVersion,
        `version-${newVersion}`,
        0,
        '',
        s3Key,
        userId,
        changes ?? `Version ${newVersion}`,
        await this.generateChecksum(Buffer.from('')),
        true,
      ],
    })

    const newVersionRecord = await this.getFileVersionInternal(
      executor,
      fileId,
      newVersion,
    )
    if (!newVersionRecord) {
      throw new Error('Failed to create file version from existing')
    }

    return newVersionRecord
  }
}
