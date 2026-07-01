/**
 * Async utilities including delay, retry, debounce, throttle, and memoize
 */

/**
 * Creates a promise that resolves after the specified delay
 * @param ms - Delay in milliseconds
 * @returns Promise that resolves after delay
 */
export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Sleeps for a specified number of milliseconds (alias for delay)
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after sleep
 */
export const sleep = delay

/**
 * Retries an async function with exponential backoff
 * @param fn - Function to retry
 * @param maxAttempts - Maximum number of attempts
 * @param baseDelay - Base delay in milliseconds
 * @returns Result of the function
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelay = 1000,
): Promise<T> {
  let lastError: Error = new Error('Unknown retry failure')

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error: unknown) {
      if (error instanceof Error) {
        lastError = error
      } else {
        lastError = new Error(
          typeof error === 'string' ? error : 'Unknown retry failure',
        )
      }

      if (attempt === maxAttempts) {
        throw lastError
      }

      const delayMs = baseDelay * Math.pow(2, attempt - 1)
      await delay(delayMs)
    }
  }

  throw lastError
}

/**
 * Creates a debounced version of a function
 * @param fn - Function to debounce
 * @param delayMs - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delayMs: number,
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delayMs)
  }
}

/**
 * Creates a throttled version of a function
 * @param fn - Function to throttle
 * @param interval - Interval in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  interval: number,
): (...args: Parameters<T>) => void {
  let lastCallTime = 0

  return (...args: Parameters<T>) => {
    const now = Date.now()
    if (now - lastCallTime >= interval) {
      lastCallTime = now
      fn(...args)
    }
  }
}

/**
 * Creates a memoized version of a function with a simple cache
 * @param fn - Function to memoize
 * @returns Memoized function
 */
export function memoize<T extends (...args: unknown[]) => unknown>(fn: T): T {
  const cache = new Map<string, ReturnType<T>>()

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = args.length === 1 ? String(args[0]) : JSON.stringify(args)

    if (cache.has(key)) {
      return cache.get(key)!
    }

    const result = fn(...args) as ReturnType<T>
    cache.set(key, result)
    return result
  }) as T
}
