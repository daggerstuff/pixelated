/**
 * Browser storage utilities for safely interacting with localStorage
 */

const isBrowserEnvironment = () =>
  typeof window !== 'undefined' && typeof document !== 'undefined'

/**
 * Safely gets an item from localStorage
 * @param key - Storage key
 * @param defaultValue - Default value if key doesn't exist
 * @returns Stored value or default
 */
export function getStorageItem<T>(key: string, defaultValue: T): T {
  if (!isBrowserEnvironment()) {
    return defaultValue
  }

  try {
    const item = localStorage.getItem(key)
    return item !== null ? JSON.parse(item) : defaultValue
  } catch {
    return defaultValue
  }
}

/**
 * Safely sets an item in localStorage
 * @param key - Storage key
 * @param value - Value to store
 */
export function setStorageItem(key: string, value: unknown): void {
  if (!isBrowserEnvironment()) {
    return
  }

  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Silently fail if storage is not available
  }
}

/**
 * Safely removes an item from localStorage
 * @param key - Storage key
 */
export function removeStorageItem(key: string): void {
  if (!isBrowserEnvironment()) {
    return
  }

  try {
    localStorage.removeItem(key)
  } catch {
    // Silently fail if storage is not available
  }
}
