import AWS from 'aws-sdk'
import { v4 as uuidv4 } from 'uuid'

// OVHCloud Object Storage configuration (S3-compatible)
const s3Client = new AWS.S3({
  endpoint:
    process.env['OVH_ENDPOINT'] || 'https://s3.us-east-1.io.cloud.ovh.net',
  accessKeyId: process.env['OVH_ACCESS_KEY_ID'] || '',
  secretAccessKey: process.env['OVH_SECRET_ACCESS_KEY'] || '',
  region: process.env['OVH_REGION'] || 'us-east-1',
  s3ForcePathStyle: true,
  signatureVersion: 'v4',
})

const BUCKET_NAME =
  process.env['OVH_BUCKET_NAME'] || 'business-strategy-cms-uploads'

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
  /**
   * Upload file to OVHCloud Object Storage
   */
  static async uploadFile(
    file: Express.Multer.File,
    userId: string,
    folder?: string,
  ): Promise<MediaUpload> {
    const uniqueSuffix = uuidv4()
    const fileExtension = file.originalname.split('.').pop() || ''
    const filename = `${uniqueSuffix}.${fileExtension}`
    const uploadFolder = folder || this.getFolderByFileType(file.mimetype)
    const key = `${uploadFolder}/${filename}`

    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'private',
      Metadata: {
        'uploaded-by': userId,
        'original-name': file.originalname,
      },
    }

    const result = await s3Client.upload(params).promise()

    return {
      id: uniqueSuffix,
      key: result.Key || key,
      url: result.Location || this.buildUrl(key),
      size: file.size,
      type: file.mimetype,
      originalName: file.originalname,
      uploadedAt: new Date(),
      uploadedBy: userId,
    }
  }

  /**
   * Get signed URL for secure file access
   */
  static async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Expires: expiresIn,
    }

    return s3Client.getSignedUrl('getObject', params)
  }

  /**
   * Delete file from OVHCloud
   */
  static async deleteFile(key: string): Promise<void> {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
    }

    await s3Client.deleteObject(params).promise()
  }

  /**
   * List files in a folder
   */
  static async listFiles(prefix?: string): Promise<
    {
      key: string
      lastModified: Date
      size: number
      url: string | null
    }[]
  > {
    const params: AWS.S3.ListObjectsV2Request = {
      Bucket: BUCKET_NAME,
    }

    if (prefix) {
      params.Prefix = prefix
    }

    const result = await s3Client.listObjectsV2(params).promise()

    if (!result.Contents) return []

    return await Promise.all(
      result.Contents.map(async (file) => {
        try {
          const url = await this.getSignedUrl(file.Key || '')
          return {
            key: file.Key || '',
            lastModified: file.LastModified || new Date(),
            size: file.Size || 0,
            url,
          }
        } catch (error) {
          console.warn('Failed to generate signed URL for file:', file.Key, error)
          return {
            key: file.Key || '',
            lastModified: file.LastModified || new Date(),
            size: file.Size || 0,
            url: null,
          }
        }
      }),
    )
  }

  /**
   * Get file metadata
   */
  static async getFileMetadata(key: string): Promise<{
    key: string
    size: number
    lastModified: Date
    contentType: string
    etag: string
    metadata: Record<string, string>
  }> {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
    }

    const result = await s3Client.headObject(params).promise()

    return {
      key,
      size: result.ContentLength || 0,
      lastModified: result.LastModified || new Date(),
      contentType: result.ContentType || 'application/octet-stream',
      etag: result.ETag || '',
      metadata: result.Metadata || {},
    }
  }

  /**
   * Create bucket if it doesn't exist
   */
  static async ensureBucketExists(): Promise<void> {
    try {
      await s3Client.headBucket({ Bucket: BUCKET_NAME }).promise()
    } catch (error: any) {
      if (error.statusCode === 404) {
        await s3Client.createBucket({ Bucket: BUCKET_NAME }).promise()
      } else {
        throw error
      }
    }
  }

  /**
   * Build URL for file
   */
  private static buildUrl(key: string): string {
    const endpoint =
      process.env['OVH_ENDPOINT'] || 'https://s3.us-east-1.io.cloud.ovh.net'

    // Remove protocol from endpoint if present
    const cleanEndpoint = endpoint.replace(/^https?:\/\//, '')

    return `https://${BUCKET_NAME}.${cleanEndpoint}/${key}`
  }

  /**
   * Get folder by file type
   */
  private static getFolderByFileType(mimetype: string): string {
    if (!mimetype || typeof mimetype !== 'string') return 'misc'

    if (mimetype.startsWith('image/')) return 'images'
    if (mimetype === 'application/pdf') return 'documents'
    if (
      mimetype.includes('wordprocessingml') ||
      mimetype === 'application/msword'
    )
      return 'documents'
    if (
      mimetype.includes('spreadsheetml') ||
      mimetype === 'application/vnd.ms-excel'
    )
      return 'documents'
    if (
      mimetype.includes('presentationml') ||
      mimetype === 'application/vnd.ms-powerpoint'
    )
      return 'documents'
    if (mimetype.startsWith('text/')) return 'documents'
    return 'misc'
  }
}
