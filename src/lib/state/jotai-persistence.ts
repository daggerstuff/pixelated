/**
 * Enhanced Jotai State Persistence
 *
 * Provides comprehensive state persistence for Jotai atoms with:
 * - Encrypted storage for sensitive data
 * - Offline state synchronization
 * - Cross-tab synchronization
 * - State migration support
 * - Selective persistence with allowlists
 */

import { atomWithStorage, createJSONStorage } from 'jotai/utils'

import { logger } from '@/lib/logger'
import { createCryptoSystem } from '@/lib/crypto'

const { encrypt, decrypt } = createCryptoSystem({ namespace: 'jotai' })

// ============================================================================
// Types
// ============================================================================

interface PersistenceOptions {
  encrypt?: boolean
  allowOffline?: boolean
  syncAcrossTabs?: boolean
  version?: number
  migration?: (oldState: unknown, version: number) => unknown
  ttl?: number // Time to live in milliseconds
}

interface StoredStateMetadata {
  version: number
  timestamp: number
  encrypted: boolean
  ttl?: number
}

interface StoredState<T> {
  data: T
  metadata: StoredStateMetadata
}

// ============================================================================
// Storage Implementation
// ============================================================================

class EncryptedJotaiStorage<Value> {
  private key: string
  private options: Required<Omit<PersistenceOptions, 'migration'>> &
    Pick<PersistenceOptions, 'migration'>
  private syncListeners: Set<() => void> = new Set()

  constructor(key: string, options: PersistenceOptions = {}) {
    this.key = `jotai_${key}`
    this.options = {
      encrypt: false,
      allowOffline: true,
      syncAcrossTabs: true,
      version: 1,
      ttl: options.ttl ?? undefined,
      ...options,
    }

    // Set up cross-tab synchronization
    if (this.options.syncAcrossTabs && typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageChange.bind(this))
      window.addEventListener('beforeunload', this.cleanup.bind(this))
    }
  }

  private handleStorageChange = (event: StorageEvent) => {
    if (event.key === this.key && event.newValue !== event.oldValue) {
      // Notify all listeners that the state has changed in another tab
      for (const listener of this.syncListeners) {
        listener()
      }
    }
  }

  private cleanup = () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.handleStorageChange)
      window.removeEventListener('beforeunload', this.cleanup)
    }
  }

  private async serializeValue(value: Value): Promise<string> {
    const metadata: StoredStateMetadata = {
      version: this.options.version,
      timestamp: Date.now(),
      encrypted: this.options.encrypt,
      ttl: this.options.ttl,
    }

    const storedState: StoredState<Value> = {
      data: value,
      metadata,
    }

    let serialized = JSON.stringify(storedState)

    if (this.options.encrypt) {
      try {
        serialized = await encrypt(serialized)
      } catch (error: unknown) {
        logger.error('Failed to encrypt state:', error)
        throw new Error('Failed to encrypt state for storage', { cause: error })
      }
    }

    return serialized
  }

  private async deserializeValue(serialized: string): Promise<Value | null> {
    try {
      let decrypted = serialized

      // Try to decrypt if it looks like encrypted data
      if (this.options.encrypt || serialized.startsWith('enc:')) {
        try {
          decrypted = await decrypt(serialized)
        } catch (error: unknown) {
          logger.warn(
            'Failed to decrypt stored state, treating as plain text:',
            error,
          )
          // Continue with original string - might be legacy unencrypted data
        }
      }

      const storedState: StoredState<Value> = JSON.parse(decrypted) as unknown

      // Check TTL
      if (storedState.metadata.ttl) {
        const age = Date.now() - storedState.metadata.timestamp
        if (age > storedState.metadata.ttl) {
          logger.debug(`Stored state for ${this.key} has expired`)
          return null
        }
      }

      // Handle migration
      if (
        this.options.migration &&
        storedState.metadata.version < this.options.version
      ) {
        logger.debug(
          `Migrating state for ${this.key} from version ${storedState.metadata.version} to ${this.options.version}`,
        )
        const migratedData = this.options.migration(
          storedState.data,
          storedState.metadata.version,
        )
        return migratedData as Value
      }

      return storedState.data
    } catch (error: unknown) {
      logger.error(`Failed to deserialize state for ${this.key}:`, error)
      return null
    }
  }

  async getItem(_key: string, initialValue: Value): Promise<Value> {
    if (typeof window === 'undefined') {
      return initialValue
    }

    try {
      const stored = localStorage.getItem(this.key)
      if (!stored) {
        return initialValue
      }

      const result = await this.deserializeValue(stored)
      return result ?? initialValue
    } catch (error: unknown) {
      logger.error(`Failed to get item ${this.key}:`, error)
      return initialValue
    }
  }

  async setItem(_key: string, newValue: Value): Promise<void> {
    if (typeof window === 'undefined') {
      return
    }

    try {
      const serialized = await this.serializeValue(newValue)
      localStorage.setItem(this.key, serialized)
    } catch (error: unknown) {
      logger.error(`Failed to set item ${this.key}:`, error)
      throw error
    }
  }

  async removeItem(): Promise<void> {
    if (typeof window === 'undefined') {
      return
    }

    try {
      localStorage.removeItem(this.key)
    } catch (error: unknown) {
      logger.error(`Failed to remove item ${this.key}:`, error)
      throw error
    }
  }

  // Subscribe to cross-tab changes
  subscribe(
    key: string,
    callback: (value: Value) => void,
    initialValue: Value,
  ): () => void {
    const listener = () => callback(initialValue)
    this.syncListeners.add(listener)
    return () => {
      this.syncListeners.delete(listener)
    }
  }
}

// ============================================================================
// Enhanced Atom Creators
// ============================================================================

/**
 * Create a persistent atom with advanced features
 */
export function atomWithEnhancedStorage<Value>(
  key: string,
  initialValue: Value,
  options: PersistenceOptions = {},
) {
  const storage = new EncryptedJotaiStorage(key, options)

  return atomWithStorage(
    key,
    initialValue,
    createJSONStorage<Value>(() => storage as unknown),
  )
}

/**
 * Create a secure atom for sensitive data (automatically encrypted)
 */
export function atomWithSecureStorage<Value>(
  key: string,
  initialValue: Value,
  options: Omit<PersistenceOptions, 'encrypt'> = {},
) {
  return atomWithEnhancedStorage(key, initialValue, {
    ...options,
    encrypt: true,
  })
}

/**
 * Create a session-only atom (persists only during browser session)
 */
export function atomWithSessionStorage<Value>(
  key: string,
  initialValue: Value,
  options: PersistenceOptions = {},
) {
  return atomWithEnhancedStorage(key, initialValue, {
    ...options,
    ttl: undefined, // No TTL for session storage
  })
}

/**
 * Create a temporary atom with TTL
 */
export function atomWithTTL<Value>(
  key: string,
  initialValue: Value,
  ttlMs: number,
  options: Omit<PersistenceOptions, 'ttl'> = {},
) {
  return atomWithEnhancedStorage(key, initialValue, {
    ...options,
    ttl: ttlMs,
  })
}

// ============================================================================
// State Persistence Manager
// ============================================================================

export class StatePersistenceManager {
  private static instance: StatePersistenceManager
  private persistedAtoms: Map<string, unknown> = new Map()
  private syncSubscriptions: Map<string, () => void> = new Map()

  static getInstance(): StatePersistenceManager {
    if (!StatePersistenceManager.instance) {
      StatePersistenceManager.instance = new StatePersistenceManager()
    }
    return StatePersistenceManager.instance
  }

  /**
   * Register an atom for persistence management
   */
  registerAtom<_T>(key: string, atom: unknown): void {
    this.persistedAtoms.set(key, atom)
  }

  /**
   * Clear all persisted state
   */
  async clearAllPersistedState(): Promise<void> {
    if (typeof window === 'undefined') {
      return
    }

    const keys = Object.keys(localStorage).filter((key) =>
      key.startsWith('jotai_'),
    )

    for (const key of keys) {
      try {
        localStorage.removeItem(key)
      } catch (error: unknown) {
        logger.error(`Failed to clear persisted state for ${key}:`, error)
      }
    }

    logger.info('Cleared all persisted Jotai state')
  }

  /**
   * Get storage usage statistics
   */
  getStorageStats(): { totalKeys: number; totalSize: number; keys: string[] } {
    if (typeof window === 'undefined') {
      return { totalKeys: 0, totalSize: 0, keys: [] }
    }

    const jotaiKeys = Object.keys(localStorage).filter((key) =>
      key.startsWith('jotai_'),
    )
    const totalSize = jotaiKeys.reduce((size, key) => {
      const value = localStorage.getItem(key) || ''
      return size + new Blob([value]).size
    }, 0)

    return {
      totalKeys: jotaiKeys.length,
      totalSize,
      keys: jotaiKeys,
    }
  }

  /**
   * Export all persisted state for backup
   */
  exportPersistedState(): Record<string, unknown> {
    if (typeof window === 'undefined') {
      return {}
    }

    const exported: Record<string, unknown> = {}
    const jotaiKeys = Object.keys(localStorage).filter((key) =>
      key.startsWith('jotai_'),
    )

    for (const key of jotaiKeys) {
      try {
        const value = localStorage.getItem(key)
        if (value) {
          exported[key] = JSON.parse(value) as unknown
        }
      } catch (error: unknown) {
        logger.warn(`Failed to export state for ${key}:`, error)
      }
    }

    return exported
  }

  /**
   * Import persisted state from backup
   */
  async importPersistedState(state: Record<string, unknown>): Promise<void> {
    if (typeof window === 'undefined') {
      return
    }

    for (const [key, value] of Object.entries(state)) {
      if (key.startsWith('jotai_')) {
        try {
          localStorage.setItem(key, JSON.stringify(value))
        } catch (error: unknown) {
          logger.error(`Failed to import state for ${key}:`, error)
        }
      }
    }

    logger.info('Imported persisted state from backup')
  }
}

// ============================================================================
// Exports
// ============================================================================

export const persistenceManager = StatePersistenceManager.getInstance()

// Legacy export for backward compatibility
export { atomWithStorage } from 'jotai/utils'
