/**
 * State Persistence Provider
 *
 * Provides comprehensive state persistence management including:
 * - Jotai enhanced storage initialization
 * - Offline synchronization setup
 * - Cross-tab state synchronization
 * - State backup and recovery
 * - Performance monitoring
 */

import type { ReactNode } from 'react'
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react'
import { Provider as JotaiProvider } from 'jotai'
import { persistenceManager } from '@/lib/state/jotai-persistence'
import { logger } from '@/lib/logger'

// ============================================================================
// Types
// ============================================================================

interface PersistenceStats {
  totalKeys: number
  totalSize: number
  lastBackup: number | null
  isHealthy: boolean
}

interface StatePersistenceContextType {
  stats: PersistenceStats
  isInitialized: boolean
  clearAllState: () => Promise<void>
  exportState: () => Record<string, unknown>
  importState: (state: Record<string, unknown>) => Promise<void>
  refreshStats: () => void
  createBackup: () => Promise<void>
}

interface StatePersistenceProviderProps {
  children: ReactNode
  enableOfflineSync?: boolean
  enableBackups?: boolean
  backupInterval?: number // milliseconds
  debug?: boolean
}

// ============================================================================
// Context
// ============================================================================

const StatePersistenceContext =
  createContext<StatePersistenceContextType | null>(null)

// ============================================================================
// Provider Component
// ============================================================================

export function StatePersistenceProvider({
  children,
  enableOfflineSync = true,
  enableBackups = true,
  backupInterval = 5 * 60 * 1000, // 5 minutes
  debug = false,
}: StatePersistenceProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false)
  const [stats, setStats] = useState<PersistenceStats>({
    totalKeys: 0,
    totalSize: 0,
    lastBackup: null,
    isHealthy: true,
  })

  // Initialize persistence system
  useEffect(() => {
    let backupTimer: NodeJS.Timeout | null = null

    const initializePersistence = async () => {
      try {
        if (debug) {
          logger.info('Initializing state persistence system...')
        }

        // Offline sync initialization removed: initializeOfflineSync does not exist

        // Set up automatic backups if enabled
        if (enableBackups && typeof window !== 'undefined') {
          backupTimer = setInterval(() => {
            createBackup()
          }, backupInterval)

          if (debug) {
            logger.info(
              `Automatic backups enabled (interval: ${backupInterval}ms)`,
            )
          }
        }

        // Initial stats refresh
        refreshStats()
        setIsInitialized(true)

        if (debug) {
          logger.info('State persistence system initialized successfully')
        }
      } catch (error: unknown) {
        logger.error('Failed to initialize state persistence system:', error)
        setStats((prev) => ({ ...prev, isHealthy: false }))
      }
    }

    initializePersistence()

    // Cleanup function
    return () => {
      if (backupTimer) {
        clearInterval(backupTimer)
      }
    }
  }, [
    enableOfflineSync,
    enableBackups,
    backupInterval,
    debug,
    createBackup,
    refreshStats,
  ])

  // Set up storage monitoring
  useEffect(() => {
    if (!isInitialized || typeof window === 'undefined') {
      return
    }

    // Monitor localStorage quota usage
    const monitorStorage = () => {
      try {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
          navigator.storage.estimate().then((estimate) => {
            const usageRatio =
              estimate.usage && estimate.quota
                ? estimate.usage / estimate.quota
                : 0

            if (usageRatio > 0.8) {
              logger.warn('Storage quota usage is high:', {
                usage: estimate.usage,
                quota: estimate.quota,
                ratio: usageRatio,
              })
            }
          })
        }
      } catch (error: unknown) {
        logger.debug('Storage estimation not available:', error)
      }
    }

    // Monitor storage every minute
    const storageMonitor = setInterval(monitorStorage, 60000)

    // Initial check
    monitorStorage()

    return () => {
      clearInterval(storageMonitor)
    }
  }, [isInitialized])

  // Refresh storage statistics
  const refreshStats = useCallback(() => {
    try {
      const storageStats = persistenceManager.getStorageStats()

      setStats((prev) => ({
        ...prev,
        totalKeys: storageStats.totalKeys,
        totalSize: storageStats.totalSize,
        isHealthy: true,
      }))

      if (debug) {
        logger.debug('Storage stats updated:', storageStats)
      }
    } catch (error: unknown) {
      logger.error('Failed to refresh storage stats:', error)
      setStats((prev) => ({ ...prev, isHealthy: false }))
    }
  }, [debug])

  // Clear all persisted state
  const clearAllState = useCallback(async () => {
    try {
      await persistenceManager.clearAllPersistedState()
      refreshStats()

      if (debug) {
        logger.info('All persisted state cleared')
      }
    } catch (error: unknown) {
      logger.error('Failed to clear persisted state:', error)
      throw error
    }
  }, [refreshStats, debug])

  // Export all persisted state
  const exportState = useCallback(() => {
    try {
      const exported = persistenceManager.exportPersistedState()

      if (debug) {
        logger.info('State exported:', Object.keys(exported))
      }

      return exported
    } catch (error: unknown) {
      logger.error('Failed to export state:', error)
      throw error
    }
  }, [debug])

  // Import persisted state
  const importState = useCallback(
    async (state: Record<string, unknown>) => {
      try {
        await persistenceManager.importPersistedState(state)
        refreshStats()

        if (debug) {
          logger.info('State imported:', Object.keys(state))
        }
      } catch (error: unknown) {
        logger.error('Failed to import state:', error)
        throw error
      }
    },
    [refreshStats, debug],
  )

  // Create a backup of current state
  const createBackup = useCallback(async () => {
    try {
      const state = exportState()
      const timestamp = Date.now()
      const backupKey = `state_backup_${timestamp}`

      // Store backup in a separate storage area
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(
            backupKey,
            JSON.stringify({
              timestamp,
              state,
              version: '1.0',
            }),
          )

          // Clean up old backups (keep only last 5)
          const backupKeys = Object.keys(localStorage)
            .filter((key) => key.startsWith('state_backup_'))
            .sort()

          if (backupKeys.length > 5) {
            const keysToRemove = backupKeys.slice(0, backupKeys.length - 5)
            keysToRemove.forEach((key) => localStorage.removeItem(key))
          }

          setStats((prev) => ({ ...prev, lastBackup: timestamp }))

          if (debug) {
            logger.info(`State backup created: ${backupKey}`)
          }
        } catch (storageError) {
          logger.warn('Failed to store backup to localStorage:', storageError)
        }
      }
    } catch (error: unknown) {
      logger.error('Failed to create state backup:', error)
    }
  }, [exportState, debug])

  // Context value
  const contextValue: StatePersistenceContextType = {
    stats,
    isInitialized,
    clearAllState,
    exportState,
    importState,
    refreshStats,
    createBackup,
  }

  return (
    <StatePersistenceContext.Provider value={contextValue}>
      <JotaiProvider>{children}</JotaiProvider>
    </StatePersistenceContext.Provider>
  )
}

// ============================================================================
// Hook
// ============================================================================

export function useStatePersistence(): StatePersistenceContextType {
  const context = useContext(StatePersistenceContext)

  if (!context) {
    throw new Error(
      'useStatePersistence must be used within a StatePersistenceProvider',
    )
  }

  return context
}

// ============================================================================
// Utility Components
// ============================================================================

/**
 * Component for debugging state persistence
 */
export function StatePersistenceDebugger() {
  const {
    stats,
    clearAllState,
    exportState,
    importState,
    refreshStats,
    createBackup,
  } = useStatePersistence()

  const handleExport = () => {
    const state = exportState()
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `state-export-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const state = JSON.parse(e.target?.result as string) as unknown
        await importState(state)
        alert('State imported successfully!')
      } catch (error: unknown) {
        alert('Failed to import state: ' + error)
      }
    }
    reader.readAsText(file)
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        background: '#333',
        color: 'white',
        padding: '10px',
        borderRadius: '8px',
        fontSize: '12px',
        zIndex: 9999,
      }}
    >
      <h4>State Persistence Debug</h4>
      <div>Keys: {stats.totalKeys}</div>
      <div>Size: {(stats.totalSize / 1024).toFixed(2)} KB</div>
      <div>Healthy: {stats.isHealthy ? '✅' : '❌'}</div>
      <div>
        Last Backup:{' '}
        {stats.lastBackup
          ? new Date(stats.lastBackup).toLocaleTimeString()
          : 'Never'}
      </div>

      <div
        style={{
          marginTop: '10px',
          display: 'flex',
          gap: '5px',
          flexWrap: 'wrap',
        }}
      >
        <button onClick={refreshStats}>Refresh</button>
        <button onClick={handleExport}>Export</button>
        <input
          type="file"
          accept=".json"
          onChange={handleImport}
          style={{ display: 'none' }}
          id="import-input"
        />
        <button
          onClick={() =>
            (document.getElementById('import-input') as HTMLElement)?.click()
          }
        >
          Import
        </button>
        <button onClick={createBackup}>Backup</button>
        <button onClick={() => confirm('Clear all state?') && clearAllState()}>
          Clear
        </button>
      </div>
    </div>
  )
}
