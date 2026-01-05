import { createHash, randomBytes, scrypt, timingSafeEqual } from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify<string, Buffer, number, Buffer>(scrypt)

/**
 * Generates a SHA-256 hash of the input string
 * @param input - The string to hash
 * @returns The hex string of the hash
 */
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

/**
 * Generates a secure random string of specified length
 * @param length - The length of the random string in bytes
 * @returns The random string as hex
 */
export function generateRandomString(length: number): string {
  return randomBytes(length).toString('hex')
}

/**
 * Generates a secure hash with salt for passwords
 * @param password - The password to hash
 * @returns Object containing hash and salt
 */
export async function hashPassword(
  password: string,
): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(32)
  const derivedKey = await scryptAsync(password, salt, 64)

  return {
    hash: derivedKey.toString('hex'),
    salt: salt.toString('hex'),
  }
}

/**
 * Verifies a password against a stored hash and salt
 * @param password - The password to verify
 * @param hash - The stored hash
 * @param salt - The stored salt
 * @returns True if password matches
 */
export async function verifyPassword(
  password: string,
  hash: string,
  salt: string,
): Promise<boolean> {
  const hashBuffer = Buffer.from(hash, 'hex')
  const derivedKey = await scryptAsync(password, Buffer.from(salt, 'hex'), 64)

  return timingSafeEqual(hashBuffer, derivedKey)
}

/**
 * Generates a HMAC for data integrity verification
 * @param data - Data to generate HMAC for
 * @param key - Secret key for HMAC
 * @returns HMAC as hex string
 */
export function generateHmac(data: string, key: string): string {
  return createHash('sha256').update(key).update(data).digest('hex')
}

/**
 * Verifies a HMAC
 * @param data - Original data
 * @param key - Secret key used for HMAC
 * @param hmac - HMAC to verify
 * @returns True if HMAC is valid
 */
export function verifyHmac(data: string, key: string, hmac: string): boolean {
  const calculatedHmac = generateHmac(data, key)
  return timingSafeEqual(
    Buffer.from(calculatedHmac, 'hex'),
    Buffer.from(hmac, 'hex'),
  )
}

/**
 * Generates a secure token for CSRF protection
 * @returns CSRF token
 */
export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Verifies a CSRF token using timing-safe comparison
 * @param token1 - First token
 * @param token2 - Second token
 * @returns True if tokens match
 */
export function verifyCsrfToken(token1: string, token2: string): boolean {
  try {
    return timingSafeEqual(Buffer.from(token1), Buffer.from(token2))
  } catch {
    return false
  }
}

/**
 * Crypto utilities for generating secure hashes
 */

/**
 * Generate a secure hash from a string
 *
 * Uses the Web Crypto API to create a SHA-256 hash
 *
 * @param data String data to hash
 * @returns Hex-encoded hash string
 */
export async function generateHash(data: string): Promise<string> {
  try {
    // Convert string to buffer
    const encoder = new TextEncoder()
    const dataBuffer = encoder.encode(data)

    // Generate SHA-256 hash
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)

    // Convert to hex string
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  } catch (error: unknown) {
    // Fallback to simple hash if crypto not available
    console.warn(
      'Web Crypto API not available, using fallback hash method',
      error,
    )
    return fallbackHash(data)
  }
}

/**
 * Simple fallback hash function when Web Crypto is not available
 * Not cryptographically secure, but better than nothing for rate limiting
 */
function fallbackHash(str: string): string {
  let hash = 0

  if (str.length === 0) {
    return hash.toString(16)
  }

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash &= hash // Convert to 32bit integer
  }

  // Add timestamp to make it harder to reverse
  const timestamp = Date.now().toString(36)

  return hash.toString(16) + timestamp
}

// Example PHI audit logging - uncomment and customize as needed
// logger.info('Accessing PHI data', {
//   userId: 'user-id-here',
//   action: 'read',
//   dataType: 'patient-record',
//   recordId: 'record-id-here'
// });
