import { Buffer } from 'node:buffer'
import { webcrypto } from 'node:crypto'
import process from 'node:process'

interface EncryptedData {
  iv: string
  data: string
  tag: string
  salt: string
}

const ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 32 // 256 bits
const TAG_LENGTH = 16
const SALT_LENGTH = 32
const IV_LENGTH = 12 // 96 bits for GCM
const MIN_PASSWORD_LENGTH = 32
const ITERATIONS = 100000

async function deriveKey(salt: Uint8Array): Promise<CryptoKey> {
  if (!process.env['ENCRYPTION_KEY']) {
    throw new Error('ENCRYPTION_KEY environment variable is required')
  }

  if (process.env['ENCRYPTION_KEY'].length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `Encryption key must be at least ${MIN_PASSWORD_LENGTH} characters long`,
    )
  }

  // Convert password to key material
  const encoder = new TextEncoder()
  const keyMaterial = await webcrypto.subtle.importKey(
    'raw',
    encoder.encode(process.env['ENCRYPTION_KEY']),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey'],
  )

  // Derive the actual encryption key
  return webcrypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

function validateInput(data: unknown): void {
  if (data === undefined || data === null) {
    throw new Error('Data to encrypt cannot be null or undefined')
  }

  const serialized = JSON.stringify(data)
  if (serialized.length > 1024 * 1024) {
    // 1MB limit
    throw new Error('Data exceeds maximum size limit')
  }
}

async function generateSecureRandomBytes(length: number): Promise<Uint8Array> {
  return webcrypto.getRandomValues(new Uint8Array(length))
}

export async function encrypt(data: unknown): Promise<string> {
  try {
    validateInput(data)

    // Generate random salt and IV
    const salt = await generateSecureRandomBytes(SALT_LENGTH)
    const iv = await generateSecureRandomBytes(IV_LENGTH)

    // Derive encryption key
    const key = await deriveKey(salt)

    // Prepare data
    const encoder = new TextEncoder()
    const encodedData = encoder.encode(JSON.stringify(data))

    // Encrypt
    const encrypted = await webcrypto.subtle.encrypt(
      {
        name: ALGORITHM,
        iv,
        tagLength: TAG_LENGTH * 8, // Convert bytes to bits
      },
      key,
      encodedData,
    )

    // Split the encrypted data and auth tag
    const encryptedBytes = new Uint8Array(encrypted)
    const encryptedData = encryptedBytes.slice(
      0,
      encrypted.byteLength - TAG_LENGTH,
    )
    const tag = encryptedBytes.slice(encrypted.byteLength - TAG_LENGTH)

    // Convert to base64 for storage/transmission
    const result: EncryptedData = {
      iv: Buffer.from(Array.from(iv)).toString('base64'),
      data: Buffer.from(Array.from(encryptedData)).toString('base64'),
      tag: Buffer.from(Array.from(tag)).toString('base64'),
      salt: Buffer.from(Array.from(salt)).toString('base64'),
    }

    return JSON.stringify(result)
  } catch (error: unknown) {
    throw new Error(`Encryption failed: ${(error as Error).message}`, {
      cause: error,
    })
  }
}

export async function decrypt(encryptedDataStr: string): Promise<unknown> {
  try {
    const { iv, data, tag, salt } = JSON.parse(
      encryptedDataStr,
    ) as EncryptedData

    // Convert base64 strings back to buffers
    const ivArray = Buffer.from(iv, 'base64')
    const dataArray = Buffer.from(data, 'base64')
    const tagArray = Buffer.from(tag, 'base64')
    const saltArray = Buffer.from(salt, 'base64')

    // Validate lengths
    if (ivArray.length !== IV_LENGTH) {
      throw new Error('Invalid IV length')
    }
    if (tagArray.length !== TAG_LENGTH) {
      throw new Error('Invalid auth tag length')
    }
    if (saltArray.length !== SALT_LENGTH) {
      throw new Error('Invalid salt length')
    }

    // Derive decryption key
    const key = await deriveKey(new Uint8Array(saltArray))

    // Combine encrypted data and tag
    const encryptedWithTag = new Uint8Array(dataArray.length + tagArray.length)
    encryptedWithTag.set(new Uint8Array(dataArray))
    encryptedWithTag.set(new Uint8Array(tagArray), dataArray.length)

    // Decrypt
    const decrypted = await webcrypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: new Uint8Array(ivArray),
        tagLength: TAG_LENGTH * 8,
      },
      key,
      encryptedWithTag,
    )

    // Decode and parse result
    const decoder = new TextDecoder()
    return JSON.parse(decoder.decode(decrypted))
  } catch (error: unknown) {
    throw new Error(`Decryption failed: ${(error as Error).message}`, {
      cause: error,
    })
  }
}

// Utility method to generate a secure encryption key
export function generateSecureKey(): string {
  const key = webcrypto.getRandomValues(new Uint8Array(KEY_LENGTH))
  return Buffer.from(Array.from(key)).toString('base64')
}
