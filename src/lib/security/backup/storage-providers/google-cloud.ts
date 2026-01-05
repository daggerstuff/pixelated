/**
 * Google Cloud Storage Provider
 *
 * This is a server-only module that provides Google Cloud Storage integration
 * It uses dynamic imports to prevent bundling Node.js modules with client code
 */

import type { StorageProvider, StorageProviderConfig } from '../backup-types'

interface GoogleCloudCredentials {
  project_id: string
  client_email: string
  private_key: string
  [key: string]: string
}

interface GoogleCloudStorageOptions {
  apiEndpoint?: string
  autoRetry?: boolean
  maxRetries?: number
  promise?: Promise<unknown>
  timeout?: number
  [key: string]: unknown
}

interface GoogleCloudStorage {
  bucket: (name: string) => GoogleCloudBucket
}

interface GoogleCloudBucket {
  file: (name: string) => GoogleCloudFile
  getFiles: (options: GoogleCloudListOptions) => Promise<[GoogleCloudFile[]]>
}

interface GoogleCloudFile {
  name: string
  exists: () => Promise<[boolean]>
  download: () => Promise<[Buffer]>
  delete: () => Promise<void>
  createWriteStream: (
    options: GoogleCloudWriteStreamOptions,
  ) => NodeJS.WritableStream
}

interface GoogleCloudListOptions {
  prefix?: string
  delimiter?: string
  autoPaginate?: boolean
  maxResults?: number
}

interface GoogleCloudWriteStreamOptions {
  resumable: boolean
  metadata: {
    contentType: string
  }
}

export class GoogleCloudStorageProvider implements StorageProvider {
  private storage: GoogleCloudStorage | null = null
  private bucket: GoogleCloudBucket | null = null
  private bucketName: string
  private initialized = false

  constructor(private config: StorageProviderConfig) {
    this.bucketName = (config.bucket as string) || ''
    if (!this.bucketName) {
      throw new Error(
        'Bucket name is required for Google Cloud Storage provider',
      )
    }
  }

  async initialize(): Promise<void> {
    try {
      // Dynamically import Google Cloud Storage to prevent bundling with client code
      const { Storage } = await import('@google-cloud/storage')

      // Create Storage instance with provided credentials
      this.storage = new Storage({
        credentials: this.config.credentials as GoogleCloudCredentials,
        projectId: (this.config.credentials as GoogleCloudCredentials)
          ?.project_id,
        ...(this.config.options as GoogleCloudStorageOptions),
      }) as any

      this.bucket = this.storage!.bucket(this.bucketName)
      this.initialized = true

      console.info(
        `Google Cloud Storage provider initialized for bucket: ${this.bucketName}`,
      )
    } catch (error: unknown) {
      console.error(
        'Failed to initialize Google Cloud Storage provider:',
        error,
      )
      throw new Error(
        `Google Cloud Storage initialization failed: ${error instanceof Error ? String(error) : String(error)}`,
        { cause: error },
      )
    }
  }

  async listFiles(pattern?: string): Promise<string[]> {
    this.checkInitialized()

    try {
      const options: GoogleCloudListOptions = {}

      // Add prefix filter if a pattern is provided
      if (pattern) {
        const patternParts = pattern.split('*')
        if (patternParts.length > 1) {
          // Use the part before the first wildcard as prefix
          options.prefix = patternParts[0]
        } else {
          options.prefix = pattern
        }
      }

      const [files] = await this.bucket!.getFiles(options)
      const fileNames = files.map((file) => file.name)

      // Additional filtering for more complex patterns
      if (pattern && pattern.includes('*')) {
        const regexPattern = pattern
          .replace(/\./g, '\\.')
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.')

        const regex = new RegExp(`^${regexPattern}$`)
        return fileNames.filter((name) => regex.test(name))
      }

      return fileNames
    } catch (error: unknown) {
      console.error('Failed to list files from Google Cloud Storage:', error)
      throw new Error(
        `Failed to list files: ${error instanceof Error ? String(error) : String(error)}`,
        { cause: error },
      )
    }
  }

  async storeFile(key: string, data: Uint8Array): Promise<void> {
    this.checkInitialized()

    try {
      const file = this.bucket!.file(key)

      await new Promise<void>((resolve, reject) => {
        const stream = file.createWriteStream({
          resumable: false,
          metadata: {
            contentType: 'application/octet-stream',
          },
        })

        stream.on('error', (err) => {
          reject(err)
        })

        stream.on('finish', () => {
          resolve()
        })

        // Convert Uint8Array to Buffer for Node.js
        const nodeBuffer = Buffer.from(data)
        stream.end(nodeBuffer)
      })
    } catch (error: unknown) {
      console.error(
        `Failed to store file ${key} to Google Cloud Storage:`,
        error,
      )
      throw new Error(
        `Failed to store file: ${error instanceof Error ? String(error) : String(error)}`,
        { cause: error },
      )
    }
  }

  async getFile(key: string): Promise<Uint8Array> {
    this.checkInitialized()

    try {
      const file = this.bucket!.file(key)

      // Check if file exists
      const [exists] = await file.exists()
      if (!exists) {
        throw new Error(`File not found: ${key}`)
      }

      // Download file content
      const [fileContent] = await file.download()

      // Convert Buffer to Uint8Array
      return new Uint8Array(fileContent)
    } catch (error: unknown) {
      console.error(
        `Failed to get file ${key} from Google Cloud Storage:`,
        error,
      )
      throw new Error(
        `Failed to get file: ${error instanceof Error ? String(error) : String(error)}`,
        { cause: error },
      )
    }
  }

  async deleteFile(key: string): Promise<void> {
    this.checkInitialized()

    try {
      const file = this.bucket!.file(key)

      // Check if file exists
      const [exists] = await file.exists()
      if (!exists) {
        console.warn(`File not found for deletion: ${key}`)
        return
      }

      // Delete the file
      await file.delete()
    } catch (error: unknown) {
      console.error(
        `Failed to delete file ${key} from Google Cloud Storage:`,
        error,
      )
      throw new Error(
        `Failed to delete file: ${error instanceof Error ? String(error) : String(error)}`,
        { cause: error },
      )
    }
  }

  private checkInitialized() {
    if (!this.initialized) {
      throw new Error('Google Cloud Storage provider not initialized')
    }
  }
}
