import { KeyStorage } from './keyStorage'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

interface EncryptionOptions {
  namespace: string
  region: string
  kmsKeyId: string
}

interface EncryptedData {
  iv: string
  encryptedData: string
  keyId: string
  version: number
}

/**
 * Encryption utility for handling data encryption and decryption
 * with AWS KMS for key management
 */
export class Encryption {
  private keyStorage: KeyStorage

  constructor(options: EncryptionOptions) {
    this.keyStorage = new KeyStorage({
      namespace: options.namespace,
      region: options.region,
      kmsKeyId: options.kmsKeyId,
      useKms: true,
    })
  }

  /**
   * Encrypts data using AES-256-GCM with KMS-generated data keys
   * @param data - Data to encrypt
   * @param purpose - Purpose of the key
   * @returns Encrypted data with metadata
   */
  async encrypt(data: string, purpose: string): Promise<string> {
    // Generate a new data key
    const { keyId, keyData } = await this.keyStorage.generateKey(purpose)

    if (!keyData.encryptedKey) {
      throw new Error('No encrypted key available')
    }

    // Decrypt the data key for use
    const dataKey = await this.keyStorage.decryptKey(keyData.encryptedKey)

    // Generate a random IV
    const iv = randomBytes(16)

    // Create cipher
    const cipher = createCipheriv('aes-256-gcm', dataKey, iv)

    // Encrypt the data
    const encryptedData = Buffer.concat([
      cipher.update(Buffer.from(data)),
      cipher.final(),
    ])

    // Get the auth tag
    const authTag = cipher.getAuthTag()

    // Create the final encrypted object
    const encrypted: EncryptedData = {
      iv: iv.toString('base64'),
      encryptedData: Buffer.concat([encryptedData, authTag]).toString('base64'),
      keyId,
      version: keyData.version,
    }

    // Return JSON string of encrypted data
    return JSON.stringify(encrypted)
  }

  /**
   * Decrypts data using AES-256-GCM with KMS-generated data keys
   * @param encryptedString - Encrypted data string
   * @returns Decrypted data
   */
  async decrypt(encryptedString: string): Promise<string> {
    try {
      // Parse the encrypted data
      const encrypted: EncryptedData = JSON.parse(encryptedString) as unknown

      // Get the key data
      const keyData = await this.keyStorage.getKey(encrypted.keyId)
      if (!keyData || !keyData.encryptedKey) {
        throw new Error('Key not found or invalid')
      }

      // Decrypt the data key
      const dataKey = await this.keyStorage.decryptKey(keyData.encryptedKey)

      // Convert IV and encrypted data from base64
      const iv = Buffer.from(encrypted.iv, 'base64')
      const encryptedBuffer = Buffer.from(encrypted.encryptedData, 'base64')

      // Split the encrypted data and auth tag
      const authTag = encryptedBuffer.slice(encryptedBuffer.length - 16)
      const encryptedData = encryptedBuffer.slice(
        0,
        encryptedBuffer.length - 16,
      )

      // Create decipher
      const decipher = createDecipheriv('aes-256-gcm', dataKey, iv)
      decipher.setAuthTag(authTag)

      // Decrypt the data
      const decrypted = Buffer.concat([
        decipher.update(encryptedData),
        decipher.final(),
      ])

      return decrypted.toString()
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  /**
   * Rotates the encryption key for data
   * @param encryptedString - Currently encrypted data
   * @returns Newly encrypted data with rotated key
   */
  async rotateKey(encryptedString: string): Promise<string> {
    // Decrypt the data with the old key
    const decrypted = await this.decrypt(encryptedString)

    // Parse the encrypted data to get the purpose
    const encrypted: EncryptedData = JSON.parse(encryptedString) as unknown
    const oldKey = await this.keyStorage.getKey(encrypted.keyId)

    if (!oldKey) {
      throw new Error('Original key not found')
    }

    // Re-encrypt with a new key
    return this.encrypt(decrypted, oldKey.purpose)
  }
}
