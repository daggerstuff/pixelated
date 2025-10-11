/**
 * Offline Manager - Central coordinator for offline functionality
 * Manages offline detection, request queuing, and synchronization
 */

import requestQueue, { type QueuedRequest } from './requestQueue'
import useOfflineDetection, { type OfflineState } from '@/hooks/useOfflineDetection'

export interface OfflineManagerConfig {
  enableRequestQueue?: boolean
  enableAutoSync?: boolean
  syncInterval?: number
  criticalPaths?: string[]
  onRequestQueued?: (request: QueuedRequest) => void
  onRequestProcessed?: (request: QueuedRequest) => void
  onSyncStart?: () => void
  onSyncComplete?: () => void
}

/**
 * Enhanced fetch wrapper that handles offline scenarios
 */
export function createOfflineFetch(config: OfflineManagerConfig = {}) {
  const {
    enableRequestQueue = true,
    criticalPaths = [],
    onRequestQueued,
    onRequestProcessed,
  } = config

  return async (
    url: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    const isCriticalPath = criticalPaths.some(path => url.includes(path))

    try {
      // Try the request immediately if online
      const response = await fetch(url, {
        ...options,
        // Add timeout for critical requests
        signal: isCriticalPath
          ? AbortSignal.timeout(5000)
          : options.signal,
      })

      if (response.ok) {
        return response
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    } catch (error) {
      // If offline or network error, queue the request
      if (enableRequestQueue && !navigator.onLine) {
        const priority = isCriticalPath ? 'critical' : 'normal'

        const queued = requestQueue.add({
          url,
          method: (options.method as any) || 'GET',
          headers: options.headers as Record<string, string> || {},
          body: options.body,
          priority,
          maxRetries: isCriticalPath ? 5 : 3,
        })

        if (queued && onRequestQueued) {
          onRequestQueued({
            id: `req_${Date.now()}`,
            url,
            method: (options.method as any) || 'GET',
            headers: options.headers as Record<string, string> || {},
            body: options.body,
            timestamp: Date.now(),
            retryCount: 0,
            priority,
            maxRetries: isCriticalPath ? 5 : 3,
          })
        }

        // Return a mock response for offline handling
        return new Response(
          JSON.stringify({
            error: 'Request queued for offline sync',
            queued: true,
            willRetry: true,
          }),
          {
            status: 202,
            statusText: 'Queued',
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      throw error
    }
  }
}

/**
 * Offline Manager Class
 */
class OfflineManager {
  private config: Required<OfflineManagerConfig>
  private syncInterval: NodeJS.Timeout | null = null
  private networkState: OfflineState | null = null
  private listeners: Map<string, Set<Function>> = new Map()

  constructor(config: OfflineManagerConfig = {}) {
    this.config = {
      enableRequestQueue: true,
      enableAutoSync: true,
      syncInterval: 30000, // 30 seconds
      criticalPaths: ['/api/auth', '/api/emergency', '/api/sync'],
      onRequestQueued: () => {},
      onRequestProcessed: () => {},
      onSyncStart: () => {},
      onSyncComplete: () => {},
      ...config,
    }

    this.initialize()
  }

  private initialize(): void {
    // Monitor network state
    const { useOfflineDetection } = require('@/hooks/useOfflineDetection')
    const networkDetection = useOfflineDetection({
      onOnline: this.handleOnline.bind(this),
      onOffline: this.handleOffline.bind(this),
    })

    // Set up auto-sync interval
    if (this.config.enableAutoSync) {
      this.startAutoSync()
    }

    // Handle visibility change for sync optimization
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.networkState?.isOnline) {
          this.sync()
        }
      })
    }
  }

  private handleOnline(): void {
    this.networkState = { ...this.networkState, isOnline: true, isOffline: false } as OfflineState
    this.emit('online')

    // Immediately try to sync when coming back online
    setTimeout(() => this.sync(), 1000)
  }

  private handleOffline(): void {
    this.networkState = { ...this.networkState, isOnline: false, isOffline: true } as OfflineState
    this.emit('offline')
  }

  private startAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
    }

    this.syncInterval = setInterval(() => {
      if (this.networkState?.isOnline) {
        this.sync()
      }
    }, this.config.syncInterval)
  }

  private stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }

  private emit(event: string, data?: any): void {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.forEach(listener => listener(data))
    }
  }

  /**
   * Subscribe to offline manager events
   */
  on(event: 'online' | 'offline' | 'syncStart' | 'syncComplete' | 'requestQueued', listener: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }

    this.listeners.get(event)!.add(listener)

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(listener)
    }
  }

  /**
   * Manual sync trigger
   */
  async sync(): Promise<void> {
    if (!this.networkState?.isOnline || !requestQueue.hasPendingRequests()) {
      return
    }

    this.config.onSyncStart()
    this.emit('syncStart')

    try {
      await requestQueue.processQueue(this.config.onRequestProcessed)
      this.emit('syncComplete')
    } catch (error) {
      console.warn('Sync failed:', error)
    } finally {
      this.config.onSyncComplete()
    }
  }

  /**
   * Get current offline status
   */
  getStatus(): {
    isOnline: boolean
    isOffline: boolean
    hasPendingRequests: boolean
    queueStats: ReturnType<typeof requestQueue.getStats>
  } {
    return {
      isOnline: this.networkState?.isOnline ?? true,
      isOffline: this.networkState?.isOffline ?? false,
      hasPendingRequests: requestQueue.hasPendingRequests(),
      queueStats: requestQueue.getStats(),
    }
  }

  /**
   * Force process queue (useful for testing)
   */
  async forceSync(): Promise<void> {
    await this.sync()
  }

  /**
   * Clear all queued requests
   */
  clearQueue(): void {
    requestQueue.clear()
  }

  /**
   * Destroy the offline manager and clean up resources
   */
  destroy(): void {
    this.stopAutoSync()
    this.listeners.clear()
  }
}

// Export singleton instance
export const offlineManager = new OfflineManager()

// Export enhanced fetch function
export const offlineFetch = createOfflineFetch()

// Export class for custom instances
export { OfflineManager }
export default offlineManager