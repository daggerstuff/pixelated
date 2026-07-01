/**
 * Crypto utilities including secure random generation and ID generation
 */

// ============================================================================
// Error messages
// ============================================================================

export const CRYPTO_ERRORS = {
  NOT_NODE_ENVIRONMENT: 'Not in Node.js environment',
  NODE_CRYPTO_UNAVAILABLE: 'Node crypto module not available',
  CRYPTO_UNSUPPORTED:
    'Cryptographically secure random number generation is not supported in this environment. Math.random() fallback has been removed for security. Please run in a secure context (browser with crypto.getRandomValues or Node.js with crypto.randomBytes).',
  BYTES_TO_UINT32BE_SHORT: 'bytesToUint32BE: input must have at least 4 bytes',
  INVALID_RANDOM_INT_PARAM: 'maxExclusive must be positive integer',
  GENERATE_UNIQUE_ID_UNEXPECTED_BYTE:
    'generateUniqueId: Unexpected undefined byte',
  GENERATE_SHORT_ID_UNEXPECTED_BYTE:
    'generateShortId: Unexpected undefined byte',
  RANDOM_INT_MIN_MAX: 'min must be <= max',
}

// ============================================================================
// Environment detection
// ============================================================================

/**
 * Checks if current environment is browser/client-side
 */
export function isBrowserEnvironment(): boolean {
  return typeof window !== 'undefined'
}

/**
 * Checks if current environment is Node.js
 */
function isNodeEnvironment(): boolean {
  return !isBrowserEnvironment() && typeof process !== 'undefined'
}

// Helper to synchronously require Node modules in Node-only environments without
// triggering static bundlers or TypeScript/ESLint `no-require-imports` errors.
export function tryRequireNode(moduleName: string): unknown {
  try {
    if (isNodeEnvironment()) {
      const globalRequire = globalThis as { require?: (id: string) => unknown }
      if (typeof globalRequire.require === 'function') {
        return globalRequire.require(moduleName)
      }
      const module = (globalThis as Record<string, unknown>)[moduleName]
      if (module) return module
    }
  } catch {
    // ignore
  }
  return undefined
}

/**
 * Type guard for checking if value is a non-null object
 */
export function isNonNullObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

// ============================================================================
// Crypto internals
// ============================================================================

const nodeCrypto = tryRequireNode('crypto')
const nodeCryptoRandomBytes =
  isNonNullObject(nodeCrypto) && typeof nodeCrypto['randomBytes'] === 'function'
    ? (nodeCrypto['randomBytes'] as (size: number) => Uint8Array)
    : undefined

/**
 * Gets random bytes using Web Crypto API (browser) or Node.js crypto (server)
 * @param size - Number of bytes to generate
 * @returns Uint8Array of random bytes
 */
export function getRandomBytes(size: number): Uint8Array {
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(size)
    window.crypto.getRandomValues(bytes)
    return bytes
  } else {
    try {
      if (nodeCryptoRandomBytes) {
        return nodeCryptoRandomBytes(size)
      }
      throw new Error(CRYPTO_ERRORS.NODE_CRYPTO_UNAVAILABLE)
    } catch {
      throw new Error(CRYPTO_ERRORS.CRYPTO_UNSUPPORTED)
    }
  }
}

/**
 * Converts bytes to a 32-bit unsigned integer (big-endian)
 * @param bytes - Byte array (at least 4 bytes)
 * @returns 32-bit unsigned integer
 */
export function bytesToUint32BE(bytes: Uint8Array): number {
  if (bytes.length < 4) {
    throw new Error(CRYPTO_ERRORS.BYTES_TO_UINT32BE_SHORT)
  }
  return (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]
}

/**
 * Cryptographically secure random integer in [0, maxExclusive)
 * Uniform even for non-power-of-two upper bounds (no modulo bias).
 * Throws if maxExclusive < 1 or not integer.
 */
export function secureRandomInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive < 1) {
    throw new Error(CRYPTO_ERRORS.INVALID_RANDOM_INT_PARAM)
  }
  const maxUint32 = 0xffffffff
  const rangeLimit = Math.floor(maxUint32 / maxExclusive) * maxExclusive
  while (true) {
    const bytes = getRandomBytes(4)
    const randUint = bytesToUint32BE(bytes)
    if (randUint < rangeLimit) {
      return randUint % maxExclusive
    }
  }
}

/**
 * Generates a random integer between min and max (inclusive)
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Random integer
 */
export function randomInt(min: number, max: number): number {
  if (min > max) {
    throw new Error(CRYPTO_ERRORS.RANDOM_INT_MIN_MAX)
  }
  const range = max - min + 1
  const randomBuffer = getRandomBytes(4)
  const randUint = bytesToUint32BE(randomBuffer)
  return min + (randUint % range)
}

/**
 * Gets a random element from an array
 * @param array - Array to pick from
 * @returns Random element
 */
export function randomElement<T>(array: readonly T[]): T | undefined {
  if (array.length === 0) {
    return undefined
  }
  const idx = secureRandomInt(array.length)
  return array[idx]
}

// ============================================================================
// ID generation
// ============================================================================

/**
 * Generates a unique ID using crypto.randomUUID()
 * @returns A unique UUID string
 */
export function generateUniqueId(): string {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID()
  } else if (
    typeof (globalThis as { crypto?: unknown }).crypto !== 'undefined' &&
    typeof (globalThis as { crypto?: { randomUUID?: unknown } }).crypto
      ?.randomUUID === 'function'
  ) {
    return (
      globalThis as { crypto: { randomUUID: () => string } }
    ).crypto.randomUUID()
  } else {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      function (c) {
        const bytes = getRandomBytes(1)
        const byte = bytes[0]
        if (byte === undefined) {
          throw new Error(CRYPTO_ERRORS.GENERATE_UNIQUE_ID_UNEXPECTED_BYTE)
        }
        const r = byte & 0xf
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
      },
    )
  }
}

/**
 * Generates a simple unique ID using timestamp and random number
 * @param prefix - Optional prefix for the ID
 * @returns A unique ID string
 */
export function generateSimpleId(prefix = 'id'): string {
  const bytes = getRandomBytes(4)
  const randPart = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  return `${prefix}_${Date.now()}_${randPart}`
}

/**
 * Generates a nanoid-style short ID
 * @param length - Length of the ID (default: 8)
 * @returns A short unique ID
 */
export function generateShortId(length = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  const bytes = getRandomBytes(length)
  for (let i = 0; i < length; i++) {
    const byte = bytes[i]
    if (byte === undefined) {
      throw new Error(CRYPTO_ERRORS.GENERATE_SHORT_ID_UNEXPECTED_BYTE)
    }
    result += chars.charAt(byte % chars.length)
  }
  return result
}

// Re-export higher-level crypto system from the refactored directory module
export type { CryptoSystem } from './crypto/types'
export type { CryptoSystemOptions } from './crypto/index'
export { createCryptoSystem } from './crypto/index'
