/**
 * Local Filesystem Storage Provider
 *
 * This is a server-only module that provides local filesystem storage integration
 * It uses dynamic imports to prevent bundling Node.js modules with client code
 */

import type { StorageProviderConfig } from '../backup-types'
import type { Dirent } from 'fs'

interface FileSystem {
  mkdir: (
    path: string,
    options?: { recursive?: boolean },
  ) => Promise<string | undefined>
  readdir: (path: string, options: { withFileTypes: true }) => Promise<Dirent[]>
  writeFile: (path: string, data: Uint8Array) => Promise<void>
  readFile: (path: string) => Promise<Buffer>
  access: (path: string) => Promise<void>
  unlink: (path: string) => Promise<void>
}

interface PathModule {
  join: (...paths: string[]) => string
  dirname: (path: string) => string
  relative: (from: string, to: string) => string
}

export interface StorageProvider {
  initialize(): Promise<void>
  listFiles(pattern?: string): Promise<string[]>
}

export class LocalFileSystemProvider implements StorageProvider {
  private basePath: string
  private fs: FileSystem | null = null
  private path: PathModule | null = null
  private initialized = false

  constructor(config: StorageProviderConfig) {
    this.basePath = (config.path as string) || ''
    if (!this.basePath) {
      throw new Error('Path is required for local filesystem storage provider')
    }
  }

  async initialize(): Promise<void> {
    try {
      // Dynamically import Node.js modules to prevent bundling with client code
      const fsModule = await import('fs/promises')
      const pathModule = await import('path')

      this.fs = {
        mkdir: fsModule.mkdir,
        readdir: fsModule.readdir,
        writeFile: fsModule.writeFile,
        readFile: fsModule.readFile,
        access: fsModule.access,
        unlink: fsModule.unlink,
      }

      this.path = {
        join: pathModule.join,
        dirname: pathModule.dirname,
        relative: pathModule.relative,
      }

      // Create base directory if it doesn't exist
      await this.fs.mkdir(this.basePath, { recursive: true })

      this.initialized = true
      console.info(
        `Local filesystem storage provider initialized with base path: ${this.basePath}`,
      )
    } catch (error: unknown) {
      console.error(
        'Failed to initialize local filesystem storage provider:',
        error,
      )
      throw new Error(
        `Local filesystem initialization failed: ${error instanceof Error ? String(error) : String(error)}`,
        { cause: error },
      )
    }
  }

  async listFiles(pattern?: string): Promise<string[]> {
    this.checkInitialized()

    try {
      // List all files recursively
      const allFiles = await this.listFilesRecursively(this.basePath)

      // Convert absolute paths to relative paths
      const relativeFiles = allFiles.map((file) =>
        this.path!.relative(this.basePath, file),
      )

      // Filter by pattern if provided
      if (pattern) {
        const regexPattern = pattern
          .replace(/\./g, '\\.')
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.')

        const regex = new RegExp(`^${regexPattern}$`)
        return relativeFiles.filter((name) => regex.test(name))
      }

      return relativeFiles
    } catch (error: unknown) {
      console.error('Failed to list files from local filesystem:', error)
      throw new Error(
        `Failed to list files: ${error instanceof Error ? String(error) : String(error)}`,
        { cause: error },
      )
    }
  }

  async storeFile(key: string, data: Uint8Array): Promise<void> {
    this.checkInitialized()

    try {
      // Create full path
      const fullPath = this.path!.join(this.basePath, key)

      // Create directory structure if needed
      const dir = this.path!.dirname(fullPath)
      await this.fs!.mkdir(dir, { recursive: true })

      // Write file
      await this.fs!.writeFile(fullPath, data)
    } catch (error: unknown) {
      console.error(`Failed to store file ${key} to local filesystem:`, error)
      throw new Error(
        `Failed to store file: ${error instanceof Error ? String(error) : String(error)}`,
        { cause: error },
      )
    }
  }

  async getFile(key: string): Promise<Uint8Array> {
    this.checkInitialized()

    try {
      // Create full path
      const fullPath = this.path!.join(this.basePath, key)

      // Check if file exists
      await this.fs!.access(fullPath)

      // Read file
      const data = await this.fs!.readFile(fullPath)

      return new Uint8Array(data)
    } catch (error: unknown) {
      console.error(`Failed to get file ${key} from local filesystem:`, error)
      throw new Error(
        `Failed to get file: ${error instanceof Error ? String(error) : String(error)}`,
        { cause: error },
      )
    }
  }

  async deleteFile(key: string): Promise<void> {
    this.checkInitialized()

    try {
      // Create full path
      const fullPath = this.path!.join(this.basePath, key)

      // Check if file exists
      try {
        await this.fs!.access(fullPath)
      } catch {
        console.warn(`File not found for deletion: ${key}`)
        return
      }

      // Delete file
      await this.fs!.unlink(fullPath)
    } catch (error: unknown) {
      console.error(
        `Failed to delete file ${key} from local filesystem:`,
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
      throw new Error('Local filesystem storage provider not initialized')
    }
  }

  // Helper method to list files recursively
  private async listFilesRecursively(dir: string): Promise<string[]> {
    const entries = await this.fs!.readdir(dir, { withFileTypes: true })

    const files = await Promise.all(
      entries.map(async (entry: Dirent) => {
        const fullPath = this.path!.join(dir, entry.name)
        return entry.isDirectory()
          ? await this.listFilesRecursively(fullPath)
          : fullPath
      }),
    )

    return files.flat()
  }
}
