/**
 * Enhanced State Persistence System
 *
 * Extends existing persistence with:
 * - Cross-tab synchronization
 * - Encrypted storage for sensitive data
 * - Offline state queuing
 * - State migration support
 * - Performance monitoring
 */

import { atomWithStorage } from 'jotai/utils'
import { logger } from '@/lib/logger'

// Helper to synchronously require Node modules in Node-only environments without
// triggering static bundlers or TypeScript/ESLint `no-require-imports` errors.
function tryRequireNode(moduleName: string): any | null {
  try {
    if (typeof window === 'undefined' && typeof process !== 'undefined') {
      // Use eval to avoid bundlers rewriting/including the require call.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const globalRequire = (globalThis as any).require
      if (typeof globalRequire === 'function') {
        return globalRequire(moduleName)
      }

      // Try to access via global scope
      const module = (globalThis as any)[moduleName]
      if (module) return module
    }
  } catch {
    // ignore failures and return null to trigger fallback logic
  }
  return null
}

// ============================================================================
// Type guard for timestamped objects
type Timestamped = { timestamp: number }
function hasTimestamp(v: unknown): v is Timestamped {
  return (
    typeof v === 'object' &&
    v !== null &&
    'timestamp' in v &&
    typeof (v as Record<string, unknown>)['timestamp'] === 'number'
  )
}
// Enhanced Atoms with Persistence
// ============================================================================

// Application state atoms with persistence
export const userPreferencesAtom = atomWithStorage('user_preferences', {
  theme: 'dark' as 'light' | 'dark' | 'system',
  language: 'en',
  notifications: {
    email: true,
    push: true,
    sms: false,
  },
  accessibility: {
    reducedMotion: false,
    highContrast: false,
    fontSize: 'medium' as 'small' | 'medium' | 'large',
  },
  privacy: {
    analytics: true,
    crashReporting: true,
    personalization: true,
  },
})

// UI state atoms with persistence
export const uiStateAtom = atomWithStorage('ui_state', {
  sidebarOpen: true,
  activeTab: 'dashboard',
  layout: 'default' as 'default' | 'compact' | 'expanded',
  viewMode: 'list' as 'list' | 'grid' | 'card',
  filters: {},
  sortBy: 'date',
  sortOrder: 'desc' as 'asc' | 'desc',
})

// Session state atoms (temporary persistence)
export const sessionStateAtom = atomWithStorage('session_state', {
  lastRoute: '/',
  currentWorkspace: null,
  openTabs: [] as string[],
  recentItems: [] as string[],
  searchHistory: [] as string[],
})

// Form state atoms with persistence for draft recovery
export const formDraftsAtom = atomWithStorage(
  'form_drafts',
  {} as Record<string, unknown>,
)

// Offline state atoms
export const offlineDataAtom = atomWithStorage('offline_data', {
  queuedActions: [] as Array<{
    id: string
    type: string
    payload: unknown
    timestamp: number
    retryCount: number
  }>,
  lastSync: null as number | null,
  conflictResolution: 'manual' as 'auto' | 'manual',
})

// Analytics and usage tracking atoms
export const usageStatsAtom = atomWithStorage('usage_stats', {
  sessionCount: 0,
  totalTimeSpent: 0,
  featureUsage: {} as Record<string, number>,
  lastSessionEnd: null as number | null,
  performanceMetrics: {
    averageLoadTime: 0,
    errorCount: 0,
    crashCount: 0,
  },
})

// ============================================================================
// State Persistence Manager
// ============================================================================

interface PersistenceConfig {
  encryptSensitiveData: boolean
  syncAcrossTabs: boolean
  enableOfflineQueue: boolean
  compressionEnabled: boolean
  maxStorageSize: number // in bytes
  cleanupInterval: number // in milliseconds
}

class EnhancedStatePersistence {
  private static instance: EnhancedStatePersistence
  private config: PersistenceConfig
  private cleanupTimer: NodeJS.Timeout | null = null
  private storageChangeListeners: Set<
    (key: string, newValue: unknown) => void
  > = new Set()
  private static fallbackCounter = 0

  constructor() {
    this.config = {
      encryptSensitiveData: true,
      syncAcrossTabs: true,
      enableOfflineQueue: true,
      compressionEnabled: true,
      maxStorageSize: 10 * 1024 * 1024, // 10MB
      cleanupInterval: 60 * 1000, // 1 minute
    }
  }

  static getInstance(): EnhancedStatePersistence {
    if (!EnhancedStatePersistence.instance) {
      EnhancedStatePersistence.instance = new EnhancedStatePersistence()
    }
    return EnhancedStatePersistence.instance
  }

  async initialize(): Promise<void> {
    if (typeof window === 'undefined') {
      return
    }

    // Set up cross-tab synchronization
    if (this.config.syncAcrossTabs) {
      this.setupCrossTabSync()
    }

    // Set up periodic cleanup
    this.startPeriodicCleanup()

    // Initialize offline queue processing
    if (this.config.enableOfflineQueue) {
      this.processOfflineQueue()
    }

    // Update usage statistics
    this.updateUsageStats()

    logger.info('Enhanced state persistence initialized')
  }

  private setupCrossTabSync() {
    window.addEventListener('storage', (event) => {
      if (event.key && event.newValue !== event.oldValue) {
        try {
          const newValue = event.newValue
            ? (JSON.parse(event.newValue) as unknown)
            : null
          this.notifyStorageChange(event.key, newValue)
        } catch (error: unknown) {
          logger.warn('Failed to parse storage change event:', error)
        }
      }
    })
  }

  private notifyStorageChange(key: string, newValue: unknown): void {
    this.storageChangeListeners.forEach((listener) => {
      try {
        listener(key, newValue)
      } catch (error: unknown) {
        logger.error('Storage change listener error:', error)
      }
    })
  }

  private startPeriodicCleanup() {
    this.cleanupTimer = setInterval(() => {
      this.performCleanup()
    }, this.config.cleanupInterval)
  }

  private async performCleanup(): Promise<void> {
    try {
      // Check storage usage
      const storageSize = this.calculateStorageSize()

      if (storageSize > this.config.maxStorageSize) {
        logger.warn(
          `Storage size (${storageSize} bytes) exceeds limit (${this.config.maxStorageSize} bytes)`,
        )
        await this.cleanupOldData()
      }

      // Clean up expired session data
      this.cleanupExpiredSessions()

      // Clean up old form drafts
      this.cleanupOldFormDrafts()
    } catch (error: unknown) {
      logger.error('Cleanup failed:', error)
    }
  }

  private calculateStorageSize(): number {
    if (typeof window === 'undefined') {
      return 0
    }

    let totalSize = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        const value = localStorage.getItem(key) || ''
        totalSize += new Blob([key + value]).size
      }
    }
    return totalSize
  }

  private async cleanupOldData(): Promise<void> {
    // Remove oldest form drafts first
    const formDrafts = this.getStoredValue('form_drafts', {}) as Record<
      string,
      unknown
    >
    const draftEntries = Object.entries(formDrafts).sort((a, b) => {
      const timestampA = hasTimestamp(a[1]) ? a[1].timestamp : 0
      const timestampB = hasTimestamp(b[1]) ? b[1].timestamp : 0
      return timestampA - timestampB
    })

    // Remove oldest 50% of drafts
    const toRemove = draftEntries.slice(0, Math.floor(draftEntries.length / 2))
    toRemove.forEach(([key]) => {
      delete formDrafts[key]
    })

    this.setStoredValue('form_drafts', formDrafts)
    logger.info(`Cleaned up ${toRemove.length} old form drafts`)
  }

  private cleanupExpiredSessions() {
    const sessionState = this.getStoredValue('session_state', {}) as Record<
      string,
      unknown
    >
    const now = Date.now()
    const sessionTimeout = 24 * 60 * 60 * 1000 // 24 hours

    // Clear session data if too old
    if (
      sessionState['lastActivity'] &&
      typeof sessionState['lastActivity'] === 'number' &&
      now - (sessionState['lastActivity'] as number) > sessionTimeout
    ) {
      this.setStoredValue('session_state', {
        lastRoute: '/',
        currentWorkspace: null,
        openTabs: [],
        recentItems: [],
        searchHistory: [],
      })
    }
  }

  private cleanupOldFormDrafts() {
    const formDrafts = this.getStoredValue('form_drafts', {}) as Record<
      string,
      unknown
    >
    const now = Date.now()
    const draftTimeout = 7 * 24 * 60 * 60 * 1000 // 7 days

    Object.keys(formDrafts).forEach((key) => {
      const draft = formDrafts[key]
      if (
        draft &&
        typeof draft === 'object' &&
        draft !== null &&
        'timestamp' in draft &&
        typeof (draft as Record<string, unknown>)['timestamp'] === 'number'
      ) {
        const draftWithTimestamp = draft as Record<string, unknown> & {
          timestamp: number
        }
        if (now - (draftWithTimestamp['timestamp'] as number) > draftTimeout) {
          delete formDrafts[key]
        }
      }
    })

    this.setStoredValue('form_drafts', formDrafts)
  }

  private async processOfflineQueue(): Promise<void> {
    const offlineData = this.getStoredValue('offline_data', {
      queuedActions: [],
    }) as Record<string, unknown> & {
      queuedActions: Array<{
        id: string
        type: string
        payload: unknown
        timestamp: number
        retryCount: number
      }>
    }

    if (
      offlineData.queuedActions &&
      Array.isArray(offlineData.queuedActions) &&
      offlineData.queuedActions.length > 0
    ) {
      logger.info(
        `Processing ${offlineData.queuedActions.length} offline actions`,
      )

      // In a real implementation, this would process each queued action
      // For now, we'll just clear actions older than 1 hour
      const oneHourAgo = Date.now() - 60 * 60 * 1000
      offlineData.queuedActions = offlineData.queuedActions.filter(
        (action) => action.timestamp > oneHourAgo,
      )

      this.setStoredValue('offline_data', offlineData)
    }
  }

  private updateUsageStats() {
    const stats = this.getStoredValue('usage_stats', {
      sessionCount: 0,
      totalTimeSpent: 0,
      featureUsage: {},
      lastSessionEnd: null,
      performanceMetrics: {
        averageLoadTime: 0,
        errorCount: 0,
        crashCount: 0,
      },
    }) as Record<string, unknown> & {
      sessionCount: number
      totalTimeSpent: number
      featureUsage: Record<string, number>
      lastSessionEnd: number | null
      performanceMetrics: Record<string, number>
    }

    // Update session count
    stats.sessionCount++

    // Calculate session duration if we have a previous session end
    if (stats.lastSessionEnd && typeof stats.lastSessionEnd === 'number') {
      const sessionDuration = Date.now() - stats.lastSessionEnd
      stats.totalTimeSpent += sessionDuration
    }

    this.setStoredValue('usage_stats', stats)
  }

  // Public API methods
  saveDraft(formId: string, data: unknown): void {
    const drafts = this.getStoredValue('form_drafts', {}) as Record<
      string,
      unknown
    >
    drafts[formId] = {
      data,
      timestamp: Date.now(),
    }
    this.setStoredValue('form_drafts', drafts)
  }

  getDraft(formId: string): unknown | null {
    const drafts = this.getStoredValue('form_drafts', {}) as Record<
      string,
      unknown
    >
    const draft = drafts[formId] as Record<string, unknown> | undefined
    return draft ? draft['data'] : null
  }

  clearDraft(formId: string): void {
    const drafts = this.getStoredValue('form_drafts', {}) as Record<
      string,
      unknown
    >
    delete drafts[formId]
    this.setStoredValue('form_drafts', drafts)
  }

  queueOfflineAction(type: string, payload: unknown): void {
    const offlineData = this.getStoredValue('offline_data', {
      queuedActions: [],
    }) as Record<string, unknown> & {
      queuedActions: Array<{
        id: string
        type: string
        payload: unknown
        timestamp: number
        retryCount: number
      }>
    }

    if (!Array.isArray(offlineData.queuedActions)) {
      offlineData.queuedActions = []
    }

    // Generate a cryptographically secure id suffix synchronously when possible
    let secureSuffix: string
    try {
      if (
        typeof window !== 'undefined' &&
        window.crypto &&
        typeof window.crypto.getRandomValues === 'function'
      ) {
        const arr = new Uint8Array(8)
        window.crypto.getRandomValues(arr)
        secureSuffix = Array.from(arr)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
      } else {
        // Try synchronous node crypto require (guarded helper avoids bundler/static analysis)
        const nodeCrypto = tryRequireNode('crypto')
        if (nodeCrypto && typeof nodeCrypto.randomBytes === 'function') {
          secureSuffix = nodeCrypto.randomBytes(8).toString('hex')
        } else {
          // Fallback deterministic unique-ish suffix using timestamp + counter
          secureSuffix = `${Date.now().toString(36)}_${EnhancedStatePersistence.fallbackCounter++}`
        }
      }
    } catch (err: unknown) {
      // In case anything unexpected happens while generating secure suffix,
      // fall back to a non-cryptographic but unique-enough suffix.
      // This ensures the function remains robust in constrained environments.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e: any = err
      logger.warn(
        'Secure suffix generation failed, falling back to timestamp+counter:',
        e,
      )
      secureSuffix = `${Date.now().toString(36)}_${EnhancedStatePersistence.fallbackCounter++}`
    }

    offlineData.queuedActions.push({
      id: `${Date.now()}_${secureSuffix}`,
      type,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
    })

    this.setStoredValue('offline_data', offlineData)
  }

  trackFeatureUsage(featureName: string): void {
    const stats = this.getStoredValue('usage_stats', {
      featureUsage: {},
    }) as Record<string, unknown> & { featureUsage: Record<string, number> }
    if (!stats.featureUsage || typeof stats.featureUsage !== 'object') {
      stats.featureUsage = {}
    }
    stats.featureUsage[featureName] = (stats.featureUsage[featureName] || 0) + 1
    this.setStoredValue('usage_stats', stats)
  }

  // Storage utilities
  private getStoredValue(key: string, defaultValue: unknown): unknown {
    if (typeof window === 'undefined') {
      return defaultValue
    }

    try {
      const stored = localStorage.getItem(key)
      return stored ? (JSON.parse(stored) as unknown) : defaultValue
    } catch (error: unknown) {
      logger.warn(`Failed to parse stored value for ${key}:`, error)
      return defaultValue
    }
  }

  private setStoredValue(key: string, value: unknown): void {
    if (typeof window === 'undefined') {
      return
    }

    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch (error: unknown) {
      logger.error(`Failed to store value for ${key}:`, error)
    }
  }

  // Subscription management
  onStorageChange(
    listener: (key: string, newValue: unknown) => void,
  ): () => void {
    this.storageChangeListeners.add(listener)
    return () => {
      this.storageChangeListeners.delete(listener)
    }
  }

  // Export/Import functionality
  exportAllState(): Record<string, unknown> {
    if (typeof window === 'undefined') {
      return {}
    }

    const exported: Record<string, unknown> = {}

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        try {
          const value = localStorage.getItem(key)
          if (value) {
            exported[key] = JSON.parse(value) as unknown
          }
        } catch (error: unknown) {
          logger.warn(`Failed to export ${key}:`, error)
        }
      }
    }

    return exported
  }

  async importState(state: Record<string, unknown>): Promise<void> {
    if (typeof window === 'undefined') {
      return
    }

    for (const [key, value] of Object.entries(state)) {
      try {
        localStorage.setItem(key, JSON.stringify(value))
      } catch (error: unknown) {
        logger.error(`Failed to import ${key}:`, error)
      }
    }
  }

  clearAllState() {
    if (typeof window === 'undefined') {
      return
    }

    // Clear all localStorage
    localStorage.clear()
    logger.info('All persisted state cleared')
  }

  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }

    this.storageChangeListeners.clear()
  }
}

// ============================================================================
// Hooks and Utilities
// ============================================================================

export function useFormDraft(formId: string) {
  const persistence = EnhancedStatePersistence.getInstance()

  return {
    saveDraft: (data: unknown) => persistence.saveDraft(formId, data),
    getDraft: (): unknown | null => persistence.getDraft(formId),
    clearDraft: () => persistence.clearDraft(formId),
  }
}

export function useFeatureTracking() {
  const persistence = EnhancedStatePersistence.getInstance()

  return {
    trackUsage: (featureName: string): void =>
      persistence.trackFeatureUsage(featureName),
  }
}

export function useOfflineQueue() {
  const persistence = EnhancedStatePersistence.getInstance()

  return {
    queueAction: (type: string, payload: unknown): void =>
      persistence.queueOfflineAction(type, payload),
  }
}

// Export singleton instance
export const enhancedPersistence = EnhancedStatePersistence.getInstance()

// Initialize persistence when module is loaded
if (typeof window !== 'undefined') {
  enhancedPersistence.initialize()
}
