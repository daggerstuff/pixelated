import path from 'path'

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'

import { imageOptimizer } from '../utils/image-optimizer'

export interface FileMetadata {
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
  metadata: Record<string, any>
}

interface FileVersion {
  id: string
  fileId: string
  version: number
  fileName: string
  size: number
  url: string
  uploadedAt: Date
  uploadedBy: string
  changes?: string
}

interface UploadConfig {
  maxSize?: number
  allowedTypes?: string[]
  folder?: string
  isPublic?: boolean
  tags?: string[]
}

export class FileStorageService {
  private readonly s3Client: S3Client
  private readonly bucketName: string
  private readonly cloudFrontDomain?: string

  constructor() {
    this.s3Client = new S3Client({
      region: process.env['AWS_REGION'] ?? 'us-east-1',
      credentials: {
        accessKeyId: process.env['AWS_ACCESS_KEY_ID'] ?? '',
        secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'] ?? '',
      },
    })
    this.bucketName = process.env['AWS_S3_BUCKET'] ?? 'pixelated-business-docs'
    this.cloudFrontDomain = process.env['AWS_CLOUDFRONT_DOMAIN']
  }

  async uploadFile(
    file: Express.Multer.File,
    userId: string,
    config: UploadConfig = {},
  ): Promise<FileMetadata> {
    const fileId = uuidv4()
    const fileExtension = path.extname(file.originalname)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `${fileId}_${timestamp}${fileExtension}`

    const key = config.folder
      ? `${config.folder}/${fileName}`
      : `uploads/${userId}/${fileName}`

    // Validate file
    this.validateFile(file, config)

    // Optimize image if the file is an image
    const isImage = file.mimetype.startsWith('image/')
    let uploadBuffer = file.buffer
    let uploadContentType = file.mimetype
    let uploadSize = file.size
    let thumbnailUrl: string | undefined
    const optimizationMeta: Record<string, unknown> = {}

    if (isImage) {
      try {
        const optimization = await imageOptimizer.optimizeBuffer(
          file.buffer,
          file.originalname,
          file.mimetype,
        )

        // Use the optimized original if it's smaller
        if (
          optimization.optimized &&
          optimization.optimized.size < uploadSize
        ) {
          uploadBuffer = optimization.optimized.buffer
          uploadContentType = optimization.optimized.mimetype
          uploadSize = optimization.optimized.size
        }

        // Upload thumbnail if generated
        if (optimization.thumbnail) {
          const thumbKey = `${key}-thumb.jpg`
          await this.s3Client.send(
            new PutObjectCommand({
              Bucket: this.bucketName,
              Key: thumbKey,
              Body: optimization.thumbnail.buffer,
              ContentType: 'image/jpeg',
              ACL: config.isPublic ? 'public-read' : 'private',
              Metadata: {
                'uploaded-by': userId,
                'original-name': file.originalname,
                'variant': 'thumbnail',
              },
            }),
          )
          thumbnailUrl = this.cloudFrontDomain
            ? `https://${this.cloudFrontDomain}/${thumbKey}`
            : `https://${this.bucketName}.s3.amazonaws.com/${thumbKey}`
        }

        if (optimization.webp) {
          const webpKey = `${key}.webp`
          await this.s3Client.send(
            new PutObjectCommand({
              Bucket: this.bucketName,
              Key: webpKey,
              Body: optimization.webp.buffer,
              ContentType: 'image/webp',
              ACL: config.isPublic ? 'public-read' : 'private',
              Metadata: {
                'uploaded-by': userId,
                'original-name': file.originalname,
                'variant': 'webp',
              },
            }),
          )
        }

        if (optimization.avif) {
          const avifKey = `${key}.avif`
          await this.s3Client.send(
            new PutObjectCommand({
              Bucket: this.bucketName,
              Key: avifKey,
              Body: optimization.avif.buffer,
              ContentType: 'image/avif',
              ACL: config.isPublic ? 'public-read' : 'private',
              Metadata: {
                'uploaded-by': userId,
                'original-name': file.originalname,
                'variant': 'avif',
              },
            }),
          )
        }

        optimizationMeta['optimized'] = true
        optimizationMeta['savings'] = optimization.savings
        optimizationMeta['hasWebP'] = !!optimization.webp
        optimizationMeta['hasAVIF'] = !!optimization.avif
        optimizationMeta['resizeVariants'] = optimization.resizeVariants.length
      } catch (error: unknown) {
        // If optimization fails, continue with original file
        optimizationMeta['optimized'] = false
        optimizationMeta['error'] =
          error instanceof Error ? error.message : String(error)
      }
    }

    // Upload to S3
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: uploadBuffer,
        ContentType: uploadContentType,
        ACL: config.isPublic ? 'public-read' : 'private',
        Metadata: {
          'uploaded-by': userId,
          'original-name': file.originalname,
        },
      }),
    )

    const url = this.cloudFrontDomain
      ? `https://${this.cloudFrontDomain}/${key}`
      : `https://${this.bucketName}.s3.amazonaws.com/${key}`

    const metadata: FileMetadata = {
      id: fileId,
      originalName: file.originalname,
      fileName,
      mimeType: file.mimetype,
      size: uploadSize,
      url,
      thumbnailUrl,
      uploadedBy: userId,
      uploadedAt: new Date(),
      folderId: config.folder,
      version: 1,
      isPublic: config.isPublic ?? false,
      tags: config.tags ?? [],
      metadata: optimizationMeta,
    }

    return metadata
  }

  async getFile(
    _fileId: string,
    _userId: string,
  ): Promise<FileMetadata | null> {
    // This would typically query your database
    // For now, return a mock structure
    return null
  }

  async getPresignedUploadUrl(
    fileName: string,
    mimeType: string,
    userId: string,
    config: UploadConfig = {},
  ): Promise<{ uploadUrl: string; fileUrl: string; fileId: string }> {
    const fileId = uuidv4()
    const fileExtension = path.extname(fileName)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const s3FileName = `${fileId}_${timestamp}${fileExtension}`

    const key = config.folder
      ? `${config.folder}/${s3FileName}`
      : `uploads/${userId}/${s3FileName}`

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: mimeType,
      ACL: config.isPublic ? 'public-read' : 'private',
      Metadata: {
        'uploaded-by': userId,
        'original-name': fileName,
      },
    })

    const uploadUrl = await getSignedUrl(
      this.s3Client as unknown as Parameters<typeof getSignedUrl>[0],
      command,
      {
        expiresIn: 3600,
      },
    )

    const fileUrl = this.cloudFrontDomain
      ? `https://${this.cloudFrontDomain}/${key}`
      : `https://${this.bucketName}.s3.amazonaws.com/${key}`

    return { uploadUrl, fileUrl, fileId }
  }

  async getPresignedDownloadUrl(
    fileKey: string,
    expiresIn = 3600,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
    })

    return getSignedUrl(
      this.s3Client as unknown as Parameters<typeof getSignedUrl>[0],
      command,
      {
        expiresIn,
      },
    )
  }

  async deleteFile(fileKey: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
      }),
    )
  }

  async listFiles(prefix?: string, maxKeys = 100): Promise<string[]> {
    const command = new ListObjectsV2Command({
      Bucket: this.bucketName,
      Prefix: prefix,
      MaxKeys: maxKeys,
    })

    const response = await this.s3Client.send(command)
    return response.Contents?.map((obj) => obj.Key ?? '') ?? []
  }

  async createFolder(
    folderName: string,
    userId: string,
    parentFolder?: string,
  ): Promise<string> {
    const folderPath = parentFolder
      ? `${parentFolder}/${folderName}/`
      : `folders/${userId}/${folderName}/`

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: folderPath,
        Body: '',
        ContentType: 'application/x-directory',
      }),
    )

    return folderPath
  }

  private validateFile(file: Express.Multer.File, config: UploadConfig): void {
    // Check file size
    const maxSize = config.maxSize ?? 10 * 1024 * 1024 // 10MB default
    if (file.size > maxSize) {
      throw new Error(`File size exceeds limit of ${maxSize} bytes`)
    }

    // Check file type
    const allowedTypes = config.allowedTypes ?? [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
    ]

    if (!allowedTypes.includes(file.mimetype)) {
      throw new Error(`File type ${file.mimetype} is not allowed`)
    }
  }

  getFileKeyFromUrl(url: string): string {
    const urlParts = url.split('/')
    return urlParts.slice(urlParts.indexOf(this.bucketName) + 1).join('/')
  }

  async generateThumbnail(file: Express.Multer.File): Promise<Buffer | null> {
    if (!file.mimetype.startsWith('image/')) {
      return null
    }

    try {
      const result = await imageOptimizer.optimizeBuffer(
        file.buffer,
        file.originalname,
        file.mimetype,
      )
      return result.thumbnail?.buffer ?? null
    } catch {
      return null
    }
  }
}
