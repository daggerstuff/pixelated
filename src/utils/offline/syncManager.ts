import indexedDBRequestQueue from './indexedDBRequestQueue'
import { type QueuedRequest } from './requestQueue'

/**
 * Sync Manager with exponential backoff for offline-first synchronization.
 * Manages syncing queued requests when online with retry logic and exponential backoff.
 */
export interface SyncManagerOptions {
  /** Base delay in milliseconds for exponential backoff (default: 1000) */
  baseDelay?: number
  /** Maximum delay in milliseconds for exponential backoff (default: 60000) */
  maxDelay?: number
  /** Enable automatic sync when online (default: true) */
  enableAutoSync?: boolean
  /** Callback when a sync attempt starts */
  onSyncStart?: () => void
  /** Callback when a sync attempt succeeds */
  onSyncSuccess?: () => void
  /** Callback when a sync attempt fails (after max retries) */
  onSyncFail?: () => void
}

class SyncManager {
  private options: Required<SyncManagerOptions>
  private isOnline: boolean =
    typeof navigator !== 'undefined' && navigator.onLine
  private isSyncing = false
  private backoffMultiplier = 1
  private syncTimeout: NodeJS.Timeout | null = null
  private listeners: Map<string, Set<(payload?: unknown) => void>> = new Map()
  private onlineHandler: () => void
  private offlineHandler: () => void
  private visibilityChangeHandler: () => void

  constructor(options: SyncManagerOptions = {}) {
    this.options = {
      baseDelay: 1000,
      maxDelay: 60000,
      enableAutoSync: true,
      onSyncStart: () => {},
      onSyncSuccess: () => {},
      onSyncFail: () => {},
      ...options,
    }

    this.onlineHandler = () => this.handleOnline()
    this.offlineHandler = () => this.handleOffline()
    this.visibilityChangeHandler = () => {
      if (
        document.visibilityState === 'visible' &&
        this.isOnline &&
        this.options.enableAutoSync
      ) {
        this.attemptSync()
      }
    }

    this.initialize()
  }

  private initialize(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.onlineHandler)
      window.addEventListener('offline', this.offlineHandler)
      document.addEventListener(
        'visibilitychange',
        this.visibilityChangeHandler,
      )
    }

    if (this.options.enableAutoSync && this.isOnline) {
      this.attemptSync()
    }
  }

  private handleOnline(): void {
    this.isOnline = true
    if (this.options.enableAutoSync) {
      this.attemptSync()
    }
  }

  private handleOffline(): void {
    this.isOnline = false
    this.clearSyncTimeout()
  }

  private clearSyncTimeout(): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout)
      this.syncTimeout = null
    }
  }

  private async attemptSync(): Promise<void> {
    if (!this.isOnline || this.isSyncing) return

    this.isSyncing = true
    this.options.onSyncStart()

    try {
      const queueLengthBefore = indexedDBRequestQueue.hasPendingRequests()
        ? 1
        : 0 // We don't have a direct way to get length without exposing it, but we can use hasPendingRequests as a boolean
      // We'll call processQueue and then check if the queue is still pending
      await indexedDBRequestQueue.processQueue()
      const queueLengthAfter = indexedDBRequestQueue.hasPendingRequests()
        ? 1
        : 0

      // Consider sync successful if we were able to process the queue and the queue is no longer pending
      // Note: This is a simplification because hasPendingRequests only tells us if there are any requests, not the count.
      // For a more accurate measure, we would need to expose the queue length or check if we made progress.
      // However, for the purpose of exponential backoff, we can consider it a failure if the queue is still pending after the sync attempt.
      if (indexedDBRequestQueue.hasPendingRequests()) {
        // Queue is still not empty, consider it a failure (we need to backoff)
        throw new Error('Queue still has pending requests after sync attempt')
      } else {
        // Queue is empty, reset backoff
        this.backoffMultiplier = 1
        this.options.onSyncSuccess()
      }
    } catch (error) {
      console.warn('Sync failed:', error)
      this.options.onSyncFail()
      // Increase backoff multiplier for next attempt
      this.backoffMultiplier = Math.min(
        this.backoffMultiplier * 2,
        this.options.maxDelay / this.options.baseDelay,
      )
    } finally {
      this.isSyncing = false
      // Schedule next sync attempt if autoSync is enabled
      if (this.options.enableAutoSync) {
        this.scheduleNextSync()
      }
    }
  }

  private scheduleNextSync(): void {
    this.clearSyncTimeout()
    const delay = Math.min(
      this.options.baseDelay * this.backoffMultiplier,
      this.options.maxDelay,
    )
    this.syncTimeout = setTimeout(() => {
      this.attemptSync()
    }, delay)
  }

  /**
   * Start the sync manager
   */
  start(): void {
    this.initialize()
  }

  /**
   * Stop the sync manager and clean up resources
   */
  stop(): void {
    this.clearSyncTimeout()
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onlineHandler)
      window.removeEventListener('offline', this.offlineHandler)
      document.removeEventListener(
        'visibilitychange',
        this.visibilityChangeHandler,
      )
    }
  }

  /**
   * Get current status
   */
  getStatus(): {
    isOnline: boolean
    isSyncing: boolean
    backoffMultiplier: number
    hasPendingRequests: boolean
  } {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      backoffMultiplier: this.backoffMultiplier,
      hasPendingRequests: indexedDBRequestQueue.hasPendingRequests(),
    }
  }
}

// Export singleton instance
export const syncManager = new SyncManager()

// Export class for custom instances
export { SyncManager }
export default syncManager
