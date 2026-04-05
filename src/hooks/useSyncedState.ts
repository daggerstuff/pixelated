import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react'

import { mergeValues } from '@/utils/object'
import storageManager from '@/utils/storage/storageManager'
import type { StorageConfig } from '@/utils/storage/storageManager'
import tabSyncManager from '@/utils/sync/tabSyncManager'

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
  const [syncStatus, setSyncStatus] = useState<
    'synced' | 'syncing' | 'conflict' | 'offline'
  >('synced')
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const lastSyncValueRef = useRef<T>(defaultValue)
  const stateRef = useRef<T>(defaultValue)
  const instanceId = useRef(Math.random().toString(36).substring(2, 11))

  // Load initial value from storage
  useEffect(() => {
    const storedValue = storageManager.get(key, {
      defaultValue,
      ...storageOptions,
    })

    setState(storedValue)
    stateRef.current = storedValue
    lastSyncValueRef.current = storedValue
    setIsLoaded(true)
  }, [key, defaultValue, storageOptions])

  // Keep ref up to date with state synchronously after commit
  useLayoutEffect(() => {
    stateRef.current = state
  }, [state])

  // Set up tab synchronization listeners
  useEffect(() => {
    if (!enableSync || !tabSyncManager.isAvailable()) return

    const unsubscribeStateReceived = tabSyncManager.on(
      'stateReceived',
      (data: any) => {
        if (data.key !== key) return

        // Avoid infinite loops by ignoring our own broadcasts
        if (data.sourceId === instanceId.current) {
          return
        }

        // Bridge: capture the resolved value so we can pass it to onSync after
        // the functional updater runs (updaters must be pure — no side effects).
        let resolvedValue: T = data.value

        // Use a functional setState so the conflict resolution always runs
        // against the provably-latest local state supplied by React, rather
        // than a potentially-stale ref value captured before the first
        // useLayoutEffect fires or during a rapid render burst.
        setState((currentState) => {
          let finalValue: T = data.value

          if (currentState !== defaultValue && data.value !== currentState) {
            switch (conflictStrategy) {
              case 'local':
                finalValue = currentState
                break
              case 'merge':
                try {
                  finalValue = mergeValues(currentState, data.value)
                } catch {
                  finalValue = data.value
                }
                break
              case 'manual':
                finalValue = onConflict
                  ? onConflict(currentState, data.value)
                  : data.value
                break
              case 'remote':
              default:
                finalValue = data.value
                break
            }
          }

          // Keep refs consistent with the resolved value.
          stateRef.current = finalValue
          lastSyncValueRef.current = finalValue
          // Capture for use in the post-update onSync call below.
          resolvedValue = finalValue

          return finalValue
        })

        setSyncStatus('synced')
        // Call onSync with the authoritative resolved value (may differ from
        // data.value when conflictStrategy is 'local', 'merge', or 'manual').
        onSync?.(resolvedValue, data.tabId)
      },
    )

    return unsubscribeStateReceived
  }, [
    key,
    enableSync,
    defaultValue,
    conflictStrategy,
    onSync,
    onConflict,
  ])

  // Debounced save to storage and sync across tabs
  const saveToStorageAndSync = useCallback(
    (value: T) => {
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
            const synced = tabSyncManager.syncState(key, value, instanceId.current)
            if (synced) {
              setSyncStatus('synced')
            } else {
              setSyncStatus('offline')
            }
          }
        }
      }, debounceMs)
    },
    [key, debounceMs, enableSync, storageOptions],
  )

  // Enhanced setState that also persists and syncs
  const setSyncedState = useCallback(
    (value: T | ((prev: T) => T)) => {
      setState((prev) => {
        const newValue =
          typeof value === 'function' ? (value as (prev: T) => T)(prev) : value

        // Only save and sync if value actually changed
        if (newValue !== lastSyncValueRef.current) {
          saveToStorageAndSync(newValue)
        }

        return newValue
      })
    },
    [saveToStorageAndSync],
  )

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

  const updateField = useCallback(
    <K extends keyof T>(field: K, value: T[K] | ((prev: T[K]) => T[K])) => {
      setState((prev) => ({
        ...prev,
        [field]:
          typeof value === 'function'
            ? (value as (prev: T[K]) => T[K])(prev[field])
            : value,
      }))
    },
    [setState],
  )

  const removeField = useCallback(
    (field: keyof T) => {
      setState((prev) => {
        const newState = { ...prev }
        delete newState[field]
        return newState
      })
    },
    [setState],
  )

  return [
    state,
    setState,
    updateField,
    removeField,
    isLoaded,
    syncStatus,
  ] as const
}

export default useSyncedState
