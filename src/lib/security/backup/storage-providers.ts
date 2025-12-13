/**
 * Backup Storage Providers
 *
 * This file defines the interface and implementations for storage providers
 * used by the backup security system to store and retrieve encrypted backups.
 */

import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import { securePathJoin } from '../../utils/index'
import { ALLOWED_DIRECTORIES, safeJoin, validatePath } from '../../../utils/path-security'
import * as path from 'path'
import * as fs from 'fs/promises'
import * as crypto from 'crypto'

const logger = createBuildSafeLogger('backup-storage')

// Define interfaces for cloud storage clients to avoid 'any' types
interface S3Client {
  send(command: unknown): Promise<unknown>
}

interface GCSStorage {
  bucket(name: string): GCSBucket
}

interface GCSBucket {
  file(name: string): GCSFile
  getFiles(options?: Record<string, unknown>): Promise<[GCSFile[]]>
}

interface GCSFile {
  name: string
  save(data: Uint8Array, options?: Record<string, unknown>): Promise<void>
  download(): Promise<[Buffer]>
  delete(): Promise<void>
}

interface AzureBlobServiceClient {
  getContainerClient(name: string): AzureContainerClient
}

interface AzureContainerClient {
  createIfNotExists(): Promise<void>
  getBlockBlobClient(name: string): AzureBlockBlobClient
  listBlobsFlat(
    options?: Record<string, unknown>,
  ): AsyncIterable<{ name: string }>
}

interface AzureBlockBlobClient {
  upload(
    data: Uint8Array,
    length: number,
    options?: Record<string, unknown>,
  ): Promise<void>
  download(
    offset?: number,
  ): Promise<{ readableStreamBody?: NodeJS.ReadableStream }>
  delete(): Promise<void>
}

/**
 * Utility function for simple glob-like pattern matching
 * @param filePath The file path to check
 * @param pattern The glob pattern to match agains
 * @returns Whether the file path matches the pattern
 */
function matchesPattern(filePath: string, pattern: string): boolean {
  // TODO: Create a production-ready glob library
  // Very simple glob-like pattern matching
  // In production, use a proper glob library
  const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.')
  const regex = new RegExp(`^${regexPattern}$`)
  return regex.test(filePath)
}

/**
 * Storage Provider Interface
 * All backup storage providers must implement this interface
 */
export interface StorageProvider {
  /**
   * Initialize the storage provider with its configuration
   */
  initialize(): Promise<void>

  /**
   * Store a file in the storage location
   * @param key The path/key where the file should be stored
   * @param data The file data to store
   */
  storeFile(key: string, data: Uint8Array): Promise<void>

  /**
   * Retrieve a file from the storage location
   * @param key The path/key where the file is stored
   * @returns The file data
   */
  getFile(key: string): Promise<Uint8Array>

  /**
   * List files in the storage location
   * @param pattern Optional glob pattern to match files
   * @returns Array of file keys/paths
   */
  listFiles(pattern?: string): Promise<string[]>

  /**
   * Delete a file from the storage location
   * @param key The path/key of the file to delete
   */
  deleteFile(key: string): Promise<void>
}

/**
 * Local File System Storage Provider
 * Stores backups on the local file system
 */
export class FileSystemStorageProvider implements StorageProvider {
  private config: {
    basePath: string
  }

  constructor(config: Record<string, unknown>) {
    const defaultPath = safeJoin(ALLOWED_DIRECTORIES.PROJECT_ROOT, 'data', 'backups')
    const userBasePath = (config['basePath'] as string) || defaultPath

    // Validate basePath is within the project root (prevents traversal)
    const resolvedBasePath = validatePath(userBasePath, ALLOWED_DIRECTORIES.PROJECT_ROOT)

    this.config = {
      basePath: resolvedBasePath,
    }
  }

  async initialize(): Promise<void> {
    // Ensure the base directory exists
    await fs.mkdir(this.config.basePath, { recursive: true })
    logger.info(`Initialized file system storage at ${this.config.basePath}`)
  }

  async storeFile(key: string, data: Uint8Array): Promise<void> {
    const filePath = this.getFullPath(key)

    // Ensure the directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true })

    // Write the file
    await fs.writeFile(filePath, data)
    logger.debug(`Stored file at ${filePath}`)
  }

  async getFile(key: string): Promise<Uint8Array> {
    const filePath = this.getFullPath(key)
    const data = await fs.readFile(filePath)
    return new Uint8Array(data)
  }

  async listFiles(pattern?: string): Promise<string[]> {
    // For simplicity, this implementation does a recursive directory search
    // and applies a simple pattern matching. In production, you'd use a proper
    // glob library or recursively list directories.
    try {
      const results: string[] = []
      const { basePath } = this.config
      const resolvedBasePath = basePath

      const scanDir = async (dirPath: string, relativePath = '') => {
        // Validate dirPath is within basePath to prevent path traversal
        const validatedDirPath = validatePath(dirPath, resolvedBasePath)

        const entries = await fs.readdir(validatedDirPath, { withFileTypes: true })

        for (const entry of entries) {
          // Validate entry name for security
          if (
            !entry.name ||
            entry.name.includes('..') ||
            entry.name.includes('/') ||
            entry.name.includes('\\')
          ) {
            logger.warn(`Skipping potentially unsafe file entry: ${entry.name}`)
            continue
          }

          // Use securePathJoin to prevent path traversal
          const fullPath = securePathJoin(validatedDirPath, entry.name)
          const relPath = relativePath
            ? securePathJoin(relativePath, entry.name)
            : entry.name

          if (entry.isDirectory()) {
            await scanDir(fullPath, relPath)
          } else if (!pattern || matchesPattern(relPath, pattern)) {
            results.push(relPath)
          }
        }
      }

      const matchesPattern = (filePath: string, pattern: string): boolean => {
        // Very simple glob-like pattern matching
        // In production, use a proper glob library
        const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.')

        const regex = new RegExp(`^${regexPattern}$`)
        return regex.test(filePath)
      }

      await scanDir(basePath)
      return results
    } catch (error: unknown) {
      logger.error(
        `Error listing files: ${error instanceof Error ? String(error) : String(error)}`,
      )
      return []
    }
  }

  async deleteFile(key: string): Promise<void> {
    const filePath = this.getFullPath(key)
    await fs.unlink(filePath)
    logger.debug(`Deleted file at ${filePath}`)
  }

  private getFullPath(key: string): string {
    return securePathJoin(this.config.basePath, key, {
      allowedExtensions: ['.enc', '.meta', '.json', '.txt'], // Allow common backup file extensions
    })
  }
}

/**
 * In-Memory Storage Provider (for testing)
 * Stores backups in memory - not persistent between restarts
 */
export class InMemoryStorageProvider implements StorageProvider {
  private storage: Map<string, Uint8Array> = new Map()

  async initialize(): Promise<void> {
    this.storage.clear()
    logger.info('Initialized in-memory storage')
  }

  async storeFile(key: string, data: Uint8Array): Promise<void> {
    this.storage.set(key, new Uint8Array(data))
    logger.debug(`Stored file with key ${key}`)
  }

  async getFile(key: string): Promise<Uint8Array> {
    const data = this.storage.get(key)
    if (!data) {
      throw new Error(`File not found: ${key}`)
    }
    return new Uint8Array(data)
  }

  async listFiles(pattern?: string): Promise<string[]> {
    const keys = Array.from(this.storage.keys())

    if (!pattern) {
      return keys
    }

    return keys.filter((key) => matchesPattern(key, pattern))
  }

  async deleteFile(key: string): Promise<void> {
    this.storage.delete(key)
    logger.debug(`Deleted file with key ${key}`)
  }
}

/**
 * Mock Cloud Storage Provider (for development)
 * Simulates cloud storage behavior with local files
 */
export class MockCloudStorageProvider implements StorageProvider {
  private config: {
    provider: string
    bucket: string
    basePath: string
  }

  constructor(config: Record<string, unknown>) {
    const defaultPath = safeJoin(ALLOWED_DIRECTORIES.PROJECT_ROOT, 'data', 'mock-cloud')
    const userBasePath = (config['basePath'] as string) || defaultPath

    // Validate basePath is within the project root (prevents traversal)
    const resolvedBasePath = validatePath(userBasePath, ALLOWED_DIRECTORIES.PROJECT_ROOT)

    this.config = {
      provider: (config['provider'] as string) || 'mock-cloud',
      bucket: (config['bucket'] as string) || 'mock-bucket',
      basePath: resolvedBasePath,
    }
  }

  async initialize(): Promise<void> {
    // Validate config values to prevent path traversal
    if (
      this.config.provider.includes('..') ||
      this.config.provider.includes('/') ||
      this.config.provider.includes('\\') ||
      this.config.bucket.includes('..') ||
      this.config.bucket.includes('/') ||
      this.config.bucket.includes('\\')
    ) {
      throw new Error('Invalid provider or bucket name: contains path traversal sequences')
    }

    // Create the base directory for the mock cloud storage using securePathJoin
    const providerPath = securePathJoin(this.config.basePath, this.config.provider)
    const bucketPath = securePathJoin(providerPath, this.config.bucket)
    await fs.mkdir(bucketPath, { recursive: true })

    logger.info(
      `Initialized mock cloud storage provider: ${this.config.provider}, bucket: ${this.config.bucket}`,
    )
  }

  async storeFile(key: string, data: Uint8Array): Promise<void> {
    const filePath = this.getFullPath(key)

    // Ensure the directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true })

    // In a real cloud provider, this would interact with an API
    // For our mock, simply write to the file system with metadata

    // Add a mock metadata file for cloud provider characteristics
    const metadata = {
      key,
      bucket: this.config.bucket,
      contentType: 'application/octet-stream',
      contentLength: data.length,
      etag: crypto.createHash('md5').update(data).digest('hex'),
      lastModified: new Date().toISOString(),
    }

    await fs.writeFile(filePath, data)
    // Validate meta file path to prevent path traversal
    const metaFilePath = securePathJoin(path.dirname(filePath), path.basename(filePath) + '.meta', {
      allowedExtensions: ['.meta'],
    })
    await fs.writeFile(metaFilePath, JSON.stringify(metadata, null, 2))

    logger.debug(`Stored file at ${key} in mock cloud storage`)
  }

  async getFile(key: string): Promise<Uint8Array> {
    const filePath = this.getFullPath(key)

    // Add simulated network delay for realism (10-100ms)
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 90 + 10))

    try {
      const data = await fs.readFile(filePath)
      return new Uint8Array(data)
    } catch (error: unknown) {
      logger.error(
        `Error reading file ${key}: ${error instanceof Error ? String(error) : String(error)}`,
      )
      throw new Error(`File not found in cloud storage: ${key}`, {
        cause: error,
      })
    }
  }

  async listFiles(pattern?: string): Promise<string[]> {
    // Validate config values to prevent path traversal
    if (
      this.config.provider.includes('..') ||
      this.config.provider.includes('/') ||
      this.config.provider.includes('\\') ||
      this.config.bucket.includes('..') ||
      this.config.bucket.includes('/') ||
      this.config.bucket.includes('\\')
    ) {
      throw new Error('Invalid provider or bucket name: contains path traversal sequences')
    }

    // Build bucket path using securePathJoin to prevent path traversal
    const providerPath = securePathJoin(this.config.basePath, this.config.provider)
    const bucketPath = securePathJoin(providerPath, this.config.bucket)
    const resolvedBasePath = this.config.basePath

    // Simulate network delay
    await new Promise((resolve) =>
      setTimeout(resolve, Math.random() * 200 + 50),
    )

    try {
      const results: string[] = []

      const scanDir = async (dirPath: string, relativePath = '') => {
        // Validate dirPath is within basePath to prevent path traversal
        const validatedDirPath = validatePath(dirPath, resolvedBasePath)

        const entries = await fs.readdir(validatedDirPath, { withFileTypes: true })

        for (const entry of entries) {
          if (entry.name.endsWith('.meta')) {
            continue
          }

          // Validate entry name for security
          if (
            !entry.name ||
            entry.name.includes('..') ||
            entry.name.includes('/') ||
            entry.name.includes('\\')
          ) {
            logger.warn(`Skipping potentially unsafe file entry: ${entry.name}`)
            continue
          }

          // Use securePathJoin to prevent path traversal
          const entryPath = securePathJoin(validatedDirPath, entry.name)
          const keyPath = relativePath
            ? securePathJoin(relativePath, entry.name)
            : entry.name

          if (entry.isDirectory()) {
            await scanDir(entryPath, keyPath)
          } else if (!pattern || matchesPattern(keyPath, pattern)) {
            results.push(keyPath)
          }
        }
      }

      const matchesPattern = (filePath: string, pattern: string): boolean => {
        const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.')

        const regex = new RegExp(`^${regexPattern}$`)
        return regex.test(filePath)
      }

      await scanDir(bucketPath)
      return results
    } catch (error: unknown) {
      logger.error(
        `Error listing files in cloud storage: ${error instanceof Error ? String(error) : String(error)}`,
      )
      return []
    }
  }

  async deleteFile(key: string): Promise<void> {
    const filePath = this.getFullPath(key)

    // Add simulated network delay
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 90 + 10))

    try {
      await fs.unlink(filePath)

      // Also delete metadata file if it exists
      try {
        await fs.unlink(`${filePath}.meta`)
      } catch (error: unknown) {
        // Log errors deleting metadata file but don't fail the operation
        logger.debug(
          `Error deleting metadata file for ${key}: ${error instanceof Error ? String(error) : String(error)}`,
        )
      }

      logger.debug(`Deleted file ${key} from mock cloud storage`)
    } catch (error: unknown) {
      logger.error(
        `Error deleting file ${key}: ${error instanceof Error ? String(error) : String(error)}`,
      )
      throw error
    }
  }

  private getFullPath(key: string): string {
    return securePathJoin(this.config.basePath, key, {
      allowedExtensions: ['.enc', '.meta', '.json', '.txt'], // Allow common backup file extensions
    })
  }
}

/**
 * AWS S3 Storage Provider
 * Production-ready storage provider for AWS S3
 */
export class AWSS3StorageProvider implements StorageProvider {
  private s3Client: S3Client | null = null
  private config: {
    bucket: string
    region: string
    prefix: string
    endpoint?: string
    credentials?: {
      accessKeyId: string
      secretAccessKey: string
    }
  }

  constructor(config: Record<string, unknown>) {
    const bucket = config['bucket'] as string
    const region = (config['region'] as string) || 'us-east-1'
    const prefix = (config['prefix'] as string) || ''
    const endpoint = config['endpoint'] as string | undefined
    const credentials = config['credentials'] as
      | {
          accessKeyId: string
          secretAccessKey: string
        }
      | undefined

    this.config = {
      bucket,
      region,
      prefix,
      ...(endpoint && { endpoint }),
      ...(credentials && { credentials }),
    }

    if (!this.config.bucket) {
      throw new Error('S3 bucket name is required')
    }
  }

  async initialize(): Promise<void> {
    try {
      // Dynamically import AWS SDK to avoid requiring it as a dependency
      // for users who don't use S3 storage
      // Note: This requires installing @aws-sdk/client-s3 as a dependency
      // if you intend to use this provider in production
      let S3Client: any
      try {
        // Using dynamic import with type assertion to avoid TypeScript errors
        const awsModule = await import('@aws-sdk/client-s3')
        S3Client = awsModule.S3Client
      } catch (importError) {
        logger.error(
          `Failed to import @aws-sdk/client-s3: ${importError instanceof Error ? importError.message : String(importError)}`,
        )
        throw new Error(
          'The @aws-sdk/client-s3 package is not installed. Please install it with: pnpm add @aws-sdk/client-s3',
          { cause: importError },
        )
      }

      const clientOptions: Record<string, unknown> = {
        region: this.config.region,
      }

      // Add optional configurations
      if (this.config.endpoint) {
        clientOptions['endpoint'] = this.config.endpoint
      }

      if (this.config.credentials) {
        clientOptions['credentials'] = this.config.credentials
      }

      this.s3Client = new S3Client(clientOptions)
      logger.info(
        `Initialized AWS S3 storage provider for bucket: ${this.config.bucket}`,
      )
    } catch (error: unknown) {
      logger.error(
        `Failed to initialize AWS S3 provider: ${error instanceof Error ? String(error) : String(error)}`,
      )
      throw new Error(
        `Failed to initialize AWS S3 provider: ${error instanceof Error ? String(error) : String(error)}`,
        { cause: error },
      )
    }
  }

  async storeFile(key: string, data: Uint8Array): Promise<void> {
    try {
      const fullKey = this.getFullKey(key)

      // Import the PutObjectCommand dynamically
      let PutObjectCommand: any
      try {
        const { PutObjectCommand: POC } = await import('@aws-sdk/client-s3')
        PutObjectCommand = POC
      } catch (importError) {
        logger.error(
          `Failed to import PutObjectCommand: ${importError instanceof Error ? importError.message : String(importError)}`,
        )
        throw new Error('The @aws-sdk/client-s3 package is not installed.', {
          cause: importError,
        })
      }

      await (this.s3Client as S3Client).send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: fullKey,
          Body: data,
          ContentType: 'application/octet-stream',
        }),
      )

      logger.debug(
        `Stored file at ${fullKey} in S3 bucket ${this.config.bucket}`,
      )
    } catch (error: unknown) {
      logger.error(
        `Error storing file ${key} in S3: ${error instanceof Error ? String(error) : String(error)}`,
      )
      throw new Error(
        `Failed to store file in S3: ${error instanceof Error ? String(error) : String(error)}`,
        { cause: error },
      )
    }
  }

  async getFile(key: string): Promise<Uint8Array> {
    try {
      const fullKey = this.getFullKey(key)

      // Import the GetObjectCommand dynamically
      let GetObjectCommand: any
      try {
        const { GetObjectCommand: GOC } = await import('@aws-sdk/client-s3')
        GetObjectCommand = GOC
      } catch (importError) {
        logger.error(
          `Failed to import GetObjectCommand: ${importError instanceof Error ? importError.message : String(importError)}`,
        )
        throw new Error('The @aws-sdk/client-s3 package is not installed.', {
          cause: importError,
        })
      }

      const response = await (this.s3Client as S3Client).send(
        new GetObjectCommand({
          Bucket: this.config.bucket,
          Key: fullKey,
        }),
      )

      // Process the stream into a buffer
      return await new Promise<Uint8Array>((resolve, reject) => {
        const chunks: Uint8Array[] = []
        // The type is handled at runtime - AWS SDK v3 provides proper typed responses
        const body = (response as unknown as { Body: NodeJS.ReadableStream })
          .Body
        body.on('data', (chunk: Uint8Array) => chunks.push(chunk))
        body.on('end', () => resolve(concatUint8Arrays(chunks)))
        body.on('error', reject)
      })
    } catch (error: unknown) {
      logger.error(
        `Error getting file ${key} from S3: ${error instanceof Error ? String(error) : String(error)}`,
      )
      throw new Error(`File not found in S3: ${key}`, { cause: error })
    }
  }

  async listFiles(pattern?: string): Promise<string[]> {
    try {
      // Import the ListObjectsV2Command dynamically
      let ListObjectsV2Command: any
      try {
        const { ListObjectsV2Command: LOC } = await import('@aws-sdk/client-s3')
        ListObjectsV2Command = LOC
      } catch (importError) {
        logger.error(
          `Failed to import ListObjectsV2Command: ${importError instanceof Error ? importError.message : String(importError)}`,
        )
        throw new Error('The @aws-sdk/client-s3 package is not installed.', {
          cause: importError,
        })
      }

      const { prefix } = this.config

      const results: string[] = []
      let continuationToken: string | undefined

      do {
        const listCommand = new ListObjectsV2Command({
          Bucket: this.config.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })

        const response = await (this.s3Client as S3Client).send(listCommand)
        const typedResponse = response as unknown as {
          Contents?: Array<{ Key?: string }>
          NextContinuationToken?: string
        }

        // Process the contents
        if (typedResponse.Contents) {
          for (const item of typedResponse.Contents) {
            if (item.Key) {
              // Remove the prefix from the key to get the relative path
              const relativePath = item.Key.slice(prefix.length)

              // Skip empty keys or directory markers
              if (
                relativePath &&
                !relativePath.endsWith('/') &&
                (!pattern || matchesPattern(relativePath, pattern))
              ) {
                results.push(relativePath)
              }
            }
          }
        }

        continuationToken = typedResponse.NextContinuationToken
      } while (continuationToken)

      return results
    } catch (error: unknown) {
      logger.error(
        `Error listing files in S3: ${error instanceof Error ? String(error) : String(error)}`,
      )
      return []
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const fullKey = this.getFullKey(key)
      // Import the DeleteObjectCommand dynamically
      let DeleteObjectCommand: any
      try {
        const { DeleteObjectCommand: DOC } = await import('@aws-sdk/client-s3')
        DeleteObjectCommand = DOC
      } catch (importError) {
        logger.error(
          `Failed to import DeleteObjectCommand: ${importError instanceof Error ? importError.message : String(importError)}`,
        )
        throw new Error('The @aws-sdk/client-s3 package is not installed.', {
          cause: importError,
        })
      }

      await (this.s3Client as S3Client).send(
        new DeleteObjectCommand({
          Bucket: this.config.bucket,
          Key: fullKey,
        }),
      )

      logger.debug(
        `Deleted file ${fullKey} from S3 bucket ${this.config.bucket}`,
      )
    } catch (error: unknown) {
      logger.error(
        `Error deleting file ${key} from S3: ${error instanceof Error ? String(error) : String(error)}`,
      )
      throw new Error(
        `Failed to delete file from S3: ${error instanceof Error ? String(error) : String(error)}`,
        { cause: error },
      )
    }
  }

  private getFullKey(key: string): string {
    // Validate key for security - prevent directory traversal in cloud storage keys
    if (!key || typeof key !== 'string') {
      throw new Error('Invalid key provided')
    }

    // Reject keys with directory traversal sequences
    if (key.includes('..') || key.includes('../') || key.includes('..\\')) {
      throw new Error(
        'Directory traversal sequences (..) are not allowed in keys',
      )
    }

    // Reject keys with absolute paths
    if (key.startsWith('/')) {
      throw new Error('Absolute paths are not allowed in keys')
    }

    // Reject keys with unsafe characters
    // eslint-disable-next-line no-control-regex
    const unsafeChars = /[<>:"|?*\u0000-\u001f]/
    if (unsafeChars.test(key)) {
      throw new Error('Key contains unsafe characters')
    }

    // Reject keys that are too long (prevent resource exhaustion)
    if (key.length > 1024) {
      throw new Error('Key is too long')
    }

    return this.config.prefix ? `${this.config.prefix}${key}` : key
  }
}

/**
 * Google Cloud Storage Provider
 * Production-ready storage provider for Google Cloud Storage
 */
export class GoogleCloudStorageProvider implements StorageProvider {
  private storage: GCSStorage | null = null
  private bucket: GCSBucket | null = null
  private config: {
    bucketName: string
    prefix: string
    keyFilename?: string
    credentials?: Record<string, unknown>
  }

  constructor(config: Record<string, unknown>) {
    const bucketName = config['bucketName'] as string
    const prefix = (config['prefix'] as string) || ''
    const keyFilename = config['keyFilename'] as string | undefined
    const credentials = config['credentials'] as
      | Record<string, unknown>
      | undefined

    this.config = {
      bucketName,
      prefix,
      ...(keyFilename && { keyFilename }),
      ...(credentials && { credentials }),
    }

    if (!this.config.bucketName) {
      throw new Error('GCS bucket name is required')
    }
  }

  async initialize(): Promise<void> {
    try {
      // Dynamically import the GCS library
      // Note: This requires installing @google-cloud/storage as a dependency
      // if you intend to use this provider in production
      // Define a narrow constructor type for the Storage client to avoid `any`
      type GCSConstructor = new (options?: Record<string, unknown>) => {
        bucket(name: string): GCSBucket
      }

      let Storage: GCSConstructor | undefined = undefined
      try {
        // Using dynamic import with type assertion to avoid TypeScript errors
        const gcsModule = await import('@google-cloud/storage' as string)
        Storage = (gcsModule as { Storage?: GCSConstructor }).Storage
      } catch (importError) {
        logger.error(
          `Failed to import @google-cloud/storage: ${importError instanceof Error ? importError.message : String(importError)}`,
        )
        throw new Error(
          'The @google-cloud/storage package is not installed. Please install it with: pnpm add @google-cloud/storage',
          { cause: importError },
        )
      }

      const options: Record<string, unknown> = {}

      if (this.config.keyFilename) {
        options['keyFilename'] = this.config.keyFilename
      }

      if (this.config.credentials) {
        options['credentials'] = this.config.credentials
      }

      if (!Storage) {
        throw new Error('Failed to load GCS Storage constructor', {
          cause: new Error('Missing Storage export'),
        })
      }

      this.storage = new Storage(options) as unknown as GCSStorage
      this.bucket = this.storage.bucket(this.config.bucketName)

      logger.info(
        `Initialized Google Cloud Storage provider for bucket: ${this.config.bucketName}`,
      )
    } catch (error: unknown) {
      logger.error(
        `Failed to initialize GCS provider: ${error instanceof Error ? String(error) : String(error)}`,
      )
      throw new Error(
        `Failed to initialize GCS provider: ${error instanceof Error ? String(error) : String(error)}`,
        { cause: error },
      )
    }
  }

  async storeFile(key: string, data: Uint8Array): Promise<void> {
    try {
      const fullKey = this.getFullKey(key)
      const file = (this.bucket as GCSBucket).file(fullKey)

      await file.save(data, {
        contentType: 'application/octet-stream',
        resumable: false,
      })

      logger.debug(
        `Stored file ${fullKey} in GCS bucket ${this.config.bucketName}`,
      )
    } catch (error: unknown) {
      logger.error(
        `Error storing file ${key} in GCS: ${error instanceof Error ? String(error) : String(error)}`,
      )
      throw new Error(
        `Failed to store file in GCS: ${error instanceof Error ? String(error) : String(error)}`,
        { cause: error },
      )
    }
  }

  async getFile(key: string): Promise<Uint8Array> {
    try {
      const fullKey = this.getFullKey(key)
      const file = (this.bucket as GCSBucket).file(fullKey)

      const [contents] = await file.download()
      return new Uint8Array(contents)
    } catch (error: unknown) {
      logger.error(
        `Error getting file ${key} from GCS: ${error instanceof Error ? String(error) : String(error)}`,
      )
      throw new Error(`File not found in GCS: ${key}`, { cause: error })
    }
  }

  async listFiles(pattern?: string): Promise<string[]> {
    try {
      const options: Record<string, unknown> = {}
      if (this.config.prefix) {
        options['prefix'] = this.config.prefix
      }

      const [files] = await (this.bucket as GCSBucket).getFiles(options)

      const results: string[] = []
      for (const file of files) {
        // Remove the prefix to get the relative path
        const key = file.name
        const relativePath = this.config.prefix
          ? key.slice(this.config.prefix.length)
          : key

        if (
          relativePath &&
          !relativePath.endsWith('/') &&
          (!pattern || matchesPattern(relativePath, pattern))
        ) {
          results.push(relativePath)
        }
      }

      return results
    } catch (error: unknown) {
      logger.error(
        `Error listing files in GCS: ${error instanceof Error ? String(error) : String(error)}`,
      )
      return []
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const fullKey = this.getFullKey(key)
      const file = (this.bucket as GCSBucket).file(fullKey)

      await file.delete()
      logger.debug(
        `Deleted file ${fullKey} from GCS bucket ${this.config.bucketName}`,
      )
    } catch (error: unknown) {
      logger.error(
        `Error deleting file ${key} from GCS: ${error instanceof Error ? String(error) : String(error)}`,
      )
      throw new Error(
        `Failed to delete file from GCS: ${error instanceof Error ? String(error) : String(error)}`,
        { cause: error },
      )
    }
  }

  private getFullKey(key: string): string {
    // Validate key for security - prevent directory traversal in cloud storage keys
    if (!key || typeof key !== 'string') {
      throw new Error('Invalid key provided')
    }

    // Reject keys with directory traversal sequences
    if (key.includes('..') || key.includes('../') || key.includes('..\\')) {
      throw new Error(
        'Directory traversal sequences (..) are not allowed in keys',
      )
    }

    // Reject keys with absolute paths
    if (key.startsWith('/')) {
      throw new Error('Absolute paths are not allowed in keys')
    }

    // Reject keys with unsafe characters
    // eslint-disable-next-line no-control-regex
    const unsafeChars = /[<>:"|?*\u0000-\u001f]/
    if (unsafeChars.test(key)) {
      throw new Error('Key contains unsafe characters')
    }

    // Reject keys that are too long (prevent resource exhaustion)
    if (key.length > 1024) {
      throw new Error('Key is too long')
    }

    return this.config.prefix ? `${this.config.prefix}${key}` : key
  }
}

/**
 * Azure Blob Storage Provider
 * Production-ready storage provider for Azure Blob Storage
 */
export class AzureBlobStorageProvider implements StorageProvider {
  private blobServiceClient: AzureBlobServiceClient | null = null
  private containerClient: AzureContainerClient | null = null
  private config: {
    connectionString?: string
    accountName?: string
    accountKey?: string
    containerName: string
    prefix: string
  }

  constructor(config: Record<string, unknown>) {
    const connectionString = config['connectionString'] as string | undefined
    const accountName = config['accountName'] as string | undefined
    const accountKey = config['accountKey'] as string | undefined
    const containerName = config['containerName'] as string
    const prefix = (config['prefix'] as string) || ''

    this.config = {
      ...(connectionString && { connectionString }),
      ...(accountName && { accountName }),
      ...(accountKey && { accountKey }),
      containerName,
      prefix,
    }

    if (!this.config.containerName) {
      throw new Error('Azure Blob Storage container name is required')
    }

    if (
      !this.config.connectionString &&
      !(this.config.accountName && this.config.accountKey)
    ) {
      throw new Error(
        'Either connectionString or both accountName and accountKey must be provided',
      )
    }
  }

  async initialize(): Promise<void> {
    try {
      // Dynamically import Azure Storage Blob library
      // Note: This requires installing @azure/storage-blob as a dependency
      // if you intend to use this provider in production
      let BlobServiceClient: any
      let StorageSharedKeyCredential: any

      try {
        // Using dynamic import with type assertion to avoid TypeScript errors
        const azureModule = await import('@azure/storage-blob')
        BlobServiceClient = azureModule.BlobServiceClient
        StorageSharedKeyCredential = azureModule.StorageSharedKeyCredential
      } catch (importError) {
        logger.error(
          `Failed to import @azure/storage-blob: ${importError instanceof Error ? importError.message : String(importError)}`,
        )
        throw new Error(
          'The @azure/storage-blob package is not installed. Please install it with: pnpm add @azure/storage-blob',
          { cause: importError },
        )
      }

      if (this.config.connectionString) {
        this.blobServiceClient = BlobServiceClient.fromConnectionString(
          this.config.connectionString,
        ) as unknown as AzureBlobServiceClient
      } else {
        const credential = new StorageSharedKeyCredential(
          this.config.accountName!,
          this.config.accountKey!,
        )

        const url = `https://${this.config.accountName}.blob.core.windows.net`
        this.blobServiceClient = new BlobServiceClient(
          url,
          credential,
        ) as unknown as AzureBlobServiceClient
      }

      this.containerClient = this.blobServiceClient.getContainerClient(
        this.config.containerName,
      )

      // Create the container if it doesn't exis
      await this.containerClient.createIfNotExists()

      logger.info(
        `Initialized Azure Blob Storage provider for container: ${this.config.containerName}`,
      )
    } catch (error: unknown) {
      logger.error(
        `Failed to initialize Azure Blob Storage provider: ${error instanceof Error ? String(error) : String(error)}`,
      )
      throw new Error(
        `Failed to initialize Azure Blob Storage provider: ${error instanceof Error ? String(error) : String(error)}`,
        { cause: error },
      )
    }
  }

  async storeFile(key: string, data: Uint8Array): Promise<void> {
    try {
      const fullKey = this.getFullKey(key)
      const blockBlobClient = (
        this.containerClient as AzureContainerClient
      ).getBlockBlobClient(fullKey)

      await blockBlobClient.upload(data, data.length, {
        blobHTTPHeaders: {
          blobContentType: 'application/octet-stream',
        },
      })

      logger.debug(
        `Stored file ${fullKey} in Azure container ${this.config.containerName}`,
      )
    } catch (error: unknown) {
      logger.error(
        `Error storing file ${key} in Azure: ${error instanceof Error ? String(error) : String(error)}`,
      )
      throw new Error(
        `Failed to store file in Azure: ${error instanceof Error ? String(error) : String(error)}`,
        { cause: error },
      )
    }
  }

  async getFile(key: string): Promise<Uint8Array> {
    try {
      const fullKey = this.getFullKey(key)
      const blockBlobClient = (
        this.containerClient as AzureContainerClient
      ).getBlockBlobClient(fullKey)

      const downloadResponse = await blockBlobClient.download(0)
      const chunks: Uint8Array[] = []

      return new Promise<Uint8Array>((resolve, reject) => {
        const readableStream = downloadResponse.readableStreamBody!

        readableStream.on('data', (chunk: Uint8Array) => {
          chunks.push(chunk)
        })

        readableStream.on('end', () => {
          resolve(concatUint8Arrays(chunks))
        })

        readableStream.on('error', (error: Error) => {
          reject(error)
        })
      })
    } catch (error: unknown) {
      logger.error(
        `Error getting file ${key} from Azure: ${error instanceof Error ? String(error) : String(error)}`,
      )
      throw new Error(`File not found in Azure: ${key}`, { cause: error })
    }
  }

  async listFiles(pattern?: string): Promise<string[]> {
    try {
      const results: string[] = []
      const options = { prefix: this.config.prefix }

      // List all blobs in the container
      for await (const blob of (
        this.containerClient as AzureContainerClient
      ).listBlobsFlat(options)) {
        // Remove the prefix to get the relative path
        const key = blob.name
        const relativePath = this.config.prefix
          ? key.slice(this.config.prefix.length)
          : key

        if (
          relativePath &&
          !relativePath.endsWith('/') &&
          (!pattern || matchesPattern(relativePath, pattern))
        ) {
          results.push(relativePath)
        }
      }

      return results
    } catch (error: unknown) {
      logger.error(
        `Error listing files in Azure: ${error instanceof Error ? String(error) : String(error)}`,
      )
      return []
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const fullKey = this.getFullKey(key)
      const blockBlobClient = (
        this.containerClient as AzureContainerClient
      ).getBlockBlobClient(fullKey)

      await blockBlobClient.delete()
      logger.debug(
        `Deleted file ${fullKey} from Azure container ${this.config.containerName}`,
      )
    } catch (error: unknown) {
      logger.error(
        `Error deleting file ${key} from Azure: ${error instanceof Error ? String(error) : String(error)}`,
      )
      throw new Error(
        `Failed to delete file from Azure: ${error instanceof Error ? String(error) : String(error)}`,
        { cause: error },
      )
    }
  }

  private getFullKey(key: string): string {
    // Validate key for security - prevent directory traversal in cloud storage keys
    if (!key || typeof key !== 'string') {
      throw new Error('Invalid key provided')
    }

    // Reject keys with directory traversal sequences
    if (key.includes('..') || key.includes('../') || key.includes('..\\')) {
      throw new Error(
        'Directory traversal sequences (..) are not allowed in keys',
      )
    }

    // Reject keys with absolute paths
    if (key.startsWith('/')) {
      throw new Error('Absolute paths are not allowed in keys')
    }

    // Reject keys with unsafe characters
    // eslint-disable-next-line no-control-regex
    const unsafeChars = /[<>:"|?*\u0000-\u001f]/
    if (unsafeChars.test(key)) {
      throw new Error('Key contains unsafe characters')
    }

    // Reject keys that are too long (prevent resource exhaustion)
    if (key.length > 1024) {
      throw new Error('Key is too long')
    }

    return this.config.prefix ? `${this.config.prefix}${key}` : key
  }
}

/**
 * Factory function to get a storage provider instance
 */
export function getStorageProvider(
  provider: string,
  config: Record<string, unknown>,
): StorageProvider {
  switch (provider.toLowerCase()) {
    case 'file':
    case 'filesystem':
    case 'local':
      return new FileSystemStorageProvider(config)

    case 'memory':
    case 'in-memory':
      return new InMemoryStorageProvider()

    case 'aws-s3':
      return new AWSS3StorageProvider(config)

    case 'google-cloud-storage':
    case 'gcs':
      return new GoogleCloudStorageProvider(config)

    case 'azure-blob-storage':
    case 'azure':
      return new AzureBlobStorageProvider(config)

    case 'mock-aws':
    case 'mock-s3':
    case 'mock-cloud':
      return new MockCloudStorageProvider({
        ...config,
        provider: 'aws-s3',
      })

    case 'mock-gcp':
    case 'mock-gcs':
      return new MockCloudStorageProvider({
        ...config,
        provider: 'google-cloud-storage',
      })

    default:
      // For development/testing, use mock cloud as defaul
      logger.warn(
        `Unknown storage provider "${provider}". Using mock cloud provider.`,
      )
      return new MockCloudStorageProvider({
        ...config,
        provider: provider || 'default-provider',
      })
  }
}

// Helper function to replace Buffer.concat
function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  // Calculate the total length
  const totalLength = arrays.reduce((acc, arr) => acc + arr.byteLength, 0)

  // Create a new array with the total length
  const result = new Uint8Array(totalLength)

  // Copy each array into the result
  let offset = 0
  for (const arr of arrays) {
    result.set(arr, offset)
    offset += arr.byteLength
  }

  return result
}
