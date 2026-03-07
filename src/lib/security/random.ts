/**
 * Secure Random Number Generation Utilities
 *
 * This module provides cryptographically secure alternatives to Math.random()
 * for all security-sensitive operations including ID generation, token creation,
 * random selection, and cryptographic operations.
 */

import {
  getRandomBytes,
  secureRandomInt,
  randomInt as secureRandomIntRange,
} from '../utils.js'

/**
 * Generates a cryptographically secure random string for IDs
 * @param length - Length of the string (default: 8)
 * @param charset - Character set to use (default: alphanumeric)
 * @returns Secure random string
 */
export function secureRandomString(
  length = 8,
  charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
): string {
  if (length <= 0) {
    throw new Error('Length must be positive')
  }

  const bytes = getRandomBytes(length)
  let result = ''

  for (let i = 0; i < length; i++) {
    const byte = bytes[i]
    if (byte === undefined) {
      throw new Error('Unexpected undefined byte in secure random generation')
    }
    result += charset.charAt(byte % charset.length)
  }

  return result
}

/**
 * Generates a secure UUID v4 string
 * @returns UUID v4 string
 */
export function secureUUID(): string {
  // Use the existing secure UUID generation from utils
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  // Fallback to secure random bytes
  const bytes = getRandomBytes(16)
  bytes[6] = (bytes[6]! & 0x0f) | 0x40 // Version 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80 // Variant 10

  const hex = Array.from(bytes, (byte: number) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * Generates a secure token for authentication/authorization
 * @param length - Token length in bytes (default: 32)
 * @returns Base64url encoded token
 */
export function secureToken(length = 32): string {
  const bytes = getRandomBytes(length)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Securely selects a random element from an array
 * @param array - Array to select from
 * @returns Random element or undefined if array is empty
 */
export function secureRandomElement<T>(array: readonly T[]): T | undefined {
  if (array.length === 0) {
    return undefined
  }
  const index = secureRandomInt(array.length)
  return array[index]
}

/**
 * Securely shuffles an array using Fisher-Yates algorithm
 * @param array - Array to shuffle (creates a copy)
 * @returns New shuffled array
 */
export function secureShuffle<T>(array: readonly T[]): T[] {
  if (array.length === 0) {
    return []
  }

  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1)
    ;[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!]
  }
  return shuffled
}

/**
 * Generates a secure random number in a range
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @returns Secure random number in range
 */
export function secureRandomInRange(min: number, max: number): number {
  if (min > max) {
    throw new Error('Min must be less than or equal to max')
  }
  return secureRandomIntRange(min, max)
}

/**
 * Generates a secure timestamp-based ID
 * @param prefix - Optional prefix for the ID
 * @returns Secure ID with timestamp
 */
export function secureTimestampId(prefix = 'id'): string {
  const timestamp = Date.now().toString(36)
  const randomPart = secureRandomString(8)
  return `${prefix}_${timestamp}_${randomPart}`
}

/**
 * Generates a secure random float between 0 and 1
 * @returns Secure random float [0, 1)
 */
export function secureRandomFloat(): number {
  const bytes = getRandomBytes(4)
  const uint32 = new DataView(bytes.buffer).getUint32(0, false)
  return uint32 / 0xffffffff
}

/**
 * Securely selects multiple random elements from an array
 * @param array - Array to select from
 * @param count - Number of elements to select
 * @returns Array of selected elements
 */
export function secureRandomSubset<T>(array: readonly T[], count: number): T[] {
  if (count >= array.length) {
    return [...array]
  }

  if (count <= 0) {
    return []
  }

  const shuffled = secureShuffle(array)
  return shuffled.slice(0, count)
}

/**
 * Generates a secure random hexadecimal string
 * @param length - Length in bytes (each byte = 2 hex chars)
 * @returns Hexadecimal string
 */
export function secureRandomHex(length = 16): string {
  const bytes = getRandomBytes(length)
  return Array.from(bytes, (byte: number) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}
