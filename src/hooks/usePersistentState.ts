import { useState, useEffect, useCallback, useRef } from 'react'
import storageManager from '@/utils/storage/storageManager'
import type { StorageConfig } from '@/utils/storage/storageManager'

interface UsePersistentStateOptions<T> extends Partial<StorageConfig> {
  key: string
  defaultValue: T
  debounceMs?: number
  syncAcrossTabs?: boolean
}

/**
 * React hook for persistent state management with localStorage/sessionStorage
 * Features automatic serialization, debouncing, and cross-tab synchronization
 */
export function usePersistentState<T>({
  key,
  defaultValue,
  debounceMs = 300,
  syncAcrossTabs = false,
  ...storageOptions
}: UsePersistentStateOptions<T>) {
  const [state, setState] = useState<T>(defaultValue)
  const [isLoaded, setIsLoaded] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout>()
  const lastStoredValueRef = useRef<T>(defaultValue)

  // Load initial value from storage
  useEffect(() => {
    const storedValue = storageManager.get(key, {
      defaultValue,
      ...storageOptions,
    })

    setState(storedValue)
    lastStoredValueRef.current = storedValue
    setIsLoaded(true)
  }, [key, defaultValue, storageOptions])

  // Cross-tab synchronization
  useEffect(() => {
    if (!syncAcrossTabs || typeof window === 'undefined') return

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === storageManager.getFullKey(key) && e.newValue) {
        try {
          const newValue = JSON.parse(e.newValue)
          if (newValue.value !== undefined) {
            setState(newValue.value)
            lastStoredValueRef.current = newValue.value
          }
        } catch (error) {
          console.warn('Failed to parse storage change:', error)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [key, syncAcrossTabs])

  // Debounced save to storage
  const saveToStorage = useCallback(
    (value: T) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      debounceRef.current = setTimeout(() => {
        const success = storageManager.set(key, value, storageOptions)
        if (success) {
          lastStoredValueRef.current = value

          // Trigger cross-tab sync
          if (syncAcrossTabs && typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('persistentStateChange', {
                detail: { key, value },
              }),
            )
          }
        }
      }, debounceMs)
    },
    [key, debounceMs, syncAcrossTabs, storageOptions],
  )

  // Enhanced setState that also persists to storage
  const setPersistentState = useCallback(
    (value: T | ((prev: T) => T)) => {
      setState((prev) => {
        const newValue =
          typeof value === 'function' ? (value as (prev: T) => T)(prev) : value

        // Only save if value actually changed
        if (newValue !== lastStoredValueRef.current) {
          saveToStorage(newValue)
        }

        return newValue
      })
    },
    [saveToStorage],
  )

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  return [state, setPersistentState, isLoaded] as const
}

/**
 * Hook for managing multiple persistent state values as a single object
 */
export function usePersistentObject<T extends Record<string, any>>({
  key,
  defaultValue,
  debounceMs = 300,
  syncAcrossTabs = false,
  ...storageOptions
}: Omit<UsePersistentStateOptions<T>, 'defaultValue'> & {
  defaultValue: T
}) {
  const [state, setState, isLoaded] = usePersistentState({
    key,
    defaultValue,
    debounceMs,
    syncAcrossTabs,
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

  return [state, setState, updateField, removeField, isLoaded] as const
}

/**
 * Hook for managing arrays with persistence
 */
export function usePersistentArray<T>({
  key,
  defaultValue = [] as T[],
  debounceMs = 300,
  syncAcrossTabs = false,
  ...storageOptions
}: Omit<UsePersistentStateOptions<T[]>, 'defaultValue'> & {
  defaultValue?: T[]
}) {
  const [state, setState, isLoaded] = usePersistentState({
    key,
    defaultValue,
    debounceMs,
    syncAcrossTabs,
    ...storageOptions,
  })

  const push = useCallback(
    (item: T) => {
      setState((prev) => [...prev, item])
    },
    [setState],
  )

  const pop = useCallback(() => {
    setState((prev) => prev.slice(0, -1))
  }, [setState])

  const shift = useCallback(() => {
    setState((prev) => prev.slice(1))
  }, [setState])

  const unshift = useCallback(
    (item: T) => {
      setState((prev) => [item, ...prev])
    },
    [setState],
  )

  const removeAt = useCallback(
    (index: number) => {
      setState((prev) => prev.filter((_, i) => i !== index))
    },
    [setState],
  )

  const updateAt = useCallback(
    (index: number, item: T) => {
      setState((prev) =>
        prev.map((existing, i) => (i === index ? item : existing)),
      )
    },
    [setState],
  )

  const clear = useCallback(() => {
    setState([])
  }, [setState])

  return [
    state,
    {
      set: setState,
      push,
      pop,
      shift,
      unshift,
      removeAt,
      updateAt,
      clear,
    },
    isLoaded,
  ] as const
}

/**
 * Hook for managing key-value maps with persistence
 */
export function usePersistentMap<K extends string | number | symbol, V>({
  key,
  defaultValue = new Map<K, V>(),
  debounceMs = 300,
  syncAcrossTabs = false,
  ...storageOptions
}: Omit<UsePersistentStateOptions<Map<K, V>>, 'defaultValue'> & {
  defaultValue?: Map<K, V>
}) {
  const [state, setState, isLoaded] = usePersistentState({
    key,
    defaultValue: Array.from(defaultValue.entries()),
    debounceMs,
    syncAcrossTabs,
    ...storageOptions,
  })

  // Convert array back to Map for easier manipulation
  const mapState = new Map<K, V>(state)

  const set = useCallback(
    (key: K, value: V) => {
      const newMap = new Map(mapState)
      newMap.set(key, value)
      setState(Array.from(newMap.entries()))
    },
    [setState],
  )

  const get = useCallback((key: K) => mapState.get(key), [])

  const has = useCallback((key: K) => mapState.has(key), [])

  const remove = useCallback(
    (key: K) => {
      const newMap = new Map(mapState)
      newMap.delete(key)
      setState(Array.from(newMap.entries()))
    },
    [setState],
  )

  const clear = useCallback(() => {
    setState([])
  }, [setState])

  return [mapState, { set, get, has, remove, clear }, isLoaded] as const
}

export default usePersistentState
