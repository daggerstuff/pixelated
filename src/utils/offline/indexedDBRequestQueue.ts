/**
 * IndexedDB-backed Request Queue for Offline Support
 * Queues network requests when offline and processes them when back online
 * Uses IndexedDB for persistent storage to avoid blocking the main thread
 */

import { type IDBPDatabase } from 'idb'

import IndexedDBStorage from '../storage/indexedDBStorage'

export interface QueuedRequest {
  id: string
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  headers: Record<string, string>
  body?: unknown
  timestamp: number
  retryCount: number
  maxRetries: number
  priority: 'low' | 'normal' | 'high' | 'critical'
}

export interface RequestQueueOptions {
  maxQueueSize?: number
  maxRetries?: number
  retryDelay?: number
  storageKey?: string
  enablePersistence?: boolean
}

/**
 * Request Queue that persists to IndexedDB
 */
class IndexedDBRequestQueue {
  private queue: QueuedRequest[] = []
  private isProcessing = false
  private options: Required<RequestQueueOptions>
  private db: IDBDatabase | null = null
  private initialized = false

  constructor(options: RequestQueueOptions = {}) {
    this.options = {
      maxQueueSize: 1000,
      maxRetries: 3,
      retryDelay: 1000,
      storageKey: 'offline_request_queue_idb',
      enablePersistence: true,
      ...options,
    }

    if (this.options.enablePersistence) {
      this.initDB()
        .then(() => this.loadFromStorage())
        .catch((err) => {
          console.warn('Failed to initialize IndexedDB for request queue:', err)
          // Continue with empty queue
        })
    }
  }

  private async initDB(): Promise<void> {
    if (this.initialized) return

    // Create a separate IndexedDBStorage instance for the queue
    const queueStorage = new IndexedDBStorage({
      dbName: 'pixelated_offline_queue',
      version: 1,
      storeName: this.options.storageKey,
    })

    // We'll store the instance for later use.
    this.db = await this.initIndexedDB(queueStorage)
  }

  private async initIndexedDB(storage: any): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(storage.dbName, storage.version)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        // Ensure object store exists
        if (!db.objectStoreNames.contains(storage.storeName)) {
          db.createObjectStore(storage.storeName, { keyPath: 'id' })
        }
        resolve(db)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(storage.storeName)) {
          db.createObjectStore(storage.storeName, { keyPath: 'id' })
        }
      }
    })
  }

  private async loadFromStorage(): Promise<void> {
    if (!this.options.enablePersistence || !this.db) return

    try {
      const tx = this.db.transaction([this.options.storageKey], 'readonly')
      const store = tx.objectStore(this.options.storageKey)
      const request = store.get('queue') // We'll store the entire queue under key 'queue'

      const result = await new Promise<any>((resolve, reject) => {
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(request.result)
      })

      if (result && Array.isArray(result.value)) {
        const stored = result.value
        // Filter out expired requests (older than 24 hours)
        const maxAge = 24 * 60 * 60 * 1000 // 24 hours
        const now = Date.now()
        this.queue = stored.filter(
          (req: QueuedRequest) => now - req.timestamp < maxAge,
        )
      } else {
        this.queue = []
      }
    } catch (error) {
      console.warn('Failed to load request queue from IndexedDB:', error)
      this.queue = []
    }
  }

  private async saveToStorage(): Promise<void> {
    if (!this.options.enablePersistence || !this.db) return

    try {
      const tx = this.db.transaction([this.options.storageKey], 'readwrite')
      const store = tx.objectStore(this.options.storageKey)
      const request = store.put({ id: 'queue', value: this.queue })

      await new Promise<void>((resolve, reject) => {
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve()
      })
    } catch (error) {
      console.warn('Failed to save request queue to IndexedDB:', error)
    }
  }

  private generateId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private getPriorityWeight(priority: QueuedRequest['priority']): number {
    const weights = {
      critical: 4,
      high: 3,
      normal: 2,
      low: 1,
    }
    return weights[priority]
  }

  private sortQueue(): void {
    this.queue.sort((a, b) => {
      // Sort by priority first (higher priority first)
      const priorityDiff =
        this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority)
      if (priorityDiff !== 0) return priorityDiff

      // Then by timestamp (older first)
      return a.timestamp - b.timestamp
    })
  }

  /**
   * Add a request to the queue
   * @returns true if successfully added, false if error
   */
  add(
    request: Omit<QueuedRequest, 'id' | 'timestamp' | 'retryCount'>,
  ): boolean {
    try {
      if (this.queue.length >= this.options.maxQueueSize) {
        // Remove oldest low-priority requests to make room
        const lowPriorityRequests = this.queue
          .filter((req) => req.priority === 'low')
          .sort((a, b) => a.timestamp - b.timestamp)

        if (lowPriorityRequests.length > 0) {
          this.queue = this.queue.filter(
            (req) => req.id !== lowPriorityRequests[0].id,
          )
        } else {
          console.warn('Request queue is full, dropping oldest request')
          this.queue.shift()
        }
      }

      const queuedRequest: QueuedRequest = {
        ...request,
        id: this.generateId(),
        timestamp: Date.now(),
        retryCount: 0,
      }

      this.queue.push(queuedRequest)
      this.sortQueue()

      // Persist asynchronously (fire and forget)
      if (this.options.enablePersistence) {
        this.saveToStorage().catch((err) => {
          console.warn('Failed to persist request queue:', err)
        })
      }

      return true
    } catch (error) {
      console.warn('Failed to add request to queue:', error)
      return false
    }
  }

  /**
   * Process the queue when back online
   */
  async processQueue(
    onRequestSuccess?: (request: QueuedRequest) => void,
  ): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return

    this.isProcessing = true

    try {
      while (this.queue.length > 0) {
        const request = this.queue[0] // Get the highest priority request

        try {
          const response = await fetch(request.url, {
            method: request.method,
            headers: request.headers,
            body: request.body
              ? typeof request.body === 'string'
                ? request.body
                : JSON.stringify(request.body)
              : undefined,
          })

          if (response.ok) {
            // Request succeeded, remove from queue
            this.queue.shift()
            // Persist asynchronously
            if (this.options.enablePersistence) {
              this.saveToStorage().catch((err) => {
                console.warn(
                  'Failed to persist request queue after processing:',
                  err,
                )
              })
            }
            onRequestSuccess?.(request)
          } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }
        } catch {
          // Request failed, increment retry count
          request.retryCount++

          if (request.retryCount >= request.maxRetries) {
            // Max retries reached, remove from queue
            console.warn(
              `Request ${request.id} failed after ${request.maxRetries} retries, removing from queue`,
            )
            this.queue.shift()
            // Persist asynchronously
            if (this.options.enablePersistence) {
              this.saveToStorage().catch((err) => {
                console.warn(
                  'Failed to persist request queue after max retries:',
                  err,
                )
              })
            }
          } else {
            // Wait before retrying
            await new Promise((resolve) =>
              setTimeout(resolve, this.options.retryDelay * request.retryCount),
            )
            // Continue to retry the same request (do not shift the queue)
            continue
          }
        }
      }
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Remove a request from the queue by ID
   * @returns true if removed, false if not found
   */
  remove(id: string): boolean {
    const initialLength = this.queue.length
    this.queue = this.queue.filter((req) => req.id !== id)

    if (this.queue.length < initialLength) {
      // Persist asynchronously
      if (this.options.enablePersistence) {
        this.saveToStorage().catch((err) => {
          console.warn('Failed to persist request queue after removal:', err)
        })
      }
      return true
    }
    return false
  }

  /**
   * Clear all requests from the queue
   */
  clear(): void {
    this.queue = []
    // Persist asynchronously
    if (this.options.enablePersistence) {
      this.saveToStorage().catch((err) => {
        console.warn('Failed to persist request queue after clear:', err)
      })
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    total: number
    byPriority: Record<QueuedRequest['priority'], number>
    oldestRequest: number | null
    newestRequest: number | null
  } {
    const byPriority = {
      critical: 0,
      high: 0,
      normal: 0,
      low: 0,
    }

    let oldestRequest: number | null = null
    let newestRequest: number | null = null

    this.queue.forEach((req) => {
      byPriority[req.priority]++

      if (oldestRequest === null || req.timestamp < oldestRequest) {
        oldestRequest = req.timestamp
      }
      if (newestRequest === null || req.timestamp > newestRequest) {
        newestRequest = req.timestamp
      }
    })

    return {
      total: this.queue.length,
      byPriority,
      oldestRequest,
      newestRequest,
    }
  }

  /**
   * Get all queued requests (for debugging)
   */
  getQueue(): QueuedRequest[] {
    return [...this.queue]
  }

  /**
   * Check if there are requests waiting to be processed
   */
  hasPendingRequests(): boolean {
    return this.queue.length > 0
  }
}

// Export singleton instance
export const indexedDBRequestQueue = new IndexedDBRequestQueue()

// Export class for custom instances
export { IndexedDBRequestQueue }
export default indexedDBRequestQueue
