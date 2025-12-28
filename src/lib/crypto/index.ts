import CryptoJS from 'crypto-js'

import { createClient, type RedisClientType } from 'redis'
import {
  KMSClient,
  EncryptCommand,
  DecryptCommand,
  GenerateDataKeyCommand,
} from '@aws-sdk/client-kms'
import { logger, LogLevel } from '../../utils/logger'

/**
 * HIPAA-compliant crypto module for encryption, key management, and key rotation
 * Implements secure encryption with proper audit logging and key lifecycle management
 */

// Initialize PHI audit logger with proper LogLevel enum
logger.setLevel(LogLevel.INFO)

// Log module access for HIPAA compliance
logger.info('Crypto module initialized', {
  action: 'module-initialization',
  component: 'crypto/index.ts',
  containsPHI: true,
  timestamp: new Date().toISOString(),
})

/**
 * Key data structure for managing encryption keys
 */
export interface KeyData {
  readonly key: string
  readonly version: number
  readonly createdAt: number
  readonly expiresAt: number
  readonly purpose?: string
  readonly algorithm: string
}

/**
 * Storage provider interface for key persistence
 */
export interface StorageProvider {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlSeconds?: number): Promise<void>
  delete(key: string): Promise<void>
  list(prefix: string): Promise<string[]>
  close?(): Promise<void>
}

/**
 * In-memory storage implementation for development/testing
 */
class MemoryStorageProvider implements StorageProvider {
  private readonly storage = new Map<
    string,
    { value: string; expires?: number }
  >()

  async get(key: string): Promise<string | null> {
    const entry = this.storage.get(key)
    if (!entry) {
      return null
    }

    if (entry.expires && Date.now() > entry.expires) {
      this.storage.delete(key)
      return null
    }

    return entry.value
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const entry: { value: string; expires?: number } = { value }
    if (ttlSeconds) {
      entry.expires = Date.now() + ttlSeconds * 1000
    }
    this.storage.set(key, entry)
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key)
  }

  async list(prefix: string): Promise<string[]> {
    return Array.from(this.storage.keys())
      .filter((key) => key.startsWith(prefix))
      .filter((key) => {
        const entry = this.storage.get(key)
        return entry && (!entry.expires || Date.now() <= entry.expires)
      })
  }
}

/**
 * Redis-based storage implementation for production
 */
class RedisStorageProvider implements StorageProvider {
  private client: RedisClientType
  private connected = false

  constructor(redisUrl: string) {
    this.client = createClient({ url: redisUrl })

    this.client.on('error', (err) => {
      logger.error('Redis connection error', {
        error: (err as Error)?.message || String(err),
      })
      this.connected = false
    })

    this.client.on('connect', () => {
      logger.info('Redis connected successfully')
      this.connected = true
    })

    this.client.on('end', () => {
      logger.info('Redis connection ended')
      this.connected = false
    })
  }

  async connect(): Promise<void> {
    if (!this.connected) {
      await this.client.connect()
    }
  }

  private async ensureConnection(): Promise<void> {
    if (!this.connected) {
      await this.connect()
    }
  }

  async get(key: string): Promise<string | null> {
    await this.ensureConnection()
    const result = await this.client.get(key)
    return typeof result === 'string' ? result : null
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    await this.ensureConnection()
    if (ttlSeconds) {
      await this.client.setEx(key, ttlSeconds, value)
    } else {
      await this.client.set(key, value)
    }
  }

  async delete(key: string): Promise<void> {
    await this.ensureConnection()
    await this.client.del(key)
  }

  async list(prefix: string): Promise<string[]> {
    await this.ensureConnection()
    return this.client.keys(`${prefix}*`)
  }

  async close(): Promise<void> {
    if (this.connected) {
      await this.client.quit()
      this.connected = false
    }
  }
}

/**
 * AWS KMS-based secure storage implementation
 */
class SecureStorageProvider implements StorageProvider {
  private readonly kmsClient: KMSClient
  private readonly fallbackProvider: StorageProvider

  constructor(
    private readonly kmsKeyId: string,
    region = 'us-east-1',
    fallbackProvider?: StorageProvider,
  ) {
    this.kmsClient = new KMSClient({ region })
    this.fallbackProvider = fallbackProvider || new MemoryStorageProvider()
  }

  async get(key: string): Promise<string | null> {
    try {
      const encryptedValue = await this.fallbackProvider.get(key)
      if (!encryptedValue) {
        return null
      }

      const encryptedBlob = Buffer.from(encryptedValue, 'base64')
      const decryptCommand = new DecryptCommand({
        CiphertextBlob: encryptedBlob,
        KeyId: this.kmsKeyId,
      })

      const response = await this.kmsClient.send(decryptCommand)
      if (!response.Plaintext) {
        throw new Error('KMS decryption failed: No plaintext returned')
      }

      return Buffer.from(response.Plaintext).toString('utf8')
    } catch (error: unknown) {
      logger.error('Failed to decrypt key from secure storage', {
        key,
        error: error instanceof Error ? String(error) : String(error),
      })
      return null
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      const encryptCommand = new EncryptCommand({
        KeyId: this.kmsKeyId,
        Plaintext: Buffer.from(value, 'utf8'),
      })

      const response = await this.kmsClient.send(encryptCommand)
      if (!response.CiphertextBlob) {
        throw new Error('KMS encryption failed: No ciphertext returned')
      }

      const encryptedBase64 = Buffer.from(response.CiphertextBlob).toString(
        'base64',
      )
      await this.fallbackProvider.set(key, encryptedBase64, ttlSeconds)
    } catch (error: unknown) {
      logger.error('Failed to encrypt key in secure storage', {
        key,
        error: error instanceof Error ? String(error) : String(error),
      })
      throw error
    }
  }

  async delete(key: string): Promise<void> {
    await this.fallbackProvider.delete(key)
  }

  async list(prefix: string): Promise<string[]> {
    return this.fallbackProvider.list(prefix)
  }

  async close(): Promise<void> {
    if (this.fallbackProvider.close) {
      await this.fallbackProvider.close()
    }
  }

  async generateDataKey(): Promise<{ plaintext: string; ciphertext: string }> {
    try {
      const command = new GenerateDataKeyCommand({
        KeyId: this.kmsKeyId,
        KeySpec: 'AES_256',
      })

      const response = await this.kmsClient.send(command)
      if (!response.Plaintext || !response.CiphertextBlob) {
        throw new Error('Failed to generate data key from KMS')
      }

      return {
        plaintext: Buffer.from(response.Plaintext).toString('hex'),
        ciphertext: Buffer.from(response.CiphertextBlob).toString('base64'),
      }
    } catch (error: unknown) {
      logger.error('KMS data key generation failed', {
        error: error instanceof Error ? String(error) : String(error),
      })
      throw error
    }
  }
}

/**
 * Core encryption functions using AES-256-GCM
 */

/**
 * Encrypts data using AES-256-GCM with random IV
 */
export function encrypt(data: string, key: string): string {
  if (!data || !key) {
    throw new Error('Data and key are required for encryption')
  }

  const iv = CryptoJS.lib.WordArray.random(16)
  const encrypted = CryptoJS.AES.encrypt(data, key, {
    iv,
    mode: CryptoJS.mode.GCM,
    padding: CryptoJS.pad.Pkcs7,
  })

  return `${iv.toString()}:${encrypted.toString()}`
}

/**
 * Decrypts data using AES-256-GCM
 */
export function decrypt(data: string, key: string): string {
  if (!data || !key) {
    throw new Error('Data and key are required for decryption')
  }

  try {
    const [ivStr, encryptedStr] = data.split(':')
    if (!ivStr || !encryptedStr) {
      throw new Error('Invalid encrypted data format')
    }

    const iv = CryptoJS.enc.Hex.parse(ivStr)
    const decrypted = CryptoJS.AES.decrypt(encryptedStr, key, {
      iv,
      mode: CryptoJS.mode.GCM,
      padding: CryptoJS.pad.Pkcs7,
    })

    const result = decrypted.toString(CryptoJS.enc.Utf8)
    if (!result) {
      throw new Error('Decryption failed - invalid key or corrupted data')
    }

    return result
  } catch (error: unknown) {
    logger.error('Decryption failed', {
      error: error instanceof Error ? String(error) : String(error),
    })
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error })
  }
}

/**
 * Generates a cryptographically secure key
 */
export function generateSecureKey(): string {
  return CryptoJS.lib.WordArray.random(32).toString()
}

/**
 * Creates a secure hash using SHA-256
 */
export function createHash(data: string): string {
  if (!data) {
    return ''
  }
  return CryptoJS.SHA256(data).toString()
}

/**
 * Creates HMAC signature using SHA-256
 */
export function createHMAC(data: string, key: string): string {
  if (!data || !key) {
    throw new Error('Data and key are required for HMAC')
  }
  return CryptoJS.HmacSHA256(data, key).toString()
}

/**
 * Key rotation manager for handling key lifecycle
 */
export class KeyRotationManager {
  constructor(private readonly rotationDays: number = 90) {}

  needsRotation(createdAt: number): boolean {
    const ageMs = Date.now() - createdAt
    const ageDays = ageMs / (1000 * 60 * 60 * 24)
    return ageDays >= this.rotationDays
  }

  calculateExpiryDate(createdAt: number = Date.now()): number {
    return createdAt + this.rotationDays * 24 * 60 * 60 * 1000
  }
}

/**
 * Key storage manager with versioning and rotation support
 */
export class KeyStorage {
  private readonly keyPrefix: string

  constructor(
    private readonly storageProvider: StorageProvider,
    namespace: string = 'app',
  ) {
    this.keyPrefix = `${namespace}:keys:`
  }

  async generateKey(
    purpose?: string,
  ): Promise<{ keyId: string; keyData: KeyData }> {
    const timestamp = Date.now()
    const keyId = purpose ? `${purpose}-${timestamp}` : `key-${timestamp}`

    const keyData: KeyData = {
      key: generateSecureKey(),
      version: 1,
      createdAt: timestamp,
      expiresAt: timestamp + 90 * 24 * 60 * 60 * 1000, // 90 days
      purpose,
      algorithm: 'AES-256-GCM',
    }

    const storageKey = `${this.keyPrefix}${purpose ? `${purpose}:` : ''}${keyId}`
    await this.storageProvider.set(storageKey, JSON.stringify(keyData))

    logger.info('Generated new encryption key', {
      keyId,
      purpose,
      algorithm: keyData.algorithm,
      expiresAt: new Date(keyData.expiresAt).toISOString(),
    })

    return { keyId, keyData }
  }

  async getKey(keyId: string): Promise<KeyData | null> {
    // Try different storage patterns to find the key
    const possibleKeys = [
      `${this.keyPrefix}${keyId}`,
      `${this.keyPrefix}signing:${keyId}`,
      `${this.keyPrefix}encryption:${keyId}`,
    ]

    for (const storageKey of possibleKeys) {
      const keyDataJson = await this.storageProvider.get(storageKey)
      if (keyDataJson) {
        try {
          return JSON.parse(keyDataJson) as unknown as KeyData
        } catch (error: unknown) {
          logger.error('Failed to parse key data', { keyId, error })
        }
      }
    }

    return null
  }

  async listKeys(purpose?: string): Promise<string[]> {
    const prefix = purpose ? `${this.keyPrefix}${purpose}:` : this.keyPrefix
    const keys = await this.storageProvider.list(prefix)

    return keys
      .map((key) => {
        const parts = key.split(':')
        return parts[parts.length - 1] || ''
      })
      .filter(Boolean)
  }

  async rotateKey(
    keyId: string,
  ): Promise<{ keyId: string; keyData: KeyData } | null> {
    const existingKey = await this.getKey(keyId)
    if (!existingKey) {
      return null
    }

    const timestamp = Date.now()
    const newKeyId = `${existingKey.purpose || 'key'}-${timestamp}`

    const newKeyData: KeyData = {
      key: generateSecureKey(),
      version: existingKey.version + 1,
      createdAt: timestamp,
      expiresAt: timestamp + 90 * 24 * 60 * 60 * 1000,
      purpose: existingKey.purpose,
      algorithm: 'AES-256-GCM',
    }

    const storageKey = `${this.keyPrefix}${newKeyData.purpose ? `${newKeyData.purpose}:` : ''}${newKeyId}`
    await this.storageProvider.set(storageKey, JSON.stringify(newKeyData))

    logger.info('Rotated encryption key', {
      oldKeyId: keyId,
      newKeyId,
      purpose: newKeyData.purpose,
      newVersion: newKeyData.version,
    })

    return { keyId: newKeyId, keyData: newKeyData }
  }

  async deleteKey(keyId: string): Promise<boolean> {
    const keyData = await this.getKey(keyId)
    if (!keyData) {
      return false
    }

    const storageKey = `${this.keyPrefix}${keyData.purpose ? `${keyData.purpose}:` : ''}${keyId}`
    await this.storageProvider.delete(storageKey)

    logger.warn('Deleted encryption key', { keyId, purpose: keyData.purpose })
    return true
  }

  async close(): Promise<void> {
    if (this.storageProvider.close) {
      await this.storageProvider.close()
    }
  }
}

/**
 * Configuration options for the crypto system
 */
export interface CryptoSystemOptions {
  namespace?: string
  useSecureStorage?: boolean
  redisUrl?: string
  awsRegion?: string
  kmsKeyId?: string
  keyRotationDays?: number
}

/**
 * Comprehensive crypto system factory
 */
/**
 * Return type for createCryptoSystem function
 */
export interface CryptoSystem {
  encrypt: typeof encrypt
  decrypt: typeof decrypt
  generateSecureKey: typeof generateSecureKey
  createHash: typeof createHash
  createHMAC: typeof createHMAC
  keyStorage: KeyStorage
  keyRotationManager: KeyRotationManager
  encryptWithKeyManagement(data: string, purpose?: string): Promise<string>
  decryptWithKeyManagement(encryptedData: string): Promise<string>
  rotateExpiredKeys(): Promise<string[]>
  close(): Promise<void>
}

export function createCryptoSystem(
  options: CryptoSystemOptions = {},
): CryptoSystem {
  const {
    namespace = 'app',
    useSecureStorage = false,
    redisUrl,
    awsRegion = 'us-east-1',
    kmsKeyId,
    keyRotationDays = 90,
  } = options

  // Create storage provider based on configuration
  let storageProvider: StorageProvider

  if (useSecureStorage && kmsKeyId) {
    const fallbackProvider = redisUrl
      ? new RedisStorageProvider(redisUrl)
      : new MemoryStorageProvider()

    storageProvider = new SecureStorageProvider(
      kmsKeyId,
      awsRegion,
      fallbackProvider,
    )
  } else if (redisUrl) {
    storageProvider = new RedisStorageProvider(redisUrl)
  } else {
    storageProvider = new MemoryStorageProvider()
    if (useSecureStorage) {
      logger.warn(
        'Secure storage requested but no KMS key provided - using memory storage',
      )
    }
  }

  const keyStorage = new KeyStorage(storageProvider, namespace)
  const keyRotationManager = new KeyRotationManager(keyRotationDays)

  return {
    // Core functions
    encrypt,
    decrypt,
    generateSecureKey,
    createHash,
    createHMAC,

    // Key management
    keyStorage,
    keyRotationManager,

    /**
     * High-level encrypt with automatic key management
     */
    async encryptWithKeyManagement(
      data: string,
      purpose = 'default',
    ): Promise<string> {
      if (!data) {
        throw new Error('Cannot encrypt empty data')
      }

      // Get or create key
      const keys = await keyStorage.listKeys(purpose)
      let keyData: KeyData

      if (keys.length === 0) {
        const result = await keyStorage.generateKey(purpose)
        keyData = result.keyData
      } else {
        const latestKeyId = keys.sort().pop()!
        const existingKey = await keyStorage.getKey(latestKeyId)
        if (!existingKey) {
          throw new Error(`Key ${latestKeyId} not found`)
        }
        keyData = existingKey
      }

      const encrypted = encrypt(data, keyData.key)
      return `${purpose}:${encrypted}`
    },

    /**
     * High-level decrypt with automatic key lookup
     */
    async decryptWithKeyManagement(encryptedData: string): Promise<string> {
      if (!encryptedData) {
        throw new Error('Cannot decrypt empty data')
      }

      const [purpose, ...encryptedParts] = encryptedData.split(':')
      const encrypted = encryptedParts.join(':')

      const keys = await keyStorage.listKeys(purpose)
      if (keys.length === 0) {
        throw new Error(`No keys found for purpose: ${purpose}`)
      }

      // Try keys in reverse order (newest first)
      for (const keyId of keys.reverse()) {
        try {
          const keyData = await keyStorage.getKey(keyId)
          if (keyData) {
            return decrypt(encrypted, keyData.key)
          }
        } catch {
          // Try next key
          continue
        }
      }

      throw new Error('Failed to decrypt with any available key')
    },

    /**
     * Rotate expired keys
     */
    async rotateExpiredKeys(): Promise<string[]> {
      const rotatedKeys: string[] = []
      const allKeys = await keyStorage.listKeys()

      for (const keyId of allKeys) {
        const keyData = await keyStorage.getKey(keyId)
        if (!keyData) {
          continue
        }

        if (keyRotationManager.needsRotation(keyData.createdAt)) {
          const rotated = await keyStorage.rotateKey(keyId)
          if (rotated) {
            rotatedKeys.push(rotated.keyId)
          }
        }
      }

      return rotatedKeys
    },

    /**
     * Clean shutdown
     */
    async close(): Promise<void> {
      await keyStorage.close()
    },
  }
}

// Backward compatibility exports
export const Encryption = {
  encrypt,
  decrypt,
  generateSecureKey,
}

export default {
  encrypt,
  decrypt,
  generateSecureKey,
  createHash,
  createHMAC,
  KeyRotationManager,
  KeyStorage,
  createCryptoSystem,
  Encryption,
}
