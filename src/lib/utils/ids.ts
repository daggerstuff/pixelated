/**
 * Utility functions for generating unique IDs
 *
 * This provides a consistent way to generate unique IDs across the application,
 * with fallbacks for environments where crypto.randomUUID() is not available.
 */

/**
 * Generates a unique ID with the specified length
 * @param length Length of the ID to generate (default: 16)
 * @returns A unique ID string
 */
export function generateId(length: number = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let id = ''

  for (let i = 0; i < length; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  return id
}

/**
 * Generate a UUID v4 compliant ID
 *
 * Uses the built-in crypto.randomUUID() for secure UUID generation.
 *
 * @returns A UUID v4 string
 */
export function generateUUID(): string {
  return crypto.randomUUID()
}

/**
 * Generate a prefixed unique ID
 *
 * @param prefix A string prefix to add to the ID
 * @returns A unique ID with the given prefix
 */
export function generatePrefixedId(prefix: string): string {
  return `${prefix}-${generateUUID()}`
}

/**
 * Generate a timestamp-based ID
 *
 * @returns A unique ID based on the current timestamp and a random string
 */
export function generateTimestampId(): string {
  const timestamp = Date.now().toString(36)
  const randomStr = Math.random().toString(36).substring(2, 15)
  return `${timestamp}-${randomStr}`
}

export default {
  generateUUID,
  generatePrefixedId,
  generateTimestampId,
}
