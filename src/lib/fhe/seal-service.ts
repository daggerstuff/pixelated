/**
 * Microsoft SEAL Service
 *
 * Main service for FHE operations using Microsoft SEAL
 */

import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { EncryptionMode } from './types'
import { FHEOperation } from './types'
import { getSchemeForMode, SealSchemeType } from './seal-types'
import type { SealContextOptions } from './seal-types'
import type { SealSerializationOptions, SerializedSealKeys } from './seal-types'
import { SealContext } from './seal-context'
import { SealMemoryManager } from './seal-memory'
import { fheParameterOptimizer } from './parameter-optimizer'

// Initialize logger
const logger = createBuildSafeLogger('seal-service')

// --- Begin SEAL Type Definitions ---

export interface SealDisposable {
  delete(): void
}

// Use type aliases with a nominal property to satisfy no-empty-interface
// and still represent them as distinct disposable types.
type SealContextInternal = SealDisposable & {
  _sealContextInternalBrand?: never
}

export type SealPlainText = SealDisposable & { _sealPlainTextBrand?: never }

export interface SealCipherText extends SealDisposable {
  copy(other: SealCipherText): void
  // save?(compressionMode?: unknown): string; // If ciphertexts can be saved directly
}

interface SealKeyGenerator extends SealDisposable {
  secretKey(): SealSecretKey
  createPublicKey(): SealPublicKey
  createRelinKeys(): SealRelinKeys
  createGaloisKeys(): SealGaloisKeys
}

interface SealSecretKey extends SealDisposable {
  save(compressionMode?: unknown): string
  load(context: SealContextInternal, data: string): void
}

interface SealPublicKey extends SealDisposable {
  save(compressionMode?: unknown): string
  load(context: SealContextInternal, data: string): void
}

interface SealRelinKeys extends SealDisposable {
  save(compressionMode?: unknown): string
  load(context: SealContextInternal, data: string): void
}

interface SealGaloisKeys extends SealDisposable {
  save(compressionMode?: unknown): string
  load(context: SealContextInternal, data: string): void
}

interface SealEncryptor extends SealDisposable {
  encrypt(plaintext: SealPlainText, ciphertext: SealCipherText): void
}

interface SealDecryptor extends SealDisposable {
  decrypt(ciphertext: SealCipherText, plaintext: SealPlainText): void
}

interface SealEvaluator extends SealDisposable {
  add(
    cipher1: SealCipherText,
    cipher2: SealCipherText,
    destination: SealCipherText,
  ): void
  addPlain(
    cipher: SealCipherText,
    plain: SealPlainText,
    destination: SealCipherText,
  ): void
  sub(
    cipher1: SealCipherText,
    cipher2: SealCipherText,
    destination: SealCipherText,
  ): void
  multiply(
    cipher1: SealCipherText,
    cipher2: SealCipherText,
    destination: SealCipherText,
  ): void
  multiplyPlain(
    cipher: SealCipherText,
    plain: SealPlainText,
    destination: SealCipherText,
  ): void
  square(cipher: SealCipherText, destination: SealCipherText): void
  relinearize(
    cipher: SealCipherText,
    relinKeys: SealRelinKeys,
    destination: SealCipherText,
  ): void
  negate(cipher: SealCipherText, destination: SealCipherText): void
  rotateVector(
    cipher: SealCipherText,
    steps: number,
    galoisKeys: SealGaloisKeys,
    destination: SealCipherText,
  ): void
  rotateRows(
    cipher: SealCipherText,
    steps: number,
    galoisKeys: SealGaloisKeys,
    destination: SealCipherText,
  ): void
}

interface SealBatchEncoder extends SealDisposable {
  encode(
    data: number[] | Int32Array | Uint32Array,
    plaintext: SealPlainText,
  ): void
  decode(plaintext: SealPlainText): number[] | Int32Array | Uint32Array
  readonly slotCount: number
}

interface SealCKKSEncoder extends SealDisposable {
  encode(
    data: number[] | Float64Array,
    scale: number | bigint,
    plaintext: SealPlainText,
  ): void
  decode(plaintext: SealPlainText): number[] | Float64Array
}

interface SealCompressionEnum {
  none: unknown // Specific type if known (e.g., number)
  zstd: unknown // Specific type if known
  [key: string]: unknown
}

interface SealModule {
  KeyGenerator(context: SealContextInternal): SealKeyGenerator
  Encryptor(
    context: SealContextInternal,
    publicKey: SealPublicKey,
  ): SealEncryptor
  Decryptor(
    context: SealContextInternal,
    secretKey: SealSecretKey,
  ): SealDecryptor
  Evaluator(context: SealContextInternal): SealEvaluator
  BatchEncoder(context: SealContextInternal): SealBatchEncoder
  CKKSEncoder(context: SealContextInternal): SealCKKSEncoder
  PlainText(): SealPlainText
  CipherText(): SealCipherText
  SecretKey(): SealSecretKey
  PublicKey(): SealPublicKey
  RelinKeys(): SealRelinKeys
  GaloisKeys(): SealGaloisKeys
  ComprModeType: SealCompressionEnum
}

// --- End SEAL Type Definitions ---

/**
 * Extended serialized SEAL keys with additional metadata
 */
export interface ExtendedSerializedSealKeys extends SerializedSealKeys {
  parameters: unknown
  schemeType: SealSchemeType
}

/**
 * Main service for SEAL operations
 */
export class SealService {
  private static instance: SealService
  private sealContext: SealContext | null = null
  private memoryManager = new SealMemoryManager()

  // SEAL components
  private keyGenerator: SealKeyGenerator | null = null
  private secretKey: SealSecretKey | null = null
  private publicKey: SealPublicKey | null = null
  private relinKeys: SealRelinKeys | null = null
  private galoisKeys: SealGaloisKeys | null = null
  private encryptor: SealEncryptor | null = null
  private decryptor: SealDecryptor | null = null
  private evaluator: SealEvaluator | null = null
  private batchEncoder: SealBatchEncoder | null = null
  private ckksEncoder: SealCKKSEncoder | null = null

  private schemeType: SealSchemeType = SealSchemeType.BFV
  private initialized = false
  private keyGenerated = false

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {}

  /**
   * Get the singleton instance of SealService
   */
  public static getInstance(): SealService {
    if (!SealService.instance) {
      SealService.instance = new SealService()
    }
    return SealService.instance
  }

  /**
   * Initialize the SEAL service with the given mode or options
   *
   * @param modeOrOptions Encryption mode or SEAL context options
   */
  public async initialize(
    modeOrOptions: EncryptionMode | SealContextOptions = EncryptionMode.FHE,
  ): Promise<void> {
    if (this.initialized) {
      logger.warn('SEAL service already initialized')
      return
    }

    try {
      let options: SealContextOptions

      // Determine if we're using a mode or options
      if (typeof modeOrOptions === 'string') {
        const mode = modeOrOptions as EncryptionMode
        const schemeType = getSchemeForMode(mode)

        if (!schemeType) {
          logger.info(
            `Mode ${mode} does not use FHE, skipping SEAL initialization`,
          )
          return
        }

        this.schemeType = schemeType

        const operations: FHEOperation[] = [
          FHEOperation.Addition,
          FHEOperation.Multiplication,
          FHEOperation.Polynomial,
        ]

        const optimizationResult =
          fheParameterOptimizer.getOptimizedParametersForOperations(
            operations,
            schemeType,
          )

        logger.info('Using optimized FHE parameters', {
          scheme: schemeType,
          estimatedSecurity: optimizationResult.estimatedSecurity,
          estimatedPerformance: optimizationResult.estimatedPerformance,
        })

        options = {
          scheme: schemeType,
          params: optimizationResult.params,
        }
      } else {
        options = modeOrOptions as SealContextOptions
        this.schemeType = options.scheme
      }

      logger.info(`Initializing SEAL service with ${this.schemeType} scheme`)

      this.sealContext = new SealContext(options)
      await this.sealContext.initialize()

      const seal = this.getSeal()
      const context = this.getContext()

      this.evaluator = this.memoryManager.track(
        seal.Evaluator(context),
        'evaluator',
      )

      if (this.schemeType === SealSchemeType.CKKS) {
        this.ckksEncoder = this.memoryManager.track(
          seal.CKKSEncoder(context),
          'ckksEncoder',
        )
      } else {
        this.batchEncoder = this.memoryManager.track(
          seal.BatchEncoder(context),
          'batchEncoder',
        )
      }

      this.initialized = true
      logger.info('SEAL service initialized successfully')
    } catch (error: unknown) {
      logger.error('Failed to initialize SEAL service', { error })
      throw new Error(
        `SEAL service initialization failed: ${error instanceof Error ? String(error) : String(error)}`,
        { cause: error },
      )
    }
  }

  /**
   * Generate encryption keys
   */
  public async generateKeys(): Promise<void> {
    this.checkInitialized()

    try {
      const seal = this.getSeal()
      const context = this.getContext()

      logger.info('Generating SEAL keys')

      this.releaseKeys()

      this.keyGenerator = this.memoryManager.track(
        seal.KeyGenerator(context),
        'keyGenerator',
      )

      this.secretKey = this.memoryManager.track(
        this.keyGenerator.secretKey(),
        'secretKey',
      )

      this.publicKey = this.memoryManager.track(
        this.keyGenerator.createPublicKey(),
        'publicKey',
      )

      this.encryptor = this.memoryManager.track(
        seal.Encryptor(context, this.publicKey!), // Not null due to checkKeysGenerated logic path
        'encryptor',
      )

      this.decryptor = this.memoryManager.track(
        seal.Decryptor(context, this.secretKey!), // Not null due to checkKeysGenerated logic path
        'decryptor',
      )

      this.relinKeys = this.memoryManager.track(
        this.keyGenerator.createRelinKeys(),
        'relinKeys',
      )

      this.galoisKeys = this.memoryManager.track(
        this.keyGenerator.createGaloisKeys(),
        'galoisKeys',
      )

      this.keyGenerated = true
      logger.info('SEAL keys generated successfully')
    } catch (error: unknown) {
      logger.error('Failed to generate SEAL keys', { error })
      throw new Error(
        `Key generation failed: ${error instanceof Error ? String(error) : String(error)}`,
        { cause: error },
      )
    }
  }

  /**
   * Check if keys have been generated
   */
  public hasKeys(): boolean {
    return this.keyGenerated && !!this.secretKey && !!this.publicKey
  }

  /**
   * Release current keys
   */
  private releaseKeys() {
    if (this.keyGenerator) {
      this.memoryManager.release(this.keyGenerator, 'keyGenerator')
      this.keyGenerator = null
    }
    if (this.secretKey) {
      this.memoryManager.release(this.secretKey, 'secretKey')
      this.secretKey = null
    }
    if (this.publicKey) {
      this.memoryManager.release(this.publicKey, 'publicKey')
      this.publicKey = null
    }
    if (this.relinKeys) {
      this.memoryManager.release(this.relinKeys, 'relinKeys')
      this.relinKeys = null
    }
    if (this.galoisKeys) {
      this.memoryManager.release(this.galoisKeys, 'galoisKeys')
      this.galoisKeys = null
    }
    if (this.encryptor) {
      this.memoryManager.release(this.encryptor, 'encryptor')
      this.encryptor = null
    }
    if (this.decryptor) {
      this.memoryManager.release(this.decryptor, 'decryptor')
      this.decryptor = null
    }
    this.keyGenerated = false
  }

  /**
   * Get the SEAL instance
   */
  public getSeal(): SealModule {
    this.checkInitialized()
    return this.sealContext!.getSeal() as SealModule
  }

  /**
   * Get the SEAL context
   */
  public getContext(): SealContextInternal {
    this.checkInitialized()
    return this.sealContext!.getContext() as SealContextInternal
  }

  /**
   * Get the scheme type
   */
  public getSchemeType(): SealSchemeType {
    return this.schemeType
  }

  /**
   * Get the SEAL evaluator
   */
  public getEvaluator(): SealEvaluator {
    this.checkInitialized()
    if (!this.evaluator) {
      throw new Error('Evaluator not initialized.')
    }
    return this.evaluator
  }

  /**
   * Get the relinearization keys
   */
  public getRelinKeys(): SealRelinKeys {
    this.checkKeysGenerated()
    if (!this.relinKeys) {
      throw new Error('RelinKeys not generated.')
    }
    return this.relinKeys
  }

  /**
   * Get the Galois keys
   */
  public getGaloisKeys(): SealGaloisKeys {
    this.checkKeysGenerated()
    if (!this.galoisKeys) {
      throw new Error('GaloisKeys not generated.')
    }
    return this.galoisKeys
  }

  /**
   * Get the batch encoder (for BFV/BGV)
   */
  public getBatchEncoder(): SealBatchEncoder {
    this.checkInitialized()
    if (this.schemeType === SealSchemeType.CKKS) {
      throw new Error('Batch encoder is only available for BFV/BGV schemes')
    }
    if (!this.batchEncoder) {
      throw new Error('BatchEncoder not initialized.')
    }
    return this.batchEncoder
  }

  /**
   * Get the CKKS encoder
   */
  public getCKKSEncoder(): SealCKKSEncoder {
    this.checkInitialized()
    if (this.schemeType !== SealSchemeType.CKKS) {
      throw new Error('CKKS encoder is only available for CKKS scheme')
    }
    if (!this.ckksEncoder) {
      throw new Error('CKKSEncoder not initialized.')
    }
    return this.ckksEncoder
  }

  /**
   * Get the encryptor
   */
  public getEncryptor(): SealEncryptor {
    this.checkKeysGenerated()
    if (!this.encryptor) {
      throw new Error('Encryptor not initialized.')
    }
    return this.encryptor
  }

  /**
   * Get the decryptor
   */
  public getDecryptor(): SealDecryptor {
    this.checkKeysGenerated()
    if (!this.decryptor) {
      throw new Error('Decryptor not initialized.')
    }
    return this.decryptor
  }

  /**
   * Encrypt data
   *
   * @param data Data to encrypt (array of numbers)
   * @param scale Scale for CKKS encryption (default: 2^40)
   * @returns Encrypted ciphertext
   */
  public async encrypt(
    data: number[],
    scale?: number | bigint,
  ): Promise<SealCipherText> {
    this.checkKeysGenerated()

    try {
      const seal = this.getSeal()
      const encryptor = this.getEncryptor() // Use getter to ensure it's initialized
      let plaintext: SealPlainText
      let ciphertext: SealCipherText

      if (this.schemeType === SealSchemeType.CKKS) {
        const ckksEncoder = this.getCKKSEncoder()
        const effectiveScale =
          scale !== undefined ? scale : BigInt(1) << BigInt(40)

        plaintext = seal.PlainText()
        ckksEncoder.encode(data, effectiveScale, plaintext)

        ciphertext = seal.CipherText()
        encryptor.encrypt(plaintext, ciphertext)

        plaintext.delete() // Release plaintext as it's been used

        // Create a new ciphertext to return, copying the result
        const result = seal.CipherText()
        result.copy(ciphertext)
        ciphertext.delete() // Release intermediate ciphertext

        return result
      } else {
        const batchEncoder = this.getBatchEncoder()
        plaintext = seal.PlainText()
        batchEncoder.encode(data, plaintext)

        ciphertext = seal.CipherText()
        encryptor.encrypt(plaintext, ciphertext)

        plaintext.delete() // Release plaintext

        const result = seal.CipherText()
        result.copy(ciphertext)
        ciphertext.delete() // Release intermediate ciphertext

        return result
      }
    } catch (error: unknown) {
      logger.error('Encryption failed', { error })
      throw new Error(
        `Encryption failed: ${error instanceof Error ? String(error) : String(error)}`,
        { cause: error },
      )
    }
  }

  /**
   * Decrypt data
   *
   * @param ciphertext Encrypted ciphertext
   * @returns Decrypted data
   */
  public async decrypt(ciphertext: SealCipherText): Promise<number[]> {
    this.checkKeysGenerated()

    try {
      const seal = this.getSeal()
      const decryptor = this.getDecryptor() // Use getter
      const plaintext = seal.PlainText()

      decryptor.decrypt(ciphertext, plaintext)

      let result: number[]
      if (this.schemeType === SealSchemeType.CKKS) {
        const ckksEncoder = this.getCKKSEncoder()
        result = Array.from(ckksEncoder.decode(plaintext))
      } else {
        const batchEncoder = this.getBatchEncoder()
        result = Array.from(batchEncoder.decode(plaintext))
      }

      plaintext.delete() // Release plaintext
      return result
    } catch (error: unknown) {
      logger.error('Decryption failed', { error })
      throw new Error(
        `Decryption failed: ${error instanceof Error ? String(error) : String(error)}`,
        { cause: error },
      )
    }
  }

  /**
   * Serialize the current keys
   *
   * @param options Serialization options
   * @returns Serialized keys
   */
  public async serializeKeys(
    options?: SealSerializationOptions,
  ): Promise<ExtendedSerializedSealKeys> {
    this.checkKeysGenerated()

    const seal = this.getSeal()
    const compressionMode =
      seal.ComprModeType[options?.compression ? 'zstd' : 'none']

    // Ensure keys are not null before calling save
    if (
      !this.publicKey ||
      !this.secretKey ||
      !this.relinKeys ||
      !this.galoisKeys
    ) {
      throw new Error(
        'Attempted to serialize null keys. This should not happen if checkKeysGenerated passed.',
      )
    }

    return {
      publicKey: this.publicKey.save(compressionMode),
      secretKey: this.secretKey.save(compressionMode),
      relinKeys: this.relinKeys.save(compressionMode),
      galoisKeys: this.galoisKeys.save(compressionMode),
      schemeType: this.schemeType,
      parameters: this.sealContext!.getEncryptionParameters(),
    }
  }

  /**
   * Deserialize and load keys
   *
   * @param serializedKeys Serialized keys
   */
  public async loadKeys(serializedKeys: SerializedSealKeys): Promise<void> {
    this.checkInitialized()

    const seal = this.getSeal()
    const context = this.getContext()

    try {
      this.releaseKeys()

      // Load Secret Key (assuming it's always present)
      this.secretKey = this.memoryManager.track(seal.SecretKey(), 'secretKey')
      if (serializedKeys.secretKey) {
        this.secretKey.load(context, serializedKeys.secretKey)
      } else {
        // This case should ideally not happen if secretKey is mandatory
        throw new Error('Serialized secret key is missing.')
      }

      // Load Public Key (assuming it's always present)
      this.publicKey = this.memoryManager.track(seal.PublicKey(), 'publicKey')
      if (serializedKeys.publicKey) {
        this.publicKey.load(context, serializedKeys.publicKey)
      } else {
        // This case should ideally not happen if publicKey is mandatory
        throw new Error('Serialized public key is missing.')
      }

      this.encryptor = this.memoryManager.track(
        seal.Encryptor(context, this.publicKey),
        'encryptor',
      )

      this.decryptor = this.memoryManager.track(
        seal.Decryptor(context, this.secretKey),
        'decryptor',
      )

      if (serializedKeys.relinKeys) {
        this.relinKeys = this.memoryManager.track(seal.RelinKeys(), 'relinKeys')
        this.relinKeys.load(context, serializedKeys.relinKeys)
      }

      if (serializedKeys.galoisKeys) {
        this.galoisKeys = this.memoryManager.track(
          seal.GaloisKeys(),
          'galoisKeys',
        )
        this.galoisKeys.load(context, serializedKeys.galoisKeys)
      }

      this.keyGenerated = true
      logger.info('SEAL keys loaded successfully')
    } catch (error: unknown) {
      logger.error('Failed to load SEAL keys', { error })
      throw new Error(
        `Key loading failed: ${error instanceof Error ? String(error) : String(error)}`,
        { cause: error },
      )
    }
  }

  /**
   * Check if the service is initialized
   */
  private checkInitialized() {
    if (!this.initialized || !this.sealContext) {
      throw new Error('SEAL service not initialized. Call initialize() first.')
    }
  }

  /**
   * Check if keys have been generated
   */
  private checkKeysGenerated() {
    this.checkInitialized()
    if (!this.keyGenerated || !this.secretKey || !this.publicKey) {
      // RelinKeys and GaloisKeys might be optional depending on operations,
      // but secretKey and publicKey are essential for basic encryption/decryption.
      throw new Error(
        'SEAL keys not generated/loaded. Call generateKeys() or loadKeys() first.',
      )
    }
  }

  /**
   * Dispose of all SEAL resources
   */
  public dispose() {
    logger.info('Disposing SEAL service')

    this.releaseKeys() // Releases keyGenerator, secretKey, publicKey, relinKeys, galoisKeys, encryptor, decryptor

    if (this.batchEncoder) {
      this.memoryManager.release(this.batchEncoder, 'batchEncoder')
      this.batchEncoder = null
    }
    if (this.ckksEncoder) {
      this.memoryManager.release(this.ckksEncoder, 'ckksEncoder')
      this.ckksEncoder = null
    }
    if (this.evaluator) {
      this.memoryManager.release(this.evaluator, 'evaluator')
      this.evaluator = null
    }

    // SealContext itself might need to be tracked by memoryManager if it has a delete method
    // or memoryManager should handle SealContext's disposal differently.
    // For now, assuming SealContext handles its own WASM object lifecycles via its dispose method.
    this.memoryManager.releaseAll() // Catch-all for any other tracked objects

    if (this.sealContext) {
      this.sealContext.dispose()
      this.sealContext = null
    }

    this.initialized = false
    this.keyGenerated = false
  }
}
