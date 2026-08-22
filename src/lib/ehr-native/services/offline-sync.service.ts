/**
 * OfflineSyncService — manages a persistent queue of mutations in IndexedDB
 * for replay when network connectivity is restored.
 *
 * Works independently of the service worker (IndexedDB only).
 * The service worker's sync event triggers syncAll(); the service can also
 * be called directly from application code.
 */

import { getLogger } from '../../utils/logger'

const logger = getLogger('OfflineSyncService')

const DB_NAME = 'pixelated-empathy-db'
const DB_VERSION = 1
const STORE_NAME = 'offline_queue'
const MAX_RETRIES = 3

export type SyncActionType = 'note' | 'appointment' | 'message'

export interface SyncAction {
  id: string
  type: SyncActionType
  payload: Record<string, unknown>
  createdAt: string
  retryCount: number
}

export interface SyncResult {
  succeeded: SyncAction[]
  failed: SyncAction[]
  skipped: SyncAction[]
}

/**
 * Input shape for enqueue — the service assigns id, createdAt, and retryCount.
 */
export type EnqueueInput = Omit<SyncAction, 'id' | 'createdAt' | 'retryCount'>

export class OfflineSyncService {
  private static instance: OfflineSyncService | null = null
  private dbPromise: Promise<IDBDatabase> | null = null

  private constructor() {
    logger.info('OfflineSyncService initialized')
  }

  static getInstance(): OfflineSyncService {
    OfflineSyncService.instance ??= new OfflineSyncService()
    return OfflineSyncService.instance
  }

  /**
   * Reset the singleton — primarily for testing.
   */
  static resetInstance(): void {
    OfflineSyncService.instance = null
  }

  // --- IndexedDB access ---------------------------------------------------

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not available'))
        return
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        }
      }

      request.onsuccess = () => {
        resolve(request.result)
      }

      request.onerror = () => {
        reject(request.error ?? new Error('Failed to open IndexedDB'))
      }
    })

    return this.dbPromise
  }

  private runTransaction<T>(
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    return this.openDB().then(
      (db) =>
        new Promise<T>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, mode)
          const store = tx.objectStore(STORE_NAME)
          const request = fn(store)

          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)

          tx.onerror = () => reject(tx.error)
        }),
    )
  }

  // --- Public API ---------------------------------------------------------

  /**
   * Enqueue a mutation action for later sync.
   * Returns the stored action with a generated id, createdAt, and retryCount=0.
   */
  async enqueue(input: EnqueueInput): Promise<SyncAction> {
    const action: SyncAction = {
      id: this.generateId(),
      type: input.type,
      payload: input.payload,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    }

    if (typeof indexedDB === 'undefined') {
      logger.warn('IndexedDB unavailable — action not persisted', {
        id: action.id,
        type: action.type,
      })
      return action
    }

    try {
      await this.runTransaction('readwrite', (store) =>
        store.add(action),
      )
      logger.info('Action enqueued', { id: action.id, type: action.type })
    } catch (error) {
      logger.error('Failed to enqueue action', { error, id: action.id })
    }

    return action
  }

  /**
   * Dequeue (remove and return) the oldest action from the queue.
   * Returns null if the queue is empty.
   */
  async dequeue(): Promise<SyncAction | null> {
    if (typeof indexedDB === 'undefined') {
      logger.warn('IndexedDB unavailable — cannot dequeue')
      return null
    }

    try {
      const all = await this.runTransaction<SyncAction[]>('readonly', (store) =>
        store.getAll() as IDBRequest<SyncAction[]>,
      )
      if (!all || all.length === 0) return null

      // Sort by createdAt to get oldest
      const sorted = [...all].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      )
      const oldest = sorted[0]
      if (!oldest) return null

      await this.runTransaction('readwrite', (store) =>
        store.delete(oldest.id),
      )
      logger.debug('Action dequeued', { id: oldest.id })
      return oldest
    } catch (error) {
      logger.error('Failed to dequeue action', { error })
      return null
    }
  }

  /**
   * Return all queued actions (without removing them).
   */
  async getQueue(): Promise<SyncAction[]> {
    if (typeof indexedDB === 'undefined') {
      logger.warn('IndexedDB unavailable — returning empty queue')
      return []
    }

    try {
      const all = await this.runTransaction<SyncAction[]>('readonly', (store) =>
        store.getAll() as IDBRequest<SyncAction[]>,
      )
      return all ?? []
    } catch (error) {
      logger.error('Failed to get queue', { error })
      return []
    }
  }

  /**
   * Remove all actions from the queue.
   */
  async clearQueue(): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      logger.warn('IndexedDB unavailable — cannot clear queue')
      return
    }

    try {
      await this.runTransaction('readwrite', (store) => store.clear())
      logger.info('Queue cleared')
    } catch (error) {
      logger.error('Failed to clear queue', { error })
    }
  }

  /**
   * Attempt to sync all queued actions via fetch.
   * Successful actions are removed; failed actions have retryCount incremented.
   * After MAX_RETRIES, the action is removed and marked as failed.
   */
  async syncAll(): Promise<SyncResult> {
    const result: SyncResult = {
      succeeded: [],
      failed: [],
      skipped: [],
    }

    if (typeof indexedDB === 'undefined') {
      logger.warn('IndexedDB unavailable — syncAll skipped')
      return result
    }

    const queue = await this.getQueue()
    if (queue.length === 0) {
      logger.debug('Queue empty — nothing to sync')
      return result
    }

    logger.info('Syncing queued actions', { count: queue.length })

    for (const action of queue) {
      if (action.retryCount >= MAX_RETRIES) {
        result.skipped.push(action)
        await this.removeAction(action.id)
        logger.warn('Action exceeded max retries — removed', {
          id: action.id,
          retryCount: action.retryCount,
        })
        continue
      }

      try {
        const response = await this.attemptSync(action)
        if (response.ok) {
          result.succeeded.push(action)
          await this.removeAction(action.id)
          logger.info('Action synced successfully', { id: action.id })
        } else {
          await this.incrementRetry(action)
          result.failed.push(action)
          logger.warn('Action sync failed — non-OK response', {
            id: action.id,
            status: response.status,
          })
        }
      } catch (error) {
        await this.incrementRetry(action)
        result.failed.push(action)
        logger.error('Action sync failed — network error', {
          id: action.id,
          error,
        })
      }
    }

    logger.info('Sync complete', {
      succeeded: result.succeeded.length,
      failed: result.failed.length,
      skipped: result.skipped.length,
    })

    return result
  }

  // --- Private helpers ----------------------------------------------------

  private async attemptSync(action: SyncAction): Promise<Response> {
    const endpoint = this.getEndpointForAction(action.type)
    return fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action.payload),
    })
  }

  private getEndpointForAction(type: SyncActionType): string {
    switch (type) {
      case 'note':
        return '/api/notes'
      case 'appointment':
        return '/api/appointments'
      case 'message':
        return '/api/messages'
      default:
        return '/api/sync'
    }
  }

  private async removeAction(id: string): Promise<void> {
    try {
      await this.runTransaction('readwrite', (store) => store.delete(id))
    } catch (error) {
      logger.error('Failed to remove action', { id, error })
    }
  }

  private async incrementRetry(action: SyncAction): Promise<void> {
    const updated: SyncAction = {
      ...action,
      retryCount: action.retryCount + 1,
    }
    try {
      await this.runTransaction('readwrite', (store) => store.put(updated))
    } catch (error) {
      logger.error('Failed to increment retry count', {
        id: action.id,
        error,
      })
    }
  }

  private generateId(): string {
    if (globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID()
    }
    // Fallback for environments without crypto.randomUUID
    return `sync-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  }
}

export const MAX_RETRY_COUNT = MAX_RETRIES
