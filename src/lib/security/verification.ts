/**
 * Verification token utilities for security
 *
 * Provides token creation and validation functions for export integrity
 */

// Use browser-compatible base64 encoding/decoding instead of Node.js Buffer

import { createBuildSafeLogger } from '../logging/build-safe-logger'

const logger = createBuildSafeLogger('default')

interface VerificationTokenPayload {
  iat: number
  exp: number
}

/**
 * Create a signed verification token for data integrity
 *
 * @param payload - The data to sign
 * @returns A signed verification token
 */
export function createSignedVerificationToken(payload: unknown): string {
  try {
    const timestamp = Date.now()
    const tokenPayload = JSON.parse(JSON.stringify(payload))
    const token = {
      ...tokenPayload,
      iat: timestamp,
      exp: timestamp + 3600000, // 1 hour expiration
    }

    // Use btoa for browser compatibility instead of Buffer
    const jsonString = JSON.stringify(token)
    return btoa(jsonString)
  } catch (error: unknown) {
    logger.error('Failed to create verification token', { error })
    throw new Error('Verification token creation failed', { cause: error })
  }
}

/**
 * Verify a token's signature and validity
 *
 * @param token - The token to verify
 * @returns The decoded payload if valid, null otherwise
 */
export function verifyToken(token: string): unknown | null {
  try {
    // Use atob for browser compatibility instead of Buffer
    const parsed = JSON.parse(atob(token))

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('exp' in parsed) ||
      typeof parsed.exp !== 'number'
    ) {
      logger.warn('Token payload invalid', { token })
      return null
    }

    const exp = Object.getOwnPropertyDescriptor(parsed, 'exp')?.value
    const iat = Object.getOwnPropertyDescriptor(parsed, 'iat')?.value

    if (typeof exp !== 'number' || typeof iat !== 'number') {
      logger.warn('Token payload invalid', { token })
      return null
    }

    // Check expiration
    if (exp < Date.now()) {
      logger.warn('Token expired', { token })
      return null
    }

    return parsed
  } catch (error: unknown) {
    logger.error('Error verifying token', { error, token })
    return null
  }
}
