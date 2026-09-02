/**
 * Security Module for Therapy Chat System
 *
 * Provides encryption, Fully Homomorphic Encryption (FHE) integration, and other
 * security features required for HIPAA compliance and beyond.
 *
 * This file acts as a central facade for the specialized security modules
 * in the security/ directory while maintaining backwards compatibility.
 */

import CryptoJS from 'crypto-js'
import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

import { secureRandomHex } from './security/random'

/**
 * Constant-time string comparison to prevent timing attacks on signatures.
 * Works in both browser and Node (no node:crypto dependency needed).
 * Returns true iff the strings are byte-for-byte identical.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

/**
 * Minimal typed view of the crypto-js surface used by this module. The ambient
 * `declare module 'crypto-js'` in src/types/crypto-js.d.ts leaves every export
 * typed as `any`, which makes `no-unsafe-call`/`no-unsafe-return` fire on every
 * chained `.toString(...)`. Asserting into this adapter gives `createSignature`
 * a real signature so the result is `string` rather than `any`.
 */
interface CryptoJsAdapter {
  HmacSHA256: (
    message: string,
    key: string,
  ) => { toString: (encoder: unknown) => string }
  enc: { Base64: unknown }
}
const crypto = CryptoJS as unknown as CryptoJsAdapter

// Re-export all event constants so existing consumers can keep importing from this module
export {
  AuthEvents,
  UserEvents,
  BulkOperationEvents,
  SessionEvents,
  AuditEvents,
  SystemEvents,
  RoleTransitionEvents,
  UserRetentionEvents,
  SecurityEventType,
} from './security-events'
import type { SecurityEventTypeValue } from './security-events'
export type { SecurityEventTypeValue }

// Re-export security monitoring functions from the new directory-based structure
export {
  initializeSecurity,
  getSecurityMonitoring,
  logSecurityEvent,
  initializeEncryption,
  encryptMessage,
  decryptMessage,
  processEncryptedMessage,
} from './security/index'

// Re-export secure random utilities
export {
  secureRandomString,
  secureUUID,
  secureToken,
  secureRandomElement,
  secureShuffle,
  secureRandomInRange,
  secureTimestampId,
  secureRandomFloat,
  secureRandomSubset,
  secureRandomHex,
} from './security/random'

// Re-export verification utilities
export {
  createSignedVerificationToken,
  verifyToken as verifyVerificationToken,
} from './security/verification'

// Re-export encryption manager
export { encryptionManager } from './security/encryptionManager'

// Security-related atoms (maintained for backwards compatibility)
export const encryptionInitializedAtom = atom(false)
export const encryptionKeysAtom = atomWithStorage('chatEncryptionKeys', null)
export const securityLevelAtom = atomWithStorage('chatSecurityLevel', 'medium')

/**
 * Security Error class for consistent error handling across the application
 */
export class SecurityError extends Error {
  constructor(
    message: string,
    public code: string = 'SECURITY_ERROR',
    public details?: any,
  ) {
    super(message)
    this.name = 'SecurityError'
  }
}

// Secret key for signatures - ONLY available in server-side environments
// Initialized via setSecretKey() or from environment variable
let secretKey: string | undefined = undefined

/**
 * Initialize the secret key for cryptographic operations.
 * Must be called before any signing operations in server-side entry points.
 * @param key - The secret key to use for HMAC operations
 */
import { createBuildSafeLogger } from './logging/build-safe-logger'

const securityLogger = createBuildSafeLogger('security')

export function setSecretKey(key: string): void {
  if (typeof window !== 'undefined') {
    securityLogger.warn(
      'Security Error: Attempted to set secret key in browser environment.',
    )
    return
  }
  secretKey = key.trim()
}

/**
 * Get the secret key, falling back to environment variable if not set.
 * @internal - Never expose this key to the client. Signing must occur on the server.
 */
export function requireSecretKey(): string {
  // Use pre-initialized key if available (set via setSecretKey())
  if (secretKey) {
    return secretKey
  }

  // Fall back to environment variable if in Node environment
  const key = process?.env
    ? (process.env['SECRET_KEY'] ?? process.env['JWT_SECRET'])
    : undefined

  if (!key) {
    throw new SecurityError(
      'SECURITY_CONFIG_ERROR: SECRET_KEY is missing or unavailable. ' +
        'Call setSecretKey() in your application entry point or ensure SECRET_KEY ' +
        'is set in your server-side environment. Cryptographic signing is restricted ' +
        'to server-side only to prevent secret leakage.',
      'UNINITIALIZED_SECRET_KEY',
    )
  }
  return key.trim()
}

/**
 * Create a cryptographic signature for a payload.
 * Useful for ensuring data integrity of client-provided state.
 */
export function createSignature(payload: unknown): string {
  const key = requireSecretKey()
  const message =
    typeof payload === 'string' ? payload : JSON.stringify(payload)
  return crypto.HmacSHA256(message, key).toString(crypto.enc.Base64)
}

/**
 * Verify a signature for a given payload.
 */
export function verifySignature(payload: unknown, signature: string): boolean {
  try {
    const expected = createSignature(payload)
    return constantTimeEqual(signature, expected)
  } catch {
    return false
  }
}

/**
 * Generate a secure random session key or token.
 */
export function generateSecureSessionKey(): string {
  return secureRandomHex(32)
}

/**
 * Encrypt sensitive data using the unified encryption service.
 */
export async function encryptSensitiveData(data: string): Promise<string> {
  const { encrypt } = await import('./encryption')
  return await encrypt(data)
}

/**
 * Decrypt sensitive data using the unified encryption service.
 */
export async function decryptSensitiveData(
  encryptedData: string,
): Promise<string> {
  const { decrypt } = await import('./encryption')
  return (await decrypt(encryptedData)) as string
}

/**
 * Create a secure, signed token for data.
 * Useful for state that needs to be passed between client and server.
 */
export function createSecureToken(
  payload: Record<string, unknown>,
  expiresIn: number = 3600,
): string {
  const tokenData = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresIn,
  }

  const dataString = JSON.stringify(tokenData)
  // Use Base64 encoding for the payload
  const encodedData =
    typeof window === 'undefined'
      ? Buffer.from(dataString, 'utf-8').toString('base64')
      : btoa(dataString)

  const signature = createSignature(encodedData)
  return `${encodedData}.${signature}`
}

/**
 * Verify and decode a secure token.
 */
export function verifySecureToken(token: string): unknown {
  try {
    const parts = token.split('.')
    if (parts.length !== 2) return null

    const [encodedData, signature] = parts

    // Verify signature first
    const expectedSignature = createSignature(encodedData)
    if (!constantTimeEqual(signature, expectedSignature)) return null

    // Decode and parse the data
    const dataString =
      typeof window === 'undefined'
        ? Buffer.from(encodedData, 'base64').toString('utf-8')
        : atob(encodedData)

    const payload = JSON.parse(dataString) as Record<string, unknown>

    // Check expiration
    const now = Math.floor(Date.now() / 1000)
    const exp = payload['exp']
    if (typeof exp === 'number' && exp < now) {
      return null
    }

    return payload
  } catch {
    return null
  }
}
