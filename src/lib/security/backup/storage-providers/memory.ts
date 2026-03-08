/**
 * In-Memory Storage Provider
 *
 * A simple storage provider that stores files in memory
 * This is useful for testing or as a fallback when other providers are unavailable
 */

import type { StorageProvider, StorageProviderConfig } from '../backup-types'

export class InMemoryStorageProvider implements StorageProvider {
  private storage: Map<string, Uint8Array> = new Map()
  private initialized = false

  constructor(config: StorageProviderConfig) {
    console.log('InMemoryStorageProvider config:', config)
  }

  async initialize(): Promise<void> {
    this.initialized = true
    console.info('In-memory storage provider initialized')
  }

  async listFiles(pattern?: string): Promise<string[]> {
    this.checkInitialized()

    if (!pattern) {
      return Array.from(this.storage.keys())
    }

    // Simple glob pattern matching
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')

    const regex = new RegExp(`^${regexPattern}$`)

    return Array.from(this.storage.keys()).filter((key) => regex.test(key))
  }

  async storeFile(key: string, data: Uint8Array): Promise<void> {
    this.checkInitialized()

    // Clone the data to prevent external modifications
    const clonedData = new Uint8Array(data)
    this.storage.set(key, clonedData)
  }

  async getFile(key: string): Promise<Uint8Array> {
    this.checkInitialized()

    const data = this.storage.get(key)
    if (!data) {
      throw new Error(`File not found: ${key}`)
    }

    // Return a copy to prevent external modification of stored data
    return new Uint8Array(data)
  }

  async deleteFile(key: string): Promise<void> {
    this.checkInitialized()

    if (!this.storage.has(key)) {
      console.warn(`File not found for deletion: ${key}`)
      return
    }

    this.storage.delete(key)
  }

  private checkInitialized() {
    if (!this.initialized) {
      throw new Error('Storage provider not initialized')
    }
  }
}
