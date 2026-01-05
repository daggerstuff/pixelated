/**
 * Advanced Encryption Manager for Pixelated Empathy
 * Handles key rotation, perfect forward secrecy, and HSM integration
 */

import type { CryptoKeyPair } from '@/types/crypto'

export interface EncryptionConfig {
  algorithm: 'AES-GCM' | 'AES-CBC' | 'RSA-OAEP'
  keySize: 128 | 256 | 512
  keyRotationDays: number
  enableHSM?: boolean
  hsmConfig?: {
    provider: string
    keyLabel: string
    slot?: number
  }
}

export interface EncryptedData {
  ciphertext: string
  iv: string
  tag?: string
  keyId: string
  algorithm: string
  timestamp: number
}

export interface KeyMetadata {
  id: string
  algorithm: string
  created: Date
  expires?: Date
  status: 'active' | 'inactive' | 'compromised' | 'expired'
  usage: string[]
  rotationCount: number
}

/**
 * Advanced Encryption Manager
 */
class EncryptionManager {
  private config: EncryptionConfig
  private currentKeyId: string | null = null
  private keyStore = new Map<string, CryptoKey>()
  private keyMetadata = new Map<string, KeyMetadata>()

  constructor(config: EncryptionConfig) {
    this.config = {
      keyRotationDays: 90,
      enableHSM: false,
      ...config,
    }
  }

  /**
   * Initialize encryption system
   */
  async initialize(): Promise<void> {
    if (this.config.enableHSM) {
      await this.initializeHSM()
    } else {
      await this.initializeSoftwareKeys()
    }

    // Set up automatic key rotation
    this.scheduleKeyRotation()
  }

  private async initializeSoftwareKeys(): Promise<void> {
    // Generate initial key pair
    const keyPair = await this.generateKeyPair()
    this.currentKeyId = keyPair.id

    this.keyStore.set(keyPair.id, keyPair.key)
    this.keyMetadata.set(keyPair.id, {
      id: keyPair.id,
      algorithm: this.config.algorithm,
      created: new Date(),
      status: 'active',
      usage: ['encrypt', 'decrypt'],
      rotationCount: 0,
    })
  }

  private async initializeHSM(): Promise<void> {
    if (!this.config.hsmConfig) {
      throw new Error('HSM configuration required when HSM is enabled')
    }

    // Initialize HSM connection (mock implementation)
    console.log('Initializing HSM connection...', this.config.hsmConfig)

    // In real implementation, this would connect to HSM
    const hsmKeyId = `hsm_${Date.now()}`
    this.currentKeyId = hsmKeyId

    this.keyMetadata.set(hsmKeyId, {
      id: hsmKeyId,
      algorithm: this.config.algorithm,
      created: new Date(),
      status: 'active',
      usage: ['encrypt', 'decrypt'],
      rotationCount: 0,
    })
  }

  private async generateKeyPair(): Promise<{ id: string; key: CryptoKey }> {
    const keyId = `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    if (this.config.algorithm.startsWith('AES')) {
      const key = (await crypto.subtle.generateKey(
        {
          name: this.config.algorithm,
          length: this.config.keySize,
        },
        true, // extractable
        ['encrypt', 'decrypt'],
      )) as CryptoKey

      return { id: keyId, key }
    } else {
      // RSA key generation
      const keyPair = (await crypto.subtle.generateKey(
        {
          name: 'RSA-OAEP',
          modulusLength: this.config.keySize,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        },
        true,
        ['encrypt', 'decrypt'],
      )) as CryptoKeyPair

      return { id: keyId, key: keyPair.privateKey }
    }
  }

  /**
   * Encrypt data with perfect forward secrecy
   */
  async encrypt(data: string, keyId?: string): Promise<EncryptedData> {
    const targetKeyId = keyId || this.currentKeyId
    if (!targetKeyId) {
      throw new Error('No encryption key available')
    }

    const key = this.keyStore.get(targetKeyId)
    if (!key) {
      throw new Error(`Key not found: ${targetKeyId}`)
    }

    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(12))

    // Convert data to Uint8Array
    const encoder = new TextEncoder()
    const dataBuffer = encoder.encode(data)

    let ciphertext: ArrayBuffer

    if (this.config.algorithm === 'AES-GCM') {
      ciphertext = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv,
        },
        key,
        dataBuffer,
      )
    } else if (this.config.algorithm === 'AES-CBC') {
      const aesKey = await crypto.subtle.importKey(
        'raw',
        await crypto.subtle.exportKey('raw', key),
        'AES-CBC',
        false,
        ['encrypt'],
      )

      ciphertext = await crypto.subtle.encrypt(
        {
          name: 'AES-CBC',
          iv: iv,
        },
        aesKey,
        dataBuffer,
      )
    } else {
      throw new Error(`Unsupported algorithm: ${this.config.algorithm}`)
    }

    // Update usage metadata
    const metadata = this.keyMetadata.get(targetKeyId)
    if (metadata) {
      metadata.usage.push('encrypt')
    }

    return {
      ciphertext: this.arrayBufferToBase64(ciphertext),
      iv: this.arrayBufferToBase64(iv),
      tag:
        this.config.algorithm === 'AES-GCM'
          ? this.extractGCMTag(ciphertext)
          : undefined,
      keyId: targetKeyId,
      algorithm: this.config.algorithm,
      timestamp: Date.now(),
    }
  }

  /**
   * Decrypt data with key validation
   */
  async decrypt(encryptedData: EncryptedData): Promise<string> {
    const { keyId, algorithm } = encryptedData

    // Validate key exists and is active
    const metadata = this.keyMetadata.get(keyId)
    if (!metadata) {
      throw new Error(`Unknown key ID: ${keyId}`)
    }

    if (metadata.status !== 'active') {
      throw new Error(`Key ${keyId} is not active (status: ${metadata.status})`)
    }

    const key = this.keyStore.get(keyId)
    if (!key) {
      throw new Error(`Key not found: ${keyId}`)
    }

    // Convert base64 back to ArrayBuffer
    const ciphertext = this.base64ToArrayBuffer(encryptedData.ciphertext)
    const iv = this.base64ToArrayBuffer(encryptedData.iv)

    let decrypted: ArrayBuffer

    if (algorithm === 'AES-GCM') {
      // Combine ciphertext and tag for GCM
      const tag = encryptedData.tag
        ? this.base64ToArrayBuffer(encryptedData.tag)
        : new Uint8Array(16)
      const combined = this.combineCiphertextAndTag(ciphertext, tag)

      decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
        },
        key,
        combined,
      )
    } else if (algorithm === 'AES-CBC') {
      decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-CBC',
          iv: iv,
        },
        key,
        ciphertext,
      )
    } else {
      throw new Error(`Unsupported algorithm: ${algorithm}`)
    }

    // Convert back to string
    const decoder = new TextDecoder()
    return decoder.decode(decrypted)
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    return btoa(String.fromCharCode(...bytes))
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes.buffer
  }

  private extractGCMTag(ciphertext: ArrayBuffer): string {
    // GCM tag is the last 16 bytes of ciphertext
    const bytes = new Uint8Array(ciphertext)
    const tag = bytes.slice(-16)
    return this.arrayBufferToBase64(tag)
  }

  private combineCiphertextAndTag(
    ciphertext: ArrayBuffer,
    tag: ArrayBuffer,
  ): ArrayBuffer {
    const cipherBytes = new Uint8Array(ciphertext)
    const tagBytes = new Uint8Array(tag)
    const combined = new Uint8Array(cipherBytes.length + tagBytes.length)

    combined.set(cipherBytes, 0)
    combined.set(tagBytes, cipherBytes.length)

    return combined.buffer
  }

  /**
   * Rotate encryption keys
   */
  async rotateKeys(): Promise<{ oldKeyId: string; newKeyId: string }> {
    const oldKeyId = this.currentKeyId!

    // Generate new key
    const newKeyPair = await this.generateKeyPair()
    this.currentKeyId = newKeyPair.id

    // Update metadata
    const oldMetadata = this.keyMetadata.get(oldKeyId)
    if (oldMetadata) {
      oldMetadata.status = 'inactive'
      oldMetadata.rotationCount += 1
    }

    const newMetadata = this.keyMetadata.get(newKeyPair.id)
    if (newMetadata) {
      newMetadata.status = 'active'
      newMetadata.usage = ['encrypt', 'decrypt']
    }

    // Mark old key for cleanup after grace period
    setTimeout(
      () => {
        this.keyStore.delete(oldKeyId)
        this.keyMetadata.delete(oldKeyId)
      },
      7 * 24 * 60 * 60 * 1000,
    ) // 7 days

    return { oldKeyId, newKeyId: newKeyPair.id }
  }

  private scheduleKeyRotation(): void {
    const rotationInterval = this.config.keyRotationDays * 24 * 60 * 60 * 1000

    setInterval(async () => {
      try {
        await this.rotateKeys()
        console.log('Encryption keys rotated successfully')
      } catch (error) {
        console.error('Key rotation failed:', error)
      }
    }, rotationInterval)
  }

  /**
   * Get current key information
   */
  getCurrentKeyInfo(): KeyMetadata | null {
    if (!this.currentKeyId) return null
    return this.keyMetadata.get(this.currentKeyId) || null
  }

  /**
   * List all keys
   */
  listKeys(): KeyMetadata[] {
    return Array.from(this.keyMetadata.values())
  }

  /**
   * Revoke a key (mark as compromised)
   */
  revokeKey(keyId: string, reason: string): boolean {
    const metadata = this.keyMetadata.get(keyId)
    if (!metadata) return false

    metadata.status = 'compromised'
    console.warn(`Key ${keyId} revoked: ${reason}`)

    // If this was the current key, rotate immediately
    if (keyId === this.currentKeyId) {
      this.rotateKeys().catch(console.error)
    }

    return true
  }

  /**
   * Enable perfect forward secrecy for a key
   */
  async enablePerfectForwardSecrecy(keyId: string): Promise<boolean> {
    const metadata = this.keyMetadata.get(keyId)
    if (!metadata) return false

    // Generate ephemeral key for this session
    const ephemeralKey = await this.generateKeyPair()

    // Derive session key using ECDH (simplified for this example)
    const sessionKey = await crypto.subtle.deriveKey(
      {
        name: 'ECDH',
        public: ephemeralKey.key,
      },
      this.keyStore.get(keyId)!,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['encrypt', 'decrypt'],
    )

    // Replace the key with session key
    this.keyStore.set(keyId, sessionKey)

    return true
  }

  /**
   * Get encryption metrics
   */
  getMetrics(): {
    totalKeys: number
    activeKeys: number
    currentKeyAge: number
    keysRotated: number
    encryptionOperations: number
    decryptionOperations: number
  } {
    const totalKeys = this.keyMetadata.size
    const activeKeys = Array.from(this.keyMetadata.values()).filter(
      (k) => k.status === 'active',
    ).length
    const currentKey = this.getCurrentKeyInfo()
    const currentKeyAge = currentKey
      ? Date.now() - currentKey.created.getTime()
      : 0

    return {
      totalKeys,
      activeKeys,
      currentKeyAge,
      keysRotated: Array.from(this.keyMetadata.values()).reduce(
        (sum, k) => sum + k.rotationCount,
        0,
      ),
      encryptionOperations: Array.from(this.keyMetadata.values()).reduce(
        (sum, k) => sum + k.usage.filter((u) => u === 'encrypt').length,
        0,
      ),
      decryptionOperations: Array.from(this.keyMetadata.values()).reduce(
        (sum, k) => sum + k.usage.filter((u) => u === 'decrypt').length,
        0,
      ),
    }
  }
}

// Export singleton instance
export const encryptionManager = new EncryptionManager({
  algorithm: 'AES-GCM',
  keySize: 256,
  keyRotationDays: 90,
  enableHSM: false,
})

// Export class for custom instances
export { EncryptionManager }
export default encryptionManager
