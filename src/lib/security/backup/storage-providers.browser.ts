/**
 * Browser-compatible version of storage providers
 * This file provides browser-safe implementations of storage providers
 * without requiring Node.js-specific modules like fs, path, or crypto.
 */

import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const logger = createBuildSafeLogger('backup-storage-browser')

/**
 * Utility function for simple glob-like pattern matching
 * @param filePath The file path to check
 * @param pattern The glob pattern to match agains
 * @returns Whether the file path matches the pattern
 */
function matchesPattern(filePath: string, pattern: string): boolean {
  // Simple glob-like pattern matching
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
 * In-Memory Storage Provider (browser-compatible)
 * Stores backups in memory - not persistent between page reloads
 */
export class InMemoryStorageProvider implements StorageProvider {
  private storage: Map<string, Uint8Array> = new Map()

  async initialize(): Promise<void> {
    this.storage.clear()
    logger.info('Initialized in-memory storage (browser)')
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
    return data
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
 * Local Storage Provider (browser-compatible)
 * Uses browser's localStorage API (with size limitations)
 */
export class LocalStorageProvider implements StorageProvider {
  private prefix: string

  constructor(config: Record<string, unknown>) {
    this.prefix = (config.prefix as string) || 'backup-'
  }

  async initialize(): Promise<void> {
    logger.info('Initialized localStorage provider')
  }

  async storeFile(key: string, data: Uint8Array): Promise<void> {
    try {
      // Convert Uint8Array to Base64 string for storage
      const base64Data = btoa(String.fromCharCode.apply(null, Array.from(data)))

      // Store with prefix
      localStorage.setItem(this.prefix + key, base64Data)
      logger.debug(`Stored file with key ${key} in localStorage`)
    } catch (error: unknown) {
      // Handle quota exceeded or other storage errors
      logger.error(
        `Failed to store file in localStorage: ${error instanceof Error ? String(error) : String(error)}`,
      )
      throw new Error(
        `LocalStorage error: ${error instanceof Error ? String(error) : String(error)}`,
        { cause: error },
      )
    }
  }

  async getFile(key: string): Promise<Uint8Array> {
    const data = localStorage.getItem(this.prefix + key)

    if (!data) {
      throw new Error(`File not found in localStorage: ${key}`)
    }

    // Convert Base64 string back to Uint8Array
    const binary = atob(data)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  }

  async listFiles(pattern?: string): Promise<string[]> {
    const keys: string[] = []

    // Iterate all localStorage keys
    for (let i = 0; i < localStorage.length; i++) {
      const fullKey = localStorage.key(i)

      if (fullKey && fullKey.startsWith(this.prefix)) {
        // Remove prefix to get the actual key
        const key = fullKey.substring(this.prefix.length)

        // Apply pattern matching if provided
        if (!pattern || matchesPattern(key, pattern)) {
          keys.push(key)
        }
      }
    }

    return keys
  }

  async deleteFile(key: string): Promise<void> {
    localStorage.removeItem(this.prefix + key)
    logger.debug(`Deleted file with key ${key} from localStorage`)
  }
}

/**
 * IndexedDB Storage Provider (browser-compatible)
 * Uses IndexedDB for larger storage capabilities
 */
export class IndexedDBStorageProvider implements StorageProvider {
  private dbName: string
  private storeName: string
  private db: IDBDatabase | null = null

  constructor(config: Record<string, unknown>) {
    this.dbName = (config.dbName as string) || 'backupStorage'
    this.storeName = (config.storeName as string) || 'backups'
  }

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB is not supported in this browser'))
        return
      }

      const request = indexedDB.open(this.dbName, 1)

      request.onerror = (event) => {
        logger.error('Failed to open IndexedDB', {
          error:
            (event.target as IDBOpenDBRequest)?.error?.message ||
            'Unknown error',
        })
        reject(new Error('Failed to open IndexedDB'))
      }

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result
        logger.info('Initialized IndexedDB storage provider')
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        // Create object store for backups if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName)
        }
      }
    })
  }

  async storeFile(key: string, data: Uint8Array): Promise<void> {
    if (!this.db) {
      throw new Error('IndexedDB not initialized')
    }

    return new Promise((resolve, reject) => {
      // Convert Uint8Array to ArrayBuffer for storage
      const arrayBuffer = data.buffer

      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.put(arrayBuffer, key)

      request.onsuccess = () => {
        logger.debug(`Stored file with key ${key} in IndexedDB`)
        resolve()
      }

      request.onerror = (event) => {
        logger.error(
          `Failed to store file in IndexedDB: ${(event.target as IDBRequest).error}`,
        )
        reject(
          new Error(`IndexedDB error: ${(event.target as IDBRequest).error}`),
        )
      }
    })
  }

  async getFile(key: string): Promise<Uint8Array> {
    if (!this.db) {
      throw new Error('IndexedDB not initialized')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.get(key)

      request.onsuccess = () => {
        if (request.result) {
          // Convert ArrayBuffer back to Uint8Array
          const arrayBuffer = request.result as ArrayBuffer
          resolve(new Uint8Array(arrayBuffer))
        } else {
          reject(new Error(`File not found in IndexedDB: ${key}`))
        }
      }

      request.onerror = (event) => {
        reject(
          new Error(`IndexedDB error: ${(event.target as IDBRequest).error}`),
        )
      }
    })
  }

  async listFiles(pattern?: string): Promise<string[]> {
    if (!this.db) {
      throw new Error('IndexedDB not initialized')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.getAllKeys()

      request.onsuccess = () => {
        const keys = Array.from(request.result as IDBValidKey[])
          .map((key) => key.toString())
          // Apply pattern matching if provided
          .filter((key) => !pattern || matchesPattern(key, pattern))

        resolve(keys)
      }

      request.onerror = (event) => {
        reject(
          new Error(`IndexedDB error: ${(event.target as IDBRequest).error}`),
        )
      }
    })
  }

  async deleteFile(key: string): Promise<void> {
    if (!this.db) {
      throw new Error('IndexedDB not initialized')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.delete(key)

      request.onsuccess = () => {
        logger.debug(`Deleted file with key ${key} from IndexedDB`)
        resolve()
      }

      request.onerror = (event) => {
        reject(
          new Error(`IndexedDB error: ${(event.target as IDBRequest).error}`),
        )
      }
    })
  }
}

export function getStorageProvider(
  provider: string,
  config: Record<string, unknown> = {},
): StorageProvider {
  switch (provider.toLowerCase()) {
    case 'memory':
    case 'in-memory':
      return new InMemoryStorageProvider()
    case 'localstorage':
    case 'local-storage':
      return new LocalStorageProvider(config)
    case 'indexeddb':
    case 'indexed-db':
      return new IndexedDBStorageProvider(config)
    default:
      logger.warn(
        `Unknown provider "${provider}" in browser, defaulting to in-memory storage`,
      )
      return new InMemoryStorageProvider()
  }
}

// Default export for module
export default {
  getStorageProvider,
  InMemoryStorageProvider,
  LocalStorageProvider,
  IndexedDBStorageProvider,
}
