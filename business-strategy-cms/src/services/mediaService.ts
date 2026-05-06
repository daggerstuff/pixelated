import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl as signS3Url } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'

interface UploadedFile {
  originalname: string
  mimetype: string
  buffer: Buffer
  size: number
}

interface MediaListOptions {
  includeSignedUrls?: boolean
}

interface ListFilesOptions {
  includeSignedUrls?: boolean
  prefix?: string
  pageSize?: number
  continuationToken?: string
}

interface MediaListItem {
  key: string
  lastModified: Date
  size: number
  url: string | null
}

interface PaginatedListFilesResult {
  files: MediaListItem[]
  isTruncated: boolean
  nextContinuationToken?: string
}

// Hetzner Object Storage configuration (S3-compatible)
export interface MediaUpload {
  id: string
  key: string
  url: string
  size: number
  type: string
  originalName: string
  uploadedAt: Date
  uploadedBy: string
}

class StorageClientFactory {
  private static s3Client: S3Client | null = null
  private static bucketName: string | null = null

  static getS3Client(): S3Client {
    if (!this.s3Client) {
      const endpoint = this.getEndpoint()
      this.s3Client = new S3Client({
        endpoint,
        credentials: {
          accessKeyId: process.env['HETZNER_ACCESS_KEY_ID'] || '',
          secretAccessKey: process.env['HETZNER_SECRET_ACCESS_KEY'] || '',
        },
        region: process.env['HETZNER_REGION'] || 'hel1',
        forcePathStyle: true,
      })
    }

    return this.s3Client
  }

  static getBucketName(): string {
    if (!this.bucketName) {
      this.bucketName = process.env['HETZNER_BUCKET_NAME'] || 'business-strategy-cms-uploads'
    }
    return this.bucketName
  }

  static getEndpoint(): string {
    return (
      process.env['HETZNER_ENDPOINT'] || 'https://hel1.your-objectstorage.com'
    )
  }

  /**
   * Build URL for file
   */
  static buildUrl(key: string): string {
    const endpoint = this.getEndpoint()

    // Remove protocol from endpoint if present
    const cleanEndpoint = endpoint.replace(/^https?:\/\//, '')

    return `https://${cleanEndpoint}/${this.getBucketName()}/${key}`
  }
}

class MediaAuthorizationGuard {
  static assertUserOwnsKey(key: string, userId: string): void {
    if (!userId) {
      throw new Error('Authentication is required to access file operations.')
    }
    if (!key.startsWith(`${userId}/`)) {
      throw new Error('Access to this file is not authorized.')
    }
  }
}

class MediaRepository {
  private static getUploadedFileSize(file: UploadedFile): number {
    if (Number.isFinite(file.size)) {
      return file.size
    }
    if (Buffer.isBuffer(file.buffer)) {
      return file.buffer.length
    }
    throw new Error('Uploaded file missing a valid size value.')
  }

  static async uploadFile(
    file: UploadedFile,
    userId: string,
    folder?: string,
  ): Promise<MediaUpload> {
    const uniqueSuffix = uuidv4()
    const fileExtension = file.originalname.split('.').pop() || ''
    const filename = `${uniqueSuffix}.${fileExtension}`
    const uploadFolder = folder || this.getFolderByFileType(file.mimetype)
    const key = `${userId}/${uploadFolder}/${filename}`
    const fileSize = this.getUploadedFileSize(file)

    await StorageClientFactory.getS3Client().send(
      new PutObjectCommand({
        Bucket: StorageClientFactory.getBucketName(),
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'private',
        Metadata: {
          'uploaded-by': userId,
          'original-name': file.originalname,
        },
      }),
    )
    const url = await this.getSignedUrl(key, 3600)

    return {
      id: uniqueSuffix,
      key,
      url,
      size: fileSize,
      type: file.mimetype,
      originalName: file.originalname,
      uploadedAt: new Date(),
      uploadedBy: userId,
    }
  }

  static async getSignedUrl(
    key: string,
    expiresIn = 3600,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: StorageClientFactory.getBucketName(),
      Key: key,
    })

    return signS3Url(StorageClientFactory.getS3Client(), command, { expiresIn })
  }

  static async deleteFile(key: string): Promise<void> {
    await StorageClientFactory.getS3Client().send(
      new DeleteObjectCommand({
        Bucket: StorageClientFactory.getBucketName(),
        Key: key,
      }),
    )
  }

  static async listFiles(
    userId: string,
    options: string | ListFilesOptions = {},
  ): Promise<PaginatedListFilesResult> {
    const listOptions =
      typeof options === 'string'
        ? { prefix: this.normalizePrefix(options) }
        : options

    const listPrefix = this.getListPrefix(userId, listOptions.prefix)
    const result = await StorageClientFactory.getS3Client().send(
      new ListObjectsV2Command({
        Bucket: StorageClientFactory.getBucketName(),
        ...(listPrefix ? { Prefix: listPrefix } : {}),
        MaxKeys: Math.min(Math.max(listOptions.pageSize ?? 1000, 1), 1000),
        ...(listOptions.continuationToken
          ? { ContinuationToken: listOptions.continuationToken }
          : {}),
      }),
    )

    if (!result.Contents) {
      return {
        files: [],
        isTruncated: false,
      }
    }

    const files = result.Contents
      .filter(this.isFileWithKey)
      .map(this.toMediaListItem)

    const paginatedResult: PaginatedListFilesResult = {
      files,
      isTruncated: result.IsTruncated === true,
      ...(result.NextContinuationToken
        ? { nextContinuationToken: result.NextContinuationToken }
        : {}),
    }

    if (!listOptions.includeSignedUrls) return paginatedResult
    if (!userId) {
      throw new Error(
        'Signed URLs require a userId context in this request path.',
      )
    }

    const enrichedFiles = await this.enrichWithSignedUrls(files)
    return { ...paginatedResult, files: enrichedFiles }
  }

  static async listPublicFiles(
    prefix?: string,
    options: MediaListOptions = {},
  ): Promise<MediaListItem[]> {
    if (options.includeSignedUrls) {
      throw new Error('Global listing cannot generate signed URLs.')
    }

    const listPrefix = this.normalizePrefix(prefix)
    const result = await StorageClientFactory.getS3Client().send(
      new ListObjectsV2Command({
        Bucket: StorageClientFactory.getBucketName(),
        ...(listPrefix ? { Prefix: listPrefix } : {}),
      }),
    )

    if (!result.Contents) return []

    return result.Contents.filter(this.isFileWithKey).map(this.toMediaListItem)
  }

  static async getFileMetadata(
    key: string,
  ): Promise<{
    key: string
    size: number
    lastModified: Date
    contentType: string
    etag: string
    uploadedBy: string
    originalName: string
    metadata: Record<string, string>
  }> {
    const result = await StorageClientFactory.getS3Client().send(
      new HeadObjectCommand({
        Bucket: StorageClientFactory.getBucketName(),
        Key: key,
      }),
    )

    const metadata = result.Metadata || {}
    const uploadedBy = metadata['uploaded-by'] || ''
    const originalName = metadata['original-name'] || ''

    return {
      key,
      size: result.ContentLength || 0,
      lastModified: result.LastModified || new Date(),
      contentType: result.ContentType || 'application/octet-stream',
      etag: result.ETag || '',
      uploadedBy,
      originalName,
      metadata: {
        ...metadata,
        uploadedBy,
        originalName,
      },
    }
  }

  static async ensureBucketExists(): Promise<void> {
    try {
      await StorageClientFactory.getS3Client().send(
        new HeadBucketCommand({ Bucket: StorageClientFactory.getBucketName() }),
      )
    } catch (error: unknown) {
      const httpStatusCode = (error as { $metadata?: { httpStatusCode?: number } })
        .$metadata?.httpStatusCode

      if (httpStatusCode === 404) {
        await StorageClientFactory.getS3Client().send(
          new CreateBucketCommand({ Bucket: StorageClientFactory.getBucketName() }),
        )
      } else {
        throw error
      }
    }
  }

  private static normalizePrefix(prefix?: string): string | undefined {
    if (!prefix) return undefined
    return prefix.replace(/^\/+/, '')
  }

  private static getListPrefix(
    userId?: string,
    prefix?: string,
  ): string | undefined {
    const normalizedPrefix = this.normalizePrefix(prefix)
    if (!userId) return normalizedPrefix
    return normalizedPrefix ? `${userId}/${normalizedPrefix}` : `${userId}/`
  }

  private static isFileWithKey(file: {
    Key?: string | null
  }): file is { Key: string; LastModified?: Date; Size?: number } {
    return Boolean(file.Key)
  }

  private static toMediaListItem(file: {
    Key: string
    LastModified?: Date
    Size?: number
  }): MediaListItem {
    return {
      key: file.Key,
      lastModified: file.LastModified || new Date(),
      size: file.Size || 0,
      url: null,
    }
  }

  private static async enrichWithSignedUrls(
    files: MediaListItem[],
    maxConcurrent = 8,
  ): Promise<MediaListItem[]> {
    const enriched = [...files]
    let nextIndex = 0
    const workers = Array.from(
      { length: Math.min(maxConcurrent, files.length) },
      async () => {
        while (nextIndex < files.length) {
          const fileIndex = nextIndex
          nextIndex += 1
          if (fileIndex >= files.length) break
          const file = files[fileIndex]

          try {
            enriched[fileIndex] = {
              ...file,
              url: await this.getSignedUrl(file.key, 3600),
            }
          } catch (error: unknown) {
            console.warn(
              'Failed to generate signed URL for file:',
              file.key,
              error,
            )
            enriched[fileIndex] = { ...file, url: null }
          }
        }
      },
    )

    await Promise.all(workers)
    return enriched
  }

  private static getFolderByFileType(mimetype: string): string {
    if (!mimetype || typeof mimetype !== 'string') return 'misc'

    const normalized = mimetype.toLowerCase()

    if (normalized.startsWith('image/')) return 'images'
    if (
      normalized.startsWith('text/') ||
      normalized.includes('document') ||
      normalized.includes('msword') ||
      normalized.includes('wordprocessingml') ||
      normalized.includes('spreadsheetml') ||
      normalized.includes('presentationml') ||
      normalized.includes('application/pdf') ||
      normalized.includes('officedocument') ||
      normalized.includes('openxmlformats')
    ) {
      return 'documents'
    }

    return 'misc'
  }
}

export class MediaService {
  static async uploadFile(
    file: UploadedFile,
    userId: string,
    folder?: string,
  ): Promise<MediaUpload> {
    return MediaRepository.uploadFile(file, userId, folder)
  }

  static async getSignedUrl(
    key: string,
    expiresIn = 3600,
    userId: string,
  ): Promise<string> {
    MediaAuthorizationGuard.assertUserOwnsKey(key, userId)
    return MediaRepository.getSignedUrl(key, expiresIn)
  }

  static async deleteFile(key: string, userId: string): Promise<void> {
    MediaAuthorizationGuard.assertUserOwnsKey(key, userId)
    await MediaRepository.deleteFile(key)
  }

  static async listFiles(
    userId: string,
    options: string | ListFilesOptions = {},
  ): Promise<PaginatedListFilesResult> {
    return MediaRepository.listFiles(userId, options)
  }

  static async listPublicFiles(
    prefix?: string,
    options: MediaListOptions = {},
  ): Promise<MediaListItem[]> {
    return MediaRepository.listPublicFiles(prefix, options)
  }

  static async getFileMetadata(
    key: string,
    userId: string,
  ): Promise<{
    key: string
    size: number
    lastModified: Date
    contentType: string
    etag: string
    uploadedBy: string
    originalName: string
    metadata: Record<string, string>
  }> {
    MediaAuthorizationGuard.assertUserOwnsKey(key, userId)
    return MediaRepository.getFileMetadata(key)
  }

  static async ensureBucketExists(): Promise<void> {
    await MediaRepository.ensureBucketExists()
  }
}
