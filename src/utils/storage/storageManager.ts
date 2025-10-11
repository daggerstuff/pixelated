/**
 * Storage Manager - Centralized state persistence system
 * Handles localStorage, sessionStorage, and memory storage with fallbacks
 */

export interface StorageConfig {
  key: string
  storage: 'localStorage' | 'sessionStorage' | 'memory'
  serialize?: (data: any) => string
  deserialize?: (data: string) => any
  defaultValue?: any
  expiry?: number // in milliseconds
  encrypt?: boolean
}

export interface StorageManagerOptions {
  prefix?: string
  enableCompression?: boolean
  maxStorageSize?: number // in bytes
  fallbackStorage?: 'memory' | 'none'
}

class StorageManager {
  private options: Required<StorageManagerOptions>
  private memoryStorage = new Map<string, any>()
  private storageQuota: number

  constructor(options: StorageManagerOptions = {}) {
    this.options = {
      prefix: 'pixelated_',
      enableCompression: false,
      maxStorageSize: 5 * 1024 * 1024, // 5MB default
      fallbackStorage: 'memory',
      ...options,
    }
    this.storageQuota = this.calculateStorageQuota()
  }

  private calculateStorageQuota(): number {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        navigator.storage.estimate().then(estimate => {
          // Use 80% of available quota or default, whichever is smaller
          const availableQuota = estimate.quota || this.options.maxStorageSize
          this.storageQuota = Math.min(availableQuota * 0.8, this.options.maxStorageSize)
        })
      }
    } catch {
      // Fallback to default quota
    }
    return this.options.maxStorageSize
  }

  private getFullKey(key: string): string {
    return `${this.options.prefix}${key}`
  }

  private serialize(data: any): string {
    try {
      return JSON.stringify(data)
    } catch (error) {
      console.warn('Failed to serialize data:', error)
      return '{}'
    }
  }

  private deserialize(data: string): any {
    try {
      return JSON.parse(data)
    } catch (error) {
      console.warn('Failed to deserialize data:', error)
      return null
    }
  }

  private checkExpiry(timestamp: number, expiry: number): boolean {
    return Date.now() - timestamp > expiry
  }

  private isStorageAvailable(storage: Storage): boolean {
    try {
      const testKey = '__storage_test__'
      storage.setItem(testKey, 'test')
      storage.removeItem(testKey)
      return true
    } catch {
      return false
    }
  }

  private getStorage(): Storage | null {
    if (typeof window === 'undefined') return null

    if (this.isStorageAvailable(window.localStorage)) {
      return window.localStorage
    }
    if (this.options.fallbackStorage !== 'none' && this.isStorageAvailable(window.sessionStorage)) {
      return window.sessionStorage
    }
    return null
  }

  private compress(data: string): string {
    if (!this.options.enableCompression) return data
    try {
      // Simple compression using basic encoding
      return btoa(data)
    } catch {
      return data
    }
  }

  private decompress(data: string): string {
    if (!this.options.enableCompression) return data
    try {
      return atob(data)
    } catch {
      return data
    }
  }

  set(key: string, value: any, config: Partial<StorageConfig> = {}): boolean {
    try {
      const storageData = {
        value,
        timestamp: Date.now(),
        expiry: config.expiry,
      }

      const serializedData = this.serialize(storageData)
      const compressedData = this.compress(serializedData)

      // Check if data fits in storage quota
      if (compressedData.length > this.storageQuota) {
        console.warn(`Data size (${compressedData.length} bytes) exceeds storage quota (${this.storageQuota} bytes)`)
        return false
      }

      const fullKey = this.getFullKey(key)
      const storage = this.getStorage()

      if (storage) {
        storage.setItem(fullKey, compressedData)
      } else if (this.options.fallbackStorage === 'memory') {
        this.memoryStorage.set(fullKey, storageData)
      } else {
        console.warn('No storage available for key:', key)
        return false
      }

      return true
    } catch (error) {
      console.warn('Failed to set storage item:', error)
      return false
    }
  }

  get(key: string, config: Partial<StorageConfig> = {}): any {
    try {
      const fullKey = this.getFullKey(key)
      let storageData: any = null

      // Try persistent storage first
      const storage = this.getStorage()
      if (storage) {
        const storedValue = storage.getItem(fullKey)
        if (storedValue) {
          const decompressedData = this.decompress(storedValue)
          storageData = this.deserialize(decompressedData)
        }
      }

      // Fallback to memory storage
      if (!storageData && this.options.fallbackStorage === 'memory') {
        storageData = this.memoryStorage.get(fullKey)
      }

      // Check if data exists and hasn't expired
      if (!storageData) {
        return config.defaultValue
      }

      if (storageData.expiry && this.checkExpiry(storageData.timestamp, storageData.expiry)) {
        this.remove(key)
        return config.defaultValue
      }

      return storageData.value ?? config.defaultValue
    } catch (error) {
      console.warn('Failed to get storage item:', error)
      return config.defaultValue
    }
  }

  remove(key: string): boolean {
    try {
      const fullKey = this.getFullKey(key)
      const storage = this.getStorage()

      if (storage) {
        storage.removeItem(fullKey)
      }
      this.memoryStorage.delete(fullKey)
      return true
    } catch (error) {
      console.warn('Failed to remove storage item:', error)
      return false
    }
  }

  clear(): boolean {
    try {
      const storage = this.getStorage()
      if (storage) {
        // Only clear items with our prefix
        const keysToRemove: string[] = []
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i)
          if (key && key.startsWith(this.options.prefix)) {
            keysToRemove.push(key)
          }
        }
        keysToRemove.forEach(key => storage.removeItem(key))
      }
      this.memoryStorage.clear()
      return true
    } catch (error) {
      console.warn('Failed to clear storage:', error)
      return false
    }
  }

  getSize(key?: string): number {
    try {
      if (key) {
        const value = this.get(key)
        return this.serialize(value).length
      }

      const storage = this.getStorage()
      let totalSize = 0

      if (storage) {
        for (let i = 0; i < storage.length; i++) {
          const storageKey = storage.key(i)
          if (storageKey && storageKey.startsWith(this.options.prefix)) {
            const value = storage.getItem(storageKey) || ''
            totalSize += value.length
          }
        }
      }

      return totalSize + this.memoryStorage.size
    } catch (error) {
      console.warn('Failed to calculate storage size:', error)
      return 0
    }
  }

  isAvailable(): boolean {
    return this.getStorage() !== null || this.options.fallbackStorage === 'memory'
  }

  getStorageInfo(): {
    available: boolean
    usedSpace: number
    quota: number
    percentageUsed: number
  } {
    const usedSpace = this.getSize()
    const available = this.isAvailable()

    return {
      available,
      usedSpace,
      quota: this.storageQuota,
      percentageUsed: available ? (usedSpace / this.storageQuota) * 100 : 0,
    }
  }
}

// Export singleton instance
export const storageManager = new StorageManager()

// Export class for custom instances
export { StorageManager }
export default storageManager