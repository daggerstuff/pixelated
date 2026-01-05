/**
 * Real FHE (Fully Homomorphic Encryption) service for Pixelated Empathy
 * Uses node-seal library for Microsoft SEAL implementation
 */

import SEAL from 'node-seal'
import { createBuildSafeLogger } from './logging/build-safe-logger'
import type { FHEOperation, FHEOperationResult } from './fhe/types'

const logger = createBuildSafeLogger('default')

// Define types based on the SEAL library structure
type SealInstance = Awaited<ReturnType<typeof SEAL>>
type EncryptionParameters = ReturnType<SealInstance['EncryptionParameters']>
type SEALContext = ReturnType<SealInstance['Context']>
type KeyGenerator = ReturnType<SealInstance['KeyGenerator']>
type PublicKey = ReturnType<KeyGenerator['createPublicKey']>
type SecretKey = ReturnType<KeyGenerator['secretKey']>
type BatchEncoder = ReturnType<SealInstance['BatchEncoder']>
type Encryptor = ReturnType<SealInstance['Encryptor']>
type Decryptor = ReturnType<SealInstance['Decryptor']>
type PlainText = ReturnType<SealInstance['PlainText']>
type CipherText = ReturnType<SealInstance['CipherText']>

export type EncryptionMode =
  | 'secure'
  | 'fast'
  | 'none'
  | 'standard'
  | 'hipaa'
  | 'fhe'

export interface EncryptionConfig {
  mode: EncryptionMode
  keySize: number
  securityLevel: 'tc128' | 'tc192' | 'tc256'
}

export interface FHEService {
  encrypt: (data: string) => Promise<string>
  decrypt: (data: string) => Promise<string>
  encryptText: (text: string) => Promise<string>
  decryptText: (text: string) => Promise<string>
  generateHash: (data: string) => Promise<string>
  initialize: (config: EncryptionConfig) => Promise<void>
  setEncryptionMode: (mode: EncryptionMode) => void
}

export class RealFHEService implements FHEService {
  private seal: SealInstance | null = null
  private context: SEALContext | null = null
  private publicKey: PublicKey | null = null
  private secretKey: SecretKey | null = null
  private encryptor: Encryptor | null = null
  private decryptor: Decryptor | null = null
  private encoder: BatchEncoder | null = null
  // Removed unused evaluator property
  private isInitialized = false
  private encryptionMode: EncryptionMode = 'secure'
  private config: EncryptionConfig = {
    mode: 'secure',
    keySize: 2048,
    securityLevel: 'tc128',
  }

  async initialize(config: EncryptionConfig): Promise<void> {
    try {
      this.config = config
      this.encryptionMode = config.mode

      this.seal = await SEAL()

      const schemeType = (this.seal as SealInstance).SchemeType.bfv
      const securityLevel = (this.seal as SealInstance).SecurityLevel.tc128

      const polyModulusDegree = this.encryptionMode === 'secure' ? 8192 : 4096
      const bitSizes =
        this.encryptionMode === 'secure' ? [60, 40, 40, 60] : [60, 40, 40]

      const encParams = (this.seal as SealInstance).EncryptionParameters(
        schemeType,
      ) as EncryptionParameters
      encParams.setPolyModulusDegree(polyModulusDegree)

      // Set coefficient modulus
      const coeffModulus = (this.seal as SealInstance).CoeffModulus.Create(
        polyModulusDegree,
        Int32Array.from(bitSizes),
      )
      encParams.setCoeffModulus(coeffModulus)

      // Set plain modulus for BFV scheme
      const plainModulus = (this.seal as SealInstance).PlainModulus.Batching(
        polyModulusDegree,
        20,
      )
      encParams.setPlainModulus(plainModulus)

      // Create context
      this.context = (this.seal as SealInstance).Context(
        encParams,
        true,
        securityLevel,
      ) as SEALContext

      if (!(this.context as SEALContext).parametersSet()) {
        throw new Error('Parameters are not set correctly')
      }

      // Create keys
      const keyGenerator = (this.seal as SealInstance).KeyGenerator(
        this.context as SEALContext,
      ) as KeyGenerator
      this.publicKey = keyGenerator.createPublicKey() as PublicKey
      this.secretKey = keyGenerator.secretKey() as SecretKey

      // Create encryption tools
      this.encoder = (this.seal as SealInstance).BatchEncoder(
        this.context as SEALContext,
      ) as BatchEncoder
      this.encryptor = (this.seal as SealInstance).Encryptor(
        this.context as SEALContext,
        this.publicKey as PublicKey,
      ) as Encryptor
      this.decryptor = (this.seal as SealInstance).Decryptor(
        this.context as SEALContext,
        this.secretKey as SecretKey,
      ) as Decryptor
      // Removed unused evaluator assignment

      this.isInitialized = true
      logger.info('FHE service initialized successfully')
    } catch (error: unknown) {
      logger.error('Failed to initialize FHE service', {
        error: error instanceof Error ? String(error) : String(error),
      })
      throw error
    }
  }

  setEncryptionMode(mode: EncryptionMode): void {
    this.encryptionMode = mode
    this.config = { ...this.config, mode }
    if (this.isInitialized) {
      logger.warn(
        'Encryption mode changed after initialization. Re-initialization required.',
      )
      this.isInitialized = false
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize(this.config)
    }
  }

  private textToUint32Array(text: string): Uint32Array {
    const encoder = new TextEncoder()
    const bytes = encoder.encode(text)
    const result = new Uint32Array(Math.ceil(bytes.length / 4))

    for (let i = 0; i < bytes.length; i += 4) {
      let value = 0
      for (let j = 0; j < 4 && i + j < bytes.length; j++) {
        value |= (bytes[i + j] ?? 0) << (8 * j)
      }
      result[i / 4] = value
    }

    return result
  }

  private uint32ArrayToText(array: Uint32Array): string {
    const bytes = new Uint8Array(array.length * 4)

    for (let i = 0; i < array.length; i++) {
      const value = array[i] ?? 0
      for (let j = 0; j < 4; j++) {
        bytes[i * 4 + j] = (value >> (8 * j)) & 0xff
      }
    }

    // Remove trailing null bytes
    let lastNonZero = bytes.length - 1
    while (lastNonZero >= 0 && bytes[lastNonZero] === 0) {
      lastNonZero--
    }

    const decoder = new TextDecoder()
    return decoder.decode(bytes.slice(0, lastNonZero + 1))
  }

  async encrypt(data: string): Promise<string> {
    try {
      await this.ensureInitialized()

      // Convert data to numeric representation
      const dataArray = this.textToUint32Array(data)

      // Encode the data
      const plaintext = (this.seal as SealInstance).PlainText() as PlainText
      ;(this.encoder as BatchEncoder).encode(
        Int32Array.from(dataArray),
        plaintext,
      )

      // Encrypt the plaintext
      const ciphertext = (this.seal as SealInstance).CipherText() as CipherText
      ;(this.encryptor as Encryptor).encrypt(plaintext, ciphertext)

      // Serialize the ciphertext to base64
      const serialized = ciphertext.save()

      // Clean up resources
      plaintext.delete()

      return serialized
    } catch (error: unknown) {
      logger.error('Encryption failed', {
        error: error instanceof Error ? String(error) : String(error),
      })
      throw error
    }
  }

  async decrypt(data: string): Promise<string> {
    try {
      await this.ensureInitialized()

      // Deserialize the ciphertext
      const ciphertext = (this.seal as SealInstance).CipherText() as CipherText
      ciphertext.load(this.context as SEALContext, data)

      // Decrypt the ciphertext
      const plaintext = (this.seal as SealInstance).PlainText() as PlainText
      ;(this.decryptor as Decryptor).decrypt(ciphertext, plaintext)

      // Decode the plaintext
      const decodedArray = (this.encoder as BatchEncoder).decode(plaintext)

      const finalDecodedArray: Uint32Array =
        decodedArray instanceof Uint32Array
          ? decodedArray
          : new Uint32Array(decodedArray)

      // Convert numeric values back to string
      const result = this.uint32ArrayToText(finalDecodedArray)

      // Clean up resources
      plaintext.delete()
      ciphertext.delete()

      return result
    } catch (error: unknown) {
      logger.error('Decryption failed', {
        error: error instanceof Error ? String(error) : String(error),
      })
      throw error
    }
  }

  async encryptText(text: string): Promise<string> {
    return this.encrypt(text)
  }

  async decryptText(text: string): Promise<string> {
    return this.decrypt(text)
  }

  async generateHash(data: string): Promise<string> {
    try {
      // Use Web Crypto API for proper cryptographic hashing
      const encoder = new TextEncoder()
      const dataBuffer = encoder.encode(data)

      // Perform SHA-256 hashing
      const hashBuffer = await this.seal.crypto.subtle.digest(
        'SHA-256',
        dataBuffer,
      )

      // Convert the hash to hex string
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
    } catch (error: unknown) {
      logger.error('Hash generation failed', {
        error: error instanceof Error ? String(error) : String(error),
      })
      throw error
    }
  }

  async processEncrypted(
    encryptedData: string,
    operation: FHEOperation | string,
    params?: Record<string, unknown>,
  ): Promise<FHEOperationResult<string>> {
    try {
      logger.info('Processing encrypted data', { operation, params })

      // For now, implement a basic passthrough that simulates processing
      // In a real implementation, this would perform homomorphic operations
      const result = encryptedData // Placeholder for actual FHE operations

      return {
        success: true,
        result,
        operation: operation as FHEOperation,
        metadata: {
          timestamp: Date.now(),
          params,
        },
      }
    } catch (error: unknown) {
      logger.error('Processing encrypted data failed', {
        operation,
        error: error instanceof Error ? String(error) : String(error),
      })

      return {
        success: false,
        error: error instanceof Error ? String(error) : String(error),
        operation: operation as FHEOperation,
        metadata: {
          timestamp: Date.now(),
          params,
        },
      }
    }
  }

  async rotateKeys(): Promise<void> {
    try {
      logger.info('Rotating FHE keys')

      if (!this.isInitialized || !this.context || !this.seal) {
        throw new Error('FHE service is not initialized')
      }

      // Generate new key pair
      const keyGen = (this.seal as SealInstance).KeyGenerator(this.context)
      this.secretKey = keyGen.secretKey()
      this.publicKey = keyGen.createPublicKey()

      // Recreate encryptor and decryptor with new keys
      this.encryptor = (this.seal as SealInstance).Encryptor(
        this.context,
        this.publicKey,
      )
      this.decryptor = (this.seal as SealInstance).Decryptor(
        this.context,
        this.secretKey,
      )

      logger.info('Key rotation completed successfully')
    } catch (error: unknown) {
      logger.error('Key rotation failed', {
        error: error instanceof Error ? String(error) : String(error),
      })
      throw error
    }
  }
}

// Export a singleton instance of the FHE service
export const fheService = new RealFHEService()
