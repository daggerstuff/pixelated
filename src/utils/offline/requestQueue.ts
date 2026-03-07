/**
 * Request Queue System for Offline Support
 * Queues network requests when offline and processes them when back online
 */

import storageManager from '@/utils/storage/storageManager'

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
 * Request Queue for handling offline network requests
 */
class RequestQueue {
  private queue: QueuedRequest[] = []
  private isProcessing = false
  private options: Required<RequestQueueOptions>

  constructor(options: RequestQueueOptions = {}) {
    this.options = {
      maxQueueSize: 1000,
      maxRetries: 3,
      retryDelay: 1000,
      storageKey: 'offline_request_queue',
      enablePersistence: true,
      ...options,
    }

    if (this.options.enablePersistence) {
      this.loadFromStorage()
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

  private saveToStorage(): void {
    if (!this.options.enablePersistence) return

    try {
      storageManager.set(this.options.storageKey, this.queue)
    } catch (error) {
      console.warn('Failed to save request queue to storage:', error)
    }
  }

  private loadFromStorage(): void {
    if (!this.options.enablePersistence) return

    try {
      const stored = storageManager.get(this.options.storageKey, {
        defaultValue: [],
      })
      if (Array.isArray(stored)) {
        this.queue = stored.filter((req) => {
          // Filter out expired requests (older than 24 hours)
          const maxAge = 24 * 60 * 60 * 1000 // 24 hours
          return Date.now() - req.timestamp < maxAge
        })
      }
    } catch (error) {
      console.warn('Failed to load request queue from storage:', error)
      this.queue = []
    }
  }

  /**
   * Add a request to the queue
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
      this.saveToStorage()

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
            this.saveToStorage()
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
          } else {
            // Wait before retrying
            await new Promise((resolve) =>
              setTimeout(resolve, this.options.retryDelay * request.retryCount),
            )
            continue // Retry the same request
          }
        }
      }
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Remove a request from the queue by ID
   */
  remove(id: string): boolean {
    const initialLength = this.queue.length
    this.queue = this.queue.filter((req) => req.id !== id)

    if (this.queue.length < initialLength) {
      this.saveToStorage()
      return true
    }
    return false
  }

  /**
   * Clear all requests from the queue
   */
  clear(): void {
    this.queue = []
    this.saveToStorage()
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
export const requestQueue = new RequestQueue()

// Export class for custom instances
export { RequestQueue }
export default requestQueue
