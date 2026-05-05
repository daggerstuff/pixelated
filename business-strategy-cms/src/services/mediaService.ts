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

export class MediaService {
  private static s3Client: S3Client | null = null
  private static bucketName: string | null = null

  private static getS3Client(): S3Client {
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

  private static getBucketName(): string {
    if (!this.bucketName) {
      this.bucketName = process.env['HETZNER_BUCKET_NAME'] || 'business-strategy-cms-uploads'
    }
    return this.bucketName
  }

  private static getEndpoint(): string {
    return (
      process.env['HETZNER_ENDPOINT'] || 'https://hel1.your-objectstorage.com'
    )
  }

  /**
   * Upload file to Hetzner Object Storage under a user-scoped folder and type-based
   * subfolder (`userId/<type>/<filename>`), then return its metadata and signed URL.
   */
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

    await this.getS3Client().send(
      new PutObjectCommand({
        Bucket: this.getBucketName(),
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
    const url = await this.getSignedUrl(key, 3600, userId)

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

  private static getUploadedFileSize(file: UploadedFile): number {
    if (Number.isFinite(file.size)) {
      return file.size
    }
    if (Buffer.isBuffer(file.buffer)) {
      return file.buffer.length
    }
    throw new Error('Uploaded file missing a valid size value.')
  }

  /**
   * Get a signed URL for a single file, scoped to the owning `userId`.
   * Access is authorized only when `userId` matches the file key prefix.
   */
  static async getSignedUrl(
    key: string,
    expiresIn = 3600,
    userId: string,
  ): Promise<string> {
    this.assertUserOwnsKey(key, userId)
    const command = new GetObjectCommand({
      Bucket: this.getBucketName(),
      Key: key,
    })

    return signS3Url(this.getS3Client(), command, { expiresIn })
  }

  /**
   * Delete a file from Hetzner after verifying the calling `userId` owns the key.
   * User-scoped ownership is enforced to prevent cross-user deletion.
   */
  static async deleteFile(key: string, userId: string): Promise<void> {
    this.assertUserOwnsKey(key, userId)
    await this.getS3Client().send(
      new DeleteObjectCommand({
        Bucket: this.getBucketName(),
        Key: key,
      }),
    )
  }

  /**
   * List files in a user folder and optional prefix, enforcing user-scoped
   * access control via `userId`.
   */
  static async listFiles(
    userId: string,
    options: string | ListFilesOptions = {},
  ): Promise<PaginatedListFilesResult> {
    const listOptions =
      typeof options === 'string'
        ? { prefix: this.normalizePrefix(options) }
        : options

    const listPrefix = this.getListPrefix(userId, listOptions.prefix)
    const result = await this.getS3Client().send(
      new ListObjectsV2Command({
        Bucket: this.getBucketName(),
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
      .filter((file): file is NonNullable<typeof file> =>
        Boolean(file.Key),
      )
      .map((file) => ({
        key: file.Key!,
        lastModified: file.LastModified || new Date(),
        size: file.Size || 0,
        url: null,
      }))

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

    const enrichedFiles = await this.enrichWithSignedUrls(files, userId)
    return { ...paginatedResult, files: enrichedFiles }
  }

  /**
   * Legacy listing across public buckets (no user scoping)
   */
  static async listPublicFiles(
    prefix?: string,
    options: MediaListOptions = {},
  ): Promise<
    {
      key: string
      lastModified: Date
      size: number
      url: string | null
    }[]
  > {
    if (options.includeSignedUrls) {
      throw new Error('Global listing cannot generate signed URLs.')
    }

    const listPrefix = this.normalizePrefix(prefix)
    const result = await this.getS3Client().send(
      new ListObjectsV2Command({
        Bucket: this.getBucketName(),
        ...(listPrefix ? { Prefix: listPrefix } : {}),
      }),
    )

    if (!result.Contents) return []

    return result.Contents.filter((file): file is NonNullable<typeof file> =>
      Boolean(file.Key),
    ).map((file) => ({
      key: file.Key!,
      lastModified: file.LastModified || new Date(),
      size: file.Size || 0,
      url: null,
    }))
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

  private static assertUserOwnsKey(key: string, userId: string): void {
    if (!userId) {
      throw new Error('Authentication is required to access file operations.')
    }
    if (!key.startsWith(`${userId}/`)) {
      throw new Error('Access to this file is not authorized.')
    }
  }

  private static async enrichWithSignedUrls(
    files: Array<{ key: string; lastModified: Date; size: number; url: string | null }>,
    userId: string,
    maxConcurrent = 8,
  ): Promise<
    {
      key: string
      lastModified: Date
      size: number
      url: string | null
    }[]
  > {
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
              url: await this.getSignedUrl(file.key, 3600, userId),
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

  /**
   * Get file metadata for a specific key.
   *
   * `userId` is required for ownership validation and access control.
   */
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
    this.assertUserOwnsKey(key, userId)
    const result = await this.getS3Client().send(
      new HeadObjectCommand({
        Bucket: this.getBucketName(),
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

  /**
   * Create bucket if it doesn't exist
  */
  static async ensureBucketExists(): Promise<void> {
    try {
    await this.getS3Client().send(
      new HeadBucketCommand({ Bucket: this.getBucketName() }),
    )
    } catch (error: unknown) {
      const httpStatusCode = (error as { $metadata?: { httpStatusCode?: number } })
        .$metadata?.httpStatusCode

      if (httpStatusCode === 404) {
        await this.getS3Client().send(
          new CreateBucketCommand({ Bucket: this.getBucketName() }),
        )
      } else {
        throw error
      }
    }
  }

  /**
   * Build URL for file
  */
  private static buildUrl(key: string): string {
    const endpoint = this.getEndpoint()

    // Remove protocol from endpoint if present
    const cleanEndpoint = endpoint.replace(/^https?:\/\//, '')

    return `https://${this.getBucketName()}.${cleanEndpoint}/${key}`
  }

  /**
   * Get folder by file type
  */
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
