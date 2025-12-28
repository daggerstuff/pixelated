import { Encryption } from './encryption'

/**
 * Interface for key metadata
 */
interface KeyMetadata {
  id: string
  version: number
  createdAt: number
  expiresAt?: number
  active: boolean
}

/**
 * Key Rotation Manager for handling encryption key rotation
 * Implements HIPAA-compliant key rotation policies
 */
export class KeyRotationManager {
  private keys: Map<string, KeyMetadata>
  private keyStore: Map<string, string> // In production, use a secure key vault
  private rotationInterval: number // in milliseconds
  private encryption: Encryption

  /**
   * Creates a new KeyRotationManager
   * @param rotationInterval - Interval for key rotation in days (default: 90 days)
   */
  constructor(options: {
    rotationInterval?: number
    namespace: string
    region: string
    kmsKeyId: string
  }) {
    this.keys = new Map()
    this.keyStore = new Map()
    this.rotationInterval =
      (options.rotationInterval || 90) * 24 * 60 * 60 * 1000 // Convert days to milliseconds
    this.encryption = new Encryption({
      namespace: options.namespace,
      region: options.region,
      kmsKeyId: options.kmsKeyId,
    })
  }

  /**
   * Adds a new encryption key
   * @param keyId - Unique identifier for the key
   * @param key - The encryption key
   * @param version - Key version (default: 1)
   * @returns Key metadata
   */
  addKey(keyId: string, key: string, version = 1): KeyMetadata {
    const now = Date.now()
    const metadata: KeyMetadata = {
      id: keyId,
      version,
      createdAt: now,
      expiresAt: now + this.rotationInterval,
      active: true,
    }

    // Store key metadata
    this.keys.set(keyId, metadata)

    // Store the actual key (in production, use a secure key vault)
    this.keyStore.set(keyId, key)

    return metadata
  }

  /**
   * Rotates an encryption key
   * @param keyId - ID of the key to rotate
   * @param newKey - New encryption key
   * @returns New key metadata
   */
  rotateKey(keyId: string, newKey: string): KeyMetadata {
    // Get existing key metadata
    const existingMetadata = this.keys.get(keyId)

    if (!existingMetadata) {
      throw new Error(`Key with ID ${keyId} not found`)
    }

    // Deactivate the old key
    existingMetadata.active = false
    this.keys.set(keyId, existingMetadata)

    // Create new key with incremented version
    const newVersion = existingMetadata.version + 1
    return this.addKey(keyId, newKey, newVersion)
  }

  /**
   * Gets the current active key for a given key ID
   * @param keyId - ID of the key to retrieve
   * @returns The encryption key
   */
  getActiveKey(keyId: string): { key: string; metadata: KeyMetadata } {
    const metadata = this.keys.get(keyId)

    if (!metadata) {
      throw new Error(`Key with ID ${keyId} not found`)
    }

    if (!metadata.active) {
      throw new Error(`Key with ID ${keyId} is not active`)
    }

    const key = this.keyStore.get(keyId)

    if (!key) {
      throw new Error(`Key data for ID ${keyId} not found`)
    }

    return { key, metadata }
  }

  /**
   * Checks if keys need rotation based on expiration
   * @returns Array of key IDs that need rotation
   */
  checkForRotationNeeded(): string[] {
    const now = Date.now()
    const keysNeedingRotation: string[] = []

    this.keys.forEach((metadata, keyId) => {
      if (metadata.active && metadata.expiresAt && metadata.expiresAt <= now) {
        keysNeedingRotation.push(keyId)
      }
    })

    return keysNeedingRotation
  }

  /**
   * Re-encrypts data with the latest key version
   * @param encryptedData - Data encrypted with an old key
   * @param keyId - ID of the key used for encryption
   * @returns Data encrypted with the latest key version
   */
  async reencryptWithLatestKey(
    encryptedData: string,
    keyId: string,
  ): Promise<string> {
    // Get the version from the encrypted data
    const version = Number.parseInt(
      encryptedData.split(':')[0].substring(1),
      10,
    )

    // Get the current active key
    const { key: currentKey, metadata: currentMetadata } =
      this.getActiveKey(keyId)

    // If already using the latest version, return as is
    if (version === currentMetadata.version) {
      return encryptedData
    }

    // Get the old key for decryption
    const oldKey = this.keyStore.get(keyId)

    if (!oldKey) {
      throw new Error(`Key data for ID ${keyId} not found`)
    }

    // Decrypt with old key and re-encrypt with new key
    const decrypted = await this.encryption.decrypt(encryptedData)
    return this.encryption.encrypt(decrypted, currentKey)
  }
}
