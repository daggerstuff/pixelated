/**
 * Array utilities including chunk, unique, groupBy, shuffle, and range
 */

import { secureRandomInt } from './crypto/secure-random'

// ============================================================================
// Error messages
// ============================================================================

export const ARRAY_ERRORS = {
  SPARSE_ARRAY_DETECTED: (index: number) =>
    `Sparse array detected at index ${index}`,
  CANNOT_SHUFFLE_SPARSE_ARRAY:
    'Cannot shuffle sparse arrays: input contains holes.',
}

// ============================================================================
// Operations
// ============================================================================

/**
 * Chunks an array into smaller arrays of specified size
 * @param array - Array to chunk
 * @param size - Size of each chunk
 * @returns Array of chunks
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

/**
 * Removes duplicates from an array
 * @param array - Array to deduplicate
 * @param keyFn - Optional key function for objects
 * @returns Array without duplicates
 */
export function unique<T>(array: T[], keyFn?: (item: T) => unknown): T[] {
  if (!keyFn) {
    return [...new Set(array)]
  }

  const seen = new Set<unknown>()
  return array.filter((item) => {
    const key = keyFn(item)
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

/**
 * Groups array items by a key function
 * @param array - Array to group
 * @param keyFn - Function that returns the group key
 * @returns Object with grouped items
 */
export function groupBy<T, K extends string | number | symbol>(
  array: T[],
  keyFn: (item: T) => K,
): Record<K, T[]> {
  return array.reduce(
    (groups, item) => {
      const key = keyFn(item)
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(item)
      return groups
    },
    {} as Record<K, T[]>,
  )
}

/**
 * Asserts that an array is dense (no holes), otherwise throws.
 * The main value is to type-narrow arr from (T | undefined)[] to T[] for strict TypeScript assignment.
 */
function assertDense<T>(array: (T | undefined)[]): asserts array is T[] {
  for (let i = 0; i < array.length; ++i) {
    if (!(i in array)) {
      throw new Error(ARRAY_ERRORS.SPARSE_ARRAY_DETECTED(i))
    }
  }
}

/**
 * Returns a shuffled copy of the input using Fisher-Yates and crypto secure random.
 * @param input - The array to shuffle (never mutated)
 * @returns New shuffled array
 */
export function shuffle<T>(input: readonly T[]): T[] {
  if (input.some((_, i, a) => !(i in a))) {
    throw new Error(ARRAY_ERRORS.CANNOT_SHUFFLE_SPARSE_ARRAY)
  }
  const arr = input.map((x) => x)
  assertDense(arr)

  for (let i = arr.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1)
    const temp: T = arr[i]
    arr[i] = arr[j]
    arr[j] = temp
  }
  return arr
}

/**
 * Creates a range of numbers
 * @param start - Start number
 * @param end - End number
 * @param step - Step size (default: 1)
 * @returns Array of numbers in range
 */
export function range(start: number, end: number, step = 1): number[] {
  const result: number[] = []
  for (let i = start; i <= end; i += step) {
    result.push(i)
  }
  return result
}
