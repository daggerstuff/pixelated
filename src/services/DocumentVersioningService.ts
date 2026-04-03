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


class SimpleORM {
  constructor(private client: Pool | any) {}

  async execute(query: string, params: any[] = []): Promise<any> {
    return this.client.query(query, params);
  }

  async findFirst(tableName: string, conditions: Record<string, any>, orderBy?: string): Promise<any> {
    const keys = Object.keys(conditions);
    const values = Object.values(conditions);
    const whereClause = keys.map((key, index) => `${key} = ${index + 1}`).join(' AND ');

    let query = `SELECT * FROM ${tableName} WHERE ${whereClause}`;
    if (orderBy) {
      query += ` ORDER BY ${orderBy}`;
    }
    query += ' LIMIT 1';

    const result = await this.client.query(query, values);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async findMany(tableName: string, conditions: Record<string, any>, orderBy?: string): Promise<any[]> {
    const keys = Object.keys(conditions);
    const values = Object.values(conditions);
    const whereClause = keys.length > 0 ? keys.map((key, index) => `${key} = ${index + 1}`).join(' AND ') : '1=1';

    let query = `SELECT * FROM ${tableName} WHERE ${whereClause}`;
    if (orderBy) {
      query += ` ORDER BY ${orderBy}`;
    }

    const result = await this.client.query(query, values);
    return result.rows;
  }

  async insert(tableName: string, data: Record<string, any>): Promise<any> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, index) => `${index + 1}`).join(', ');

    const query = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.client.query(query, values);
    return result.rows[0];
  }

  async update(tableName: string, data: Record<string, any>, conditions: Record<string, any>): Promise<any> {
    const dataKeys = Object.keys(data);
    const dataValues = Object.values(data);
    const conditionKeys = Object.keys(conditions);
    const conditionValues = Object.values(conditions);

    const setClause = dataKeys.map((key, index) => `${key} = ${index + 1}`).join(', ');
    const whereOffset = dataKeys.length;
    const whereClause = conditionKeys.map((key, index) => `${key} = ${whereOffset + index + 1}`).join(' AND ');

    const query = `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause} RETURNING *`;
    const result = await this.client.query(query, [...dataValues, ...conditionValues]);
    return result.rows;
  }

  async delete(tableName: string, conditions: Record<string, any>): Promise<any> {
    const keys = Object.keys(conditions);
    const values = Object.values(conditions);
    const whereClause = keys.map((key, index) => `${key} = ${index + 1}`).join(' AND ');

    const query = `DELETE FROM ${tableName} WHERE ${whereClause}`;
    const result = await this.client.query(query, values);
    return result;
  }
}

export class DocumentVersioningService {
  private db: Pool
  private fileStorage: FileStorageService
  private orm: SimpleORM

  constructor(db: Pool) {
    this.db = db
    this.fileStorage = new FileStorageService()
    this.orm = new SimpleORM(db)
  }

  async createFileVersion(
    file: Express.Multer.File,
    userId: string,
    originalFileId?: string,
    changes?: string,
  ): Promise<{ file: FileMetadata; version: DocumentVersion }> {
    const client = await this.db.connect()

    try {
      await new SimpleORM(client).execute('BEGIN')

      let fileId: string
      let newVersion: number

      if (originalFileId) {
        // This is a new version of an existing file
        const currentVersionResult = await new SimpleORM(client).execute('SELECT MAX(version) as max_version FROM file_versions WHERE file_id = $1', [originalFileId])
        newVersion = (currentVersionResult.rows[0]?.max_version || 0) + 1
        fileId = originalFileId

        // Update the original file record
        await new SimpleORM(client).execute('UPDATE files SET updated_at = NOW() WHERE id = $1', [fileId])
      } else {
        // This is a new file
        fileId = uuidv4()
        newVersion = 1

        // Create file record
        await new SimpleORM(client).insert('files', { id: fileId, original_name: file.originalname, file_name: file.originalname, mime_type: file.mimetype, size: file.size, url: '', uploaded_by: userId, s3_key: '', version: null })
      }

      // Upload file to S3
      const fileMetadata = await this.fileStorage.uploadFile(file, userId)

      // Create version record
      const versionId = uuidv4()
      await new SimpleORM(client).insert('file_versions', { id: versionId, file_id: fileId, version: newVersion, file_name: file.originalname, size: file.size, url: fileMetadata.url, s3_key: fileMetadata.fileName, uploaded_by: userId, changes: changes || `Version ${newVersion}`, checksum: await this.generateChecksum(file.buffer), is_current: true })

      await new SimpleORM(client).execute('COMMIT')

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
      await new SimpleORM(client).execute('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async getFileVersion(
    fileId: string,
    version: number,
  ): Promise<DocumentVersion | null> {
    const row = await this.orm.findFirst('file_versions', { file_id: fileId, version: version })

    if (!row) {
      return null
    }
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
    const row = await this.orm.findFirst('file_versions', { file_id: fileId, is_current: true })

    if (!row) {
      return null
    }
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
    const fileRow = await this.orm.findFirst('files', { id: fileId })

    if (!fileRow) {
      throw new Error('File not found')
    }
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

    const versionsRows = await this.orm.findMany('file_versions', { file_id: fileId }, 'version DESC')

    const versions: DocumentVersion[] = versionsRows.map((row: any) => ({
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
      await new SimpleORM(client).execute('BEGIN')

      // Get the target version
      const targetVersionRow = await new SimpleORM(client).findFirst('file_versions', { file_id: fileId, version: targetVersion })

      if (!targetVersionRow) {
        throw new Error('Target version not found')
      }

      // Create new version based on the target version
      const newVersion = await this.createFileVersionFromExisting(
        fileId,
        targetVersionRow.s3_key,
        userId,
        `Rolled back to version ${targetVersion}`,
      )

      await new SimpleORM(client).execute('COMMIT')
      return newVersion
    } catch (error) {
      await new SimpleORM(client).execute('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async deleteFileVersion(fileId: string, version: number): Promise<void> {
    const client = await this.db.connect()

    try {
      await new SimpleORM(client).execute('BEGIN')

      // Get the version to delete
      const versionRow = await new SimpleORM(client).findFirst('file_versions', { file_id: fileId, version: version })

      if (!versionRow) {
        throw new Error('Version not found')
      }

      const s3Key = versionRow.s3_key

      // Delete from S3
      await this.fileStorage.deleteFile(s3Key)

      // Delete from database
      await new SimpleORM(client).delete('file_versions', { file_id: fileId, version: version })

      await new SimpleORM(client).execute('COMMIT')
    } catch (error) {
      await new SimpleORM(client).execute('ROLLBACK')
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

    await this.orm.insert('folders', { id: folderId, name: name, parent_id: parentId || null, owner_id: userId })

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
    const filesResult = await this.orm.execute(
      `SELECT f.*, fp.permission_type
       FROM files f
       LEFT JOIN file_permissions fp ON f.id = fp.file_id AND fp.user_id = $2
       WHERE f.folder_id = $1 AND (f.is_public = TRUE OR f.uploaded_by = $2 OR fp.permission_type IS NOT NULL)
       ORDER BY f.uploaded_at DESC`,
      [folderId, userId]
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
    const foldersResult = await this.orm.execute(
      `SELECT f.id, f.name, COUNT(files.id) as file_count
       FROM folders f
       LEFT JOIN files ON files.folder_id = f.id
       WHERE f.parent_id = $1 AND f.owner_id = $2
       GROUP BY f.id, f.name
       ORDER BY f.name`,
      [folderId, userId]
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
    const versionResult = await this.orm.execute('SELECT MAX(version) as max_version FROM file_versions WHERE file_id = $1', [fileId])
    const newVersion = (Number(versionResult.rows[0]?.max_version) || 0) + 1

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
