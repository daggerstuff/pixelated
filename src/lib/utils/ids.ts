/**
 * Utility functions for generating unique IDs
 *
 * This provides a consistent way to generate unique IDs across the application,
 * utilizing cryptographically secure random number generation.
 */

/**
 * Generates a unique ID with the specified length
 * @param length Length of the ID to generate (default: 16)
 * @returns A unique ID string
 */
export function generateId(length: number = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  
  let id = ''
  for (let i = 0; i < length; i++) {
    id += chars.charAt(bytes[i] % chars.length)
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
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  
  // Fallback for environments where randomUUID is not available (e.g. non-secure contexts)
  // Simple UUID v4 implementation using getRandomValues
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c: any) =>
    (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16),
  )
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
  const randomStr = generateId(8)
  return `${timestamp}-${randomStr}`
}

export default {
  generateUUID,
  generatePrefixedId,
  generateTimestampId,
}
