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
  private s3Client: S3Client | null = null

  constructor(
    private readonly endpoint: string =
      process.env['HETZNER_ENDPOINT'] || 'https://hel1.your-objectstorage.com',
    private readonly bucketName: string =
      process.env['HETZNER_BUCKET_NAME'] || 'business-strategy-cms-uploads',
    private readonly region: string = process.env['HETZNER_REGION'] || 'hel1',
    private readonly accessKeyId: string = process.env['HETZNER_ACCESS_KEY_ID'] || '',
    private readonly secretAccessKey: string =
      process.env['HETZNER_SECRET_ACCESS_KEY'] || '',
  ) {}

  getS3Client(): S3Client {
    if (!this.s3Client) {
      this.s3Client = new S3Client({
        endpoint: this.getEndpoint(),
        credentials: {
          accessKeyId: this.accessKeyId,
          secretAccessKey: this.secretAccessKey,
        },
        region: this.region,
        forcePathStyle: true,
      })
    }

    return this.s3Client
  }

  getBucketName(): string {
    return this.bucketName
  }

  getEndpoint(): string {
    return this.endpoint
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
  constructor(
    private readonly storageClientFactory: StorageClientFactory = new StorageClientFactory(),
  ) {}

  private getUploadedFileSize(file: UploadedFile): number {
    if (Number.isFinite(file.size)) {
      return file.size
    }
    if (Buffer.isBuffer(file.buffer)) {
      return file.buffer.length
    }
    throw new Error('Uploaded file missing a valid size value.')
  }

  async uploadFile(
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

    await this.storageClientFactory.getS3Client().send(
      new PutObjectCommand({
        Bucket: this.storageClientFactory.getBucketName(),
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

  async getSignedUrl(
    key: string,
    expiresIn = 3600,
    userId?: string,
  ): Promise<string> {
    if (userId) {
      MediaAuthorizationGuard.assertUserOwnsKey(key, userId)
    }

    const command = new GetObjectCommand({
      Bucket: this.storageClientFactory.getBucketName(),
      Key: key,
    })

    return signS3Url(this.storageClientFactory.getS3Client(), command, { expiresIn })
  }

  async deleteFile(key: string): Promise<void> {
    await this.storageClientFactory.getS3Client().send(
      new DeleteObjectCommand({
        Bucket: this.storageClientFactory.getBucketName(),
        Key: key,
      }),
    )
  }

  async listFiles(
    userId: string,
    options: string | ListFilesOptions = {},
  ): Promise<PaginatedListFilesResult> {
    const listOptions =
      typeof options === 'string'
        ? { prefix: this.normalizePrefix(options) }
        : options

    const listPrefix = this.getListPrefix(userId, listOptions.prefix)
    const result = await this.storageClientFactory.getS3Client().send(
      new ListObjectsV2Command({
        Bucket: this.storageClientFactory.getBucketName(),
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
      .filter(
        (file): file is { Key: string; LastModified?: Date; Size?: number } =>
          this.isFileWithKey(file),
      )
      .map((file) => this.toMediaListItem(file))

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

  async listPublicFiles(
    prefix?: string,
    options: MediaListOptions = {},
  ): Promise<MediaListItem[]> {
    if (options.includeSignedUrls) {
      throw new Error('Global listing cannot generate signed URLs.')
    }

    const listPrefix = this.normalizePrefix(prefix)
    const result = await this.storageClientFactory.getS3Client().send(
      new ListObjectsV2Command({
        Bucket: this.storageClientFactory.getBucketName(),
        ...(listPrefix ? { Prefix: listPrefix } : {}),
      }),
    )

    if (!result.Contents) return []

    return result.Contents
      .filter(
        (file): file is { Key: string; LastModified?: Date; Size?: number } =>
          this.isFileWithKey(file),
      )
      .map((file) => this.toMediaListItem(file))
  }

  async getFileMetadata(
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
    const result = await this.storageClientFactory.getS3Client().send(
      new HeadObjectCommand({
        Bucket: this.storageClientFactory.getBucketName(),
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

  async ensureBucketExists(): Promise<void> {
    try {
      await this.storageClientFactory.getS3Client().send(
        new HeadBucketCommand({ Bucket: this.storageClientFactory.getBucketName() }),
      )
    } catch (error: unknown) {
      const httpStatusCode = (error as { $metadata?: { httpStatusCode?: number } })
        .$metadata?.httpStatusCode

      if (httpStatusCode === 404) {
        await this.storageClientFactory.getS3Client().send(
          new CreateBucketCommand({ Bucket: this.storageClientFactory.getBucketName() }),
        )
      } else {
        throw error
      }
    }
  }

  private normalizePrefix(prefix?: string): string | undefined {
    if (!prefix) return undefined
    return prefix.replace(/^\/+/, '')
  }

  private getListPrefix(
    userId?: string,
    prefix?: string,
  ): string | undefined {
    const normalizedPrefix = this.normalizePrefix(prefix)
    if (!userId) return normalizedPrefix
    return normalizedPrefix ? `${userId}/${normalizedPrefix}` : `${userId}/`
  }

  private isFileWithKey(file: {
    Key?: string | null
  }): file is { Key: string; LastModified?: Date; Size?: number } {
    return Boolean(file.Key)
  }

  private toMediaListItem(file: {
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

  private async enrichWithSignedUrls(
    files: MediaListItem[],
    userId?: string,
    maxConcurrent = 16,
  ): Promise<MediaListItem[]> {
    const total = files.length
    if (total === 0) return []

    const concurrencyLimit = Math.min(maxConcurrent, total)
    const enriched = [...files]
    let nextIndex = 0

    const worker = async (): Promise<void> => {
      while (nextIndex < total) {
        const currentIndex = nextIndex
        nextIndex += 1
        const file = files[currentIndex]

        try {
          const signedUrl = await this.getSignedUrl(file.key, 3600, userId)
          enriched[currentIndex] = { ...file, url: signedUrl }
        } catch (error) {
          console.warn(
            'Failed to generate signed URL for file:',
            file.key,
            error,
          )
          enriched[currentIndex] = { ...file, url: null }
        }
      }
    }

    await Promise.all(
      Array.from({ length: concurrencyLimit }, () => worker()),
    )

    return enriched
  }

  private getFolderByFileType(mimetype: string): string {
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
  private static readonly defaultService = new MediaService()

  constructor(
    private readonly mediaRepository: MediaRepository = new MediaRepository(),
  ) {}

  async uploadFile(
    file: UploadedFile,
    userId: string,
    folder?: string,
  ): Promise<MediaUpload> {
    return this.mediaRepository.uploadFile(file, userId, folder)
  }

  async getSignedUrl(
    key: string,
    expiresIn = 3600,
    userId: string,
  ): Promise<string> {
    return this.mediaRepository.getSignedUrl(key, expiresIn, userId)
  }

  async deleteFile(key: string, userId: string): Promise<void> {
    MediaAuthorizationGuard.assertUserOwnsKey(key, userId)
    await this.mediaRepository.deleteFile(key)
  }

  async listFiles(
    userId: string,
    options: string | ListFilesOptions = {},
  ): Promise<PaginatedListFilesResult> {
    return this.mediaRepository.listFiles(userId, options)
  }

  async listPublicFiles(
    prefix?: string,
    options: MediaListOptions = {},
  ): Promise<MediaListItem[]> {
    return this.mediaRepository.listPublicFiles(prefix, options)
  }

  async getFileMetadata(
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
    return this.mediaRepository.getFileMetadata(key)
  }

  async ensureBucketExists(): Promise<void> {
    await this.mediaRepository.ensureBucketExists()
  }

  static uploadFile(
    file: UploadedFile,
    userId: string,
    folder?: string,
  ): Promise<MediaUpload> {
    return MediaService.defaultService.uploadFile(file, userId, folder)
  }

  static getSignedUrl(
    key: string,
    expiresIn = 3600,
    userId: string,
  ): Promise<string> {
    return MediaService.defaultService.getSignedUrl(key, expiresIn, userId)
  }

  static async deleteFile(key: string, userId: string): Promise<void> {
    return MediaService.defaultService.deleteFile(key, userId)
  }

  static async listFiles(
    userId: string,
    options: string | ListFilesOptions = {},
  ): Promise<PaginatedListFilesResult> {
    return MediaService.defaultService.listFiles(userId, options)
  }

  static async listPublicFiles(
    prefix?: string,
    options: MediaListOptions = {},
  ): Promise<MediaListItem[]> {
    return MediaService.defaultService.listPublicFiles(prefix, options)
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
    return MediaService.defaultService.getFileMetadata(key, userId)
  }

  static async ensureBucketExists(): Promise<void> {
    return MediaService.defaultService.ensureBucketExists()
  }
}
