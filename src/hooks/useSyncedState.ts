import { useState, useEffect, useCallback, useRef } from 'react'
import storageManager from '@/utils/storage/storageManager'
import tabSyncManager from '@/utils/sync/tabSyncManager'
import type { StorageConfig } from '@/utils/storage/storageManager'

export interface UseSyncedStateOptions<T> extends Partial<StorageConfig> {
  key: string
  defaultValue: T
  debounceMs?: number
  enableSync?: boolean
  conflictStrategy?: 'local' | 'remote' | 'merge' | 'manual'
  onSync?: (value: T, sourceTabId: string) => void
  onConflict?: (localValue: T, remoteValue: T) => T
}

/**
 * React hook for state that syncs across browser tabs in real-time
 * Combines local storage persistence with cross-tab synchronization
 */
export function useSyncedState<T>({
  key,
  defaultValue,
  debounceMs = 300,
  enableSync = true,
  conflictStrategy = 'remote',
  onSync,
  onConflict,
  ...storageOptions
}: UseSyncedStateOptions<T>) {
  const [state, setState] = useState<T>(defaultValue)
  const [isLoaded, setIsLoaded] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'conflict' | 'offline'>('synced')
  const debounceRef = useRef<NodeJS.Timeout>()
  const lastSyncValueRef = useRef<T>(defaultValue)
  const ignoreNextRemoteUpdate = useRef(false)

  // Load initial value from storage
  useEffect(() => {
    const storedValue = storageManager.get(key, {
      defaultValue,
      ...storageOptions,
    })

    setState(storedValue)
    lastSyncValueRef.current = storedValue
    setIsLoaded(true)
  }, [key, defaultValue])

  // Set up tab synchronization listeners
  useEffect(() => {
    if (!enableSync || !tabSyncManager.isAvailable()) return

    const unsubscribeStateReceived = tabSyncManager.on('stateReceived', (data: any) => {
      if (data.key !== key) return

      // Avoid infinite loops by ignoring our own updates
      if (ignoreNextRemoteUpdate.current) {
        ignoreNextRemoteUpdate.current = false
        return
      }

      // Handle conflicts
      if (state !== defaultValue && data.value !== state) {
        let finalValue = data.value

        switch (conflictStrategy) {
          case 'local':
            finalValue = state
            break
          case 'merge':
            try {
              finalValue = mergeValues(state, data.value)
            } catch {
              finalValue = data.value
            }
            break
          case 'manual':
            finalValue = onConflict ? onConflict(state, data.value) : data.value
            break
          case 'remote':
          default:
            finalValue = data.value
            break
        }

        setState(finalValue)
        lastSyncValueRef.current = finalValue
        setSyncStatus('synced')

        onSync?.(finalValue, data.tabId)
      } else {
        setState(data.value)
        lastSyncValueRef.current = data.value
        setSyncStatus('synced')
        onSync?.(data.value, data.tabId)
      }
    })

    return unsubscribeStateReceived
  }, [key, enableSync, state, defaultValue, conflictStrategy, onSync, onConflict])

  // Debounced save to storage and sync across tabs
  const saveToStorageAndSync = useCallback((value: T) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      // Save to local storage
      const success = storageManager.set(key, value, storageOptions)
      if (success) {
        lastSyncValueRef.current = value

        // Sync across tabs if enabled
        if (enableSync && tabSyncManager.isAvailable()) {
          setSyncStatus('syncing')
          const synced = tabSyncManager.syncState(key, value)
          if (synced) {
            setSyncStatus('synced')
          } else {
            setSyncStatus('offline')
          }
        }
      }
    }, debounceMs)
  }, [key, debounceMs, enableSync, storageOptions])

  // Enhanced setState that also persists and syncs
  const setSyncedState = useCallback((value: T | ((prev: T) => T)) => {
    setState(prev => {
      const newValue = typeof value === 'function'
        ? (value as (prev: T) => T)(prev)
        : value

      // Only save and sync if value actually changed
      if (newValue !== lastSyncValueRef.current) {
        saveToStorageAndSync(newValue)

        // Mark that we should ignore the next remote update (our own)
        if (enableSync) {
          ignoreNextRemoteUpdate.current = true
        }
      }

      return newValue
    })
  }, [saveToStorageAndSync, enableSync])

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  return [state, setSyncedState, isLoaded, syncStatus] as const
}

/**
 * Hook for syncing objects across tabs
 */
export function useSyncedObject<T extends Record<string, any>>({
  key,
  defaultValue,
  debounceMs = 300,
  enableSync = true,
  conflictStrategy = 'remote',
  onSync,
  onConflict,
  ...storageOptions
}: Omit<UseSyncedStateOptions<T>, 'defaultValue'> & {
  defaultValue: T
}) {
  const [state, setState, isLoaded, syncStatus] = useSyncedState({
    key,
    defaultValue,
    debounceMs,
    enableSync,
    conflictStrategy,
    onSync,
    onConflict,
    ...storageOptions,
  })

  const updateField = useCallback(<K extends keyof T>(
    field: K,
    value: T[K] | ((prev: T[K]) => T[K])
  ) => {
    setState(prev => ({
      ...prev,
      [field]: typeof value === 'function'
        ? (value as (prev: T[K]) => T[K])(prev[field])
        : value,
    }))
  }, [setState])

  const removeField = useCallback((field: keyof T) => {
    setState(prev => {
      const newState = { ...prev }
      delete newState[field]
      return newState
    })
  }, [setState])

  return [state, setState, updateField, removeField, isLoaded, syncStatus] as const
}

/**
 * Simple value merging strategy
 */
function mergeValues<T>(local: T, remote: T): T {
  if (typeof local !== 'object' || typeof remote !== 'object') {
    return remote
  }

  if (Array.isArray(local) && Array.isArray(remote)) {
    return [...new Set([...local, ...remote])] as T
  }

  if (local && remote && typeof local === 'object' && typeof remote === 'object') {
    const merged = { ...local } as Record<string, any>
    for (const [key, value] of Object.entries(remote)) {
      if (merged[key] && typeof merged[key] === 'object' && typeof value === 'object') {
        merged[key] = mergeValues(merged[key], value)
      } else {
        merged[key] = value
      }
    }
    return merged as T
  }

  return remote
}

export default useSyncedState