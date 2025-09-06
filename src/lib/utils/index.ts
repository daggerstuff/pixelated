/**
 * Utility functions for the Therapy Chat System
 */

/**
 * Generate a unique ID string
 * @returns A unique ID string
 */
export function generateId(): string {
  return `id_${Math.random()
    .toString(36)
    .substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`
}

/**
 * Creates a memoized version of a function that caches its results
 * @param fn Function to memoize
 * @returns Memoized function with same signature
 */
export function memoize<T extends (...args: unknown[]) => unknown>(fn: T): T {
  const cache = new Map<string, ReturnType<T>>()

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = JSON.stringify(args)

    if (cache.has(key)) {
      return cache.get(key) as ReturnType<T>
    }

    const result = fn(...args) as ReturnType<T>
    cache.set(key, result)
    return result
  }) as T
}
