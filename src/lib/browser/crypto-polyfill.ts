/**
 * Browser-compatible crypto polyfill
 *
 * This provides browser-safe implementations of common Node.js crypto functions.
 * It uses the Web Crypto API in browsers, with some fallbacks for older browsers.
 */

import { createBuildSafeLogger } from '../logging/build-safe-logger'

const logger = createBuildSafeLogger('crypto-polyfill')

/**
 * Simple detection of browser environment
 */
export const isBrowser =
  typeof window !== 'undefined' && typeof document !== 'undefined'

/**
 * Browser-safe buffer utilities without using Node.js Buffer
 */
export const browserBuffer = {
  from: (
    data: string | ArrayBuffer | Uint8Array,
    encoding?: string,
  ): Uint8Array => {
    // Browser-only implementation without relying on Node's Buffer
    if (typeof data === 'string') {
      if (encoding === 'hex') {
        // Handle hex encoding separately
        if (data.length % 2 !== 0) {
          throw new Error('Invalid hex string length')
        }
        const bytes = new Uint8Array(data.length / 2)
        for (let i = 0; i < data.length; i += 2) {
          bytes[i / 2] = parseInt(data.substring(i, i + 2), 16)
        }
        return bytes
      } else if (encoding === 'base64') {
        // Handle base64 encoding
        const binaryString = atob(data)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        return bytes
      } else {
        // Default to UTF-8 encoding for strings
        return new TextEncoder().encode(data)
      }
    } else if (data instanceof ArrayBuffer) {
      return new Uint8Array(data)
    } else {
      return data
    }
  },

  // Additional utility methods
  toString: (data: Uint8Array, encoding: string = 'utf8'): string => {
    if (encoding === 'hex') {
      return Array.from(data)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    } else if (encoding === 'base64') {
      // Convert to base64
      const binary = Array.from(data)
        .map((b) => String.fromCharCode(b))
        .join('')
      return btoa(binary)
    } else {
      // Default to UTF-8
      return new TextDecoder().decode(data)
    }
  },

  concat: (arrays: Uint8Array[]): Uint8Array => {
    // Calculate total length
    const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0)

    // Create new array and copy values
    const result = new Uint8Array(totalLength)
    let offset = 0
    for (const arr of arrays) {
      result.set(arr, offset)
      offset += arr.length
    }

    return result
  },
}

/**
 * Helper function to convert ArrayBuffer to hex string
 */
function buf2hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Generate random bytes
 */
export async function randomBytes(size: number): Promise<Uint8Array> {
  if (isBrowser) {
    // Use Web Crypto API
    return window.crypto.getRandomValues(new Uint8Array(size))
  } else {
    // This code should never execute in browser
    throw new Error('Node.js crypto should be used in Node environment')
  }
}

/**
 * Create a hash using the specified algorithm
 */
interface HashInterface {
  update: (input: string | Uint8Array) => HashInterface
  digest: (encoding?: string) => Promise<string | Uint8Array>
}

export async function createHash(algorithm: string): Promise<HashInterface> {
  if (isBrowser) {
    // Map Node.js hash algorithm names to Web Crypto API names
    const algorithmMap: Record<string, string> = {
      md5: 'MD5',
      sha1: 'SHA-1',
      sha256: 'SHA-256',
      sha384: 'SHA-384',
      sha512: 'SHA-512',
    }

    const webCryptoAlgorithm =
      algorithmMap[algorithm.toLowerCase()] || 'SHA-256'

    let data: Uint8Array | null = null

    const hashObj: HashInterface = {
      update: (input: string | Uint8Array): HashInterface => {
        // Convert input to Uint8Array
        if (typeof input === 'string') {
          data = new TextEncoder().encode(input)
        } else {
          data = input instanceof Uint8Array ? input : new Uint8Array(input)
        }
        return hashObj
      },
      digest: async (encoding?: string): Promise<string | Uint8Array> => {
        if (!data) {
          throw new Error('No data provided to hash')
        }

        try {
          const hashBuffer = await window.crypto.subtle.digest(
            webCryptoAlgorithm,
            data as BufferSource,
          )

          // Return digest in requested format
          if (encoding === 'hex') {
            return buf2hex(hashBuffer)
          } else if (encoding === 'base64') {
            return btoa(
              String.fromCharCode.apply(
                null,
                Array.from(new Uint8Array(hashBuffer)),
              ),
            )
          } else {
            // Binary by default
            return new Uint8Array(hashBuffer)
          }
        } catch (error: unknown) {
          logger.error(
            `Hash creation failed: ${error instanceof Error ? String(error) : String(error)}`,
          )
          throw error
        }
      },
    }

    return hashObj
  } else {
    // This code should never execute in browser
    throw new Error('Node.js crypto should be used in Node environment')
  }
}

/**
 * Encrypt data using AES-GCM
 */
export async function encrypt(
  data: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array,
): Promise<Uint8Array> {
  if (isBrowser) {
    try {
      // Import the key
      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        key as BufferSource,
        {
          name: 'AES-GCM',
          length: key.length * 8,
        },
        false,
        ['encrypt'],
      )

      // Encrypt the data
      const encryptedBuffer = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv as BufferSource,
          tagLength: 128,
        },
        cryptoKey,
        data as BufferSource,
      )

      return new Uint8Array(encryptedBuffer)
    } catch (error: unknown) {
      logger.error(
        `Encryption failed: ${error instanceof Error ? String(error) : String(error)}`,
      )
      throw error
    }
  } else {
    // This code should never execute in browser
    throw new Error('Node.js crypto should be used in Node environment')
  }
}

/**
 * Decrypt data using AES-GCM
 */
export async function decrypt(
  encryptedData: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array,
): Promise<Uint8Array> {
  if (isBrowser) {
    try {
      // Import the key
      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        key as BufferSource,
        {
          name: 'AES-GCM',
          length: key.length * 8,
        },
        false,
        ['decrypt'],
      )

      // Decrypt the data
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv as BufferSource,
          tagLength: 128,
        },
        cryptoKey,
        encryptedData as BufferSource,
      )

      return new Uint8Array(decryptedBuffer)
    } catch (error: unknown) {
      logger.error(
        `Decryption failed: ${error instanceof Error ? String(error) : String(error)}`,
      )
      throw error
    }
  } else {
    // This code should never execute in browser
    throw new Error('Node.js crypto should be used in Node environment')
  }
}

export default {
  randomBytes,
  createHash,
  encrypt,
  decrypt,
  browserBuffer,
  isBrowser,
}
