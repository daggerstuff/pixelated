import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react'

import { mergeValues } from '@/utils/object'
import storageManager from '@/utils/storage/storageManager'
import type { StorageConfig } from '@/utils/storage/storageManager'
import { useSyncManager } from '@/lib/providers/SyncContext'

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
  const syncManager = useSyncManager()
  const [state, setState] = useState<T>(defaultValue)
  const [isLoaded, setIsLoaded] = useState(false)
  const [syncStatus, setSyncStatus] = useState<
    'synced' | 'syncing' | 'conflict' | 'offline'
  >('synced')
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const lastSyncValueRef = useRef<T>(defaultValue)
  const stateRef = useRef<T>(defaultValue)
  const instanceId = useRef(Math.random().toString(36).substring(2, 11))
  // pendingSyncRef carries a resolved sync event to the post-commit onSync
  // delivery effect without going through the useState updater.
  const pendingSyncRef = useRef<{ value: T; tabId: string } | null>(null)
  // Stable ref for the onSync callback so it never appears in useEffect deps.
  const onSyncRef = useRef(onSync)
  useLayoutEffect(() => {
    onSyncRef.current = onSync
  })

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

  // Keep refs up to date with state synchronously after commit
  useLayoutEffect(() => {
    stateRef.current = state

    // Process pending incoming remote syncs here, to ensure refs remain in sync with the actual state
    // and avoid executing side-effects within the rendering phase.
    const pending = pendingSyncRef.current
    if (pending) {
      pendingSyncRef.current = null
      if (pending.value === state) {
        lastSyncValueRef.current = pending.value
        if (onSyncRef.current) {
          onSyncRef.current(pending.value, pending.tabId)
        }
      }
    }
  }, [state])

  // Set up tab synchronization listeners
  useEffect(() => {
    if (!enableSync || !syncManager.isAvailable()) return

    const unsubscribeStateReceived = syncManager.on(
      'stateReceived',
      (data: any) => {
        if (data.key !== key) return

        // Avoid infinite loops by ignoring our own broadcasts
        if (data.sourceId === instanceId.current) {
          return
        }

        // Use a functional updater to ensure we are resolving conflicts against 
        // the ABSOLUTE latest state, including any pending local updates.
        setState((currentState) => {
          let resolvedValue: T = data.value

          if (currentState !== defaultValue && data.value !== currentState) {
            switch (conflictStrategy) {
              case 'local':
                resolvedValue = currentState
                break
              case 'merge':
                try {
                  resolvedValue = mergeValues(currentState, data.value)
                } catch {
                  resolvedValue = data.value
                }
                break
              case 'manual':
                resolvedValue = onConflict
                  ? onConflict(currentState, data.value)
                  : data.value
                break
              case 'remote':
              default:
                resolvedValue = data.value
                break
            }
          }

          // Record the resolved event before the state update commits so that the
          // post-commit useLayoutEffect can synchronize refs and deliver onSync.
          // Note: we update the ref inside the updater to capture the resolved value
          // relative to the currentState used for this specific update.
          pendingSyncRef.current = { value: resolvedValue, tabId: data.tabId }

          return resolvedValue
        })

        setSyncStatus('synced')
      },
    )

    return unsubscribeStateReceived
  }, [
    key,
    enableSync,
    defaultValue,
    conflictStrategy,
    onConflict,
    syncManager,
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
          if (enableSync && syncManager.isAvailable()) {
            setSyncStatus('syncing')
            const synced = syncManager.syncState(
              key,
              value,
              instanceId.current,
            )
            if (synced) {
              setSyncStatus('synced')
            } else {
              setSyncStatus('offline')
            }
          }
        }
      }, debounceMs)
    },
    [key, debounceMs, enableSync, storageOptions, syncManager],
  )

  // Enhanced setState that updates local state without side-effects in updaters
  const setSyncedState = useCallback(
    (value: T | ((prev: T) => T)) => {
      setState(value)
    },
    [],
  )

  // Trigger sync for local state changes
  useEffect(() => {
    // If state differs from lastSyncValueRef, this is a local update
    if (isLoaded && state !== lastSyncValueRef.current) {
      saveToStorageAndSync(state)
    }
  }, [state, isLoaded, saveToStorageAndSync])

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
