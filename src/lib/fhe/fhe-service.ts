/**
 * Real FHE Service Implementation
 * 
 * This file provides the real implementation of the FHE service interface
 * that delegates to the homomorphic operations module.
 */

import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { EncryptionMode, FHEOperation } from './types'
import type { 
  FHEService, 
  FHEScheme,
  FHEOperationResult, 
  EncryptedData,
  FHEConfig,
  FHEKeys
} from './types'
import homomorphicOps from './homomorphic-ops'
import { SealService } from './seal-service'
import { SealSchemeType } from './seal-types'
import { SealResourceScope } from './seal-memory'
import type { SealCipherText } from './seal-service'

const logger = createBuildSafeLogger('fhe-service')

/**
 * Real implementation of FHEService that uses the SEAL-based homomorphic operations
 */
export class RealFHEService implements FHEService {
  private initialized = false
  private initPromise: Promise<void> | null = null
  public readonly scheme: FHEScheme = {
    name: 'Pixelated-FHE-BFV',
    version: '1.0.0',
    getOperations(): FHEOperation[] {
      return Object.values(FHEOperation)
    },
    supportsOperation(operation: FHEOperation): boolean {
      return Object.values(FHEOperation).includes(operation)
    },
  }
  
  /**
   * Initialize the FHE service
   */
  public async initialize(options?: any): Promise<void> {
    if (this.initialized) return
    if (this.initPromise) return this.initPromise

    this.initPromise = (async () => {
      try {
        await homomorphicOps.initialize(options)
        this.initialized = true
        logger.info('Real FHE service initialized')
      } catch (error) {
        logger.error('Failed to initialize Real FHE service', { error })
        this.initPromise = null // Allow retry
        throw error
      }
    })()

    return this.initPromise
  }

  /**
   * Check if the service is initialized
   */
  public isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Generate encryption keys
   */
  public async generateKeys(config?: FHEConfig): Promise<FHEKeys> {
    await this.ensureInitialized()
    if (config) {
      logger.info('Generating FHE keys with configuration', { config })
    }
    // Future: Delegate to homomorphicOps for real key generation
    return {
      keyId: (config as any)?.keyId?.toString() || 'default-' + Date.now(),
      createdAt: new Date(),
      scheme: (config as any)?.scheme || 'BFV',
      status: 'active'
    } as FHEKeys
  }

  /**
   * Encrypt data
   */
  public async encrypt<T>(value: T, options?: any): Promise<EncryptedData> {
    await this.ensureInitialized()
    
    // Create a memory scope for safe resource tracking
    const scope = new SealResourceScope()
    
    try {
      const sealService = SealService.getInstance()
      
      // 1. Encode value to number[]
      const dataToEncrypt = this.encodeValue(value)
      
      // 2. Encrypt
      const ciphertext = scope.track(await sealService.encrypt(dataToEncrypt))
      
      // 3. Serialize
      const serialized = (ciphertext as any).save()
      
      return {
        id: 'enc-' + Date.now(),
        data: serialized,
        dataType: typeof value as any,
        metadata: {
          encryptedAt: Date.now(),
          mode: EncryptionMode.FHE,
          scheme: sealService.getSchemeType()
        }
      }
    } catch (error: unknown) {
      logger.error('Encryption failed in RealFHEService', { error })
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      // Ensure all resources are released
      scope.releaseAll()
    }
  }

  /**
   * Decrypt data
   */
  public async decrypt<T>(encryptedData: EncryptedData, options?: any): Promise<T> {
    await this.ensureInitialized()
    
    // Create a memory scope for safe resource tracking
    const scope = new SealResourceScope()
    
    try {
      const sealService = SealService.getInstance()
      const seal = sealService.getSeal()
      const context = sealService.getContext()
      
      // 1. Re-create SealCipherText instance and load data
      const ciphertext = scope.track(seal.CipherText()) as any
      ciphertext.load(context, encryptedData.data)
      
      // 2. Decrypt
      const decryptedNumbers = await sealService.decrypt(ciphertext)
      
      // 3. Decode number[] back to T
      const result = this.decodeValue<T>(decryptedNumbers, encryptedData.dataType)
      return result
    } catch (error: unknown) {
      logger.error('Decryption failed in RealFHEService', { error })
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      // Ensure all resources are released
      scope.releaseAll()
    }
  }

  /**
   * Process encrypted data by delegating to homomorphicOps
   */
  public async processEncrypted<T = string>(
    encryptedData: string,
    operation: FHEOperation | string,
    params?: Record<string, unknown>,
  ): Promise<FHEOperationResult<T>> {
    const op = typeof operation === 'string' ? operation as FHEOperation : operation
    try {
      await this.ensureInitialized()
      logger.info(`Processing encrypted data with operation: ${op}`)

      const result = await homomorphicOps.processEncrypted(
        encryptedData,
        op,
        EncryptionMode.FHE,
        params,
      )

      if (result.success) {
        return {
          success: true,
          result: result.result as T,
          operation: op,
          timestamp: result.timestamp || Date.now(),
          metadata: result.metadata,
        }
      } else {
        return {
          success: false,
          error: result.error || 'Unknown error in homomorphic processing',
          operation: op,
          timestamp: result.timestamp || Date.now(),
          metadata: result.metadata,
        }
      }
    } catch (error: unknown) {
      logger.error('Error in RealFHEService.processEncrypted', {
        operation: op,
        error: error instanceof Error ? error.message : String(error),
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        operation: op,
        timestamp: Date.now(),
        metadata: {
          error: true,
          timestamp: Date.now(),
        },
      }
    }
  }
  
  /**
   * Dispose of resources
   */
  public async dispose(): Promise<void> {
    logger.info('Disposing FHE Service resources')
    this.initialized = false
    this.initPromise = null
    // Future: homomorphicOps.dispose() if implemented
  }
  
  /**
   * Rotate encryption keys
   */
  public async rotateKeys(): Promise<void> {
    await this.ensureInitialized()
    logger.info('Rotating FHE keys')
  }
  
  /**
   * Get the current encryption mode
   */
  public getMode(): EncryptionMode {
    return EncryptionMode.FHE
  }
  
  /**
   * Convenience method to encrypt and return as a string
   */
  public async encryptData(data: unknown): Promise<string> {
    const encrypted = await this.encrypt(data)
    return JSON.stringify(encrypted)
  }

  /**
   * Check if a specific operation is supported
   */
  public supportsOperation(operation: FHEOperation): boolean {
    return this.scheme.supportsOperation(operation)
  }

  /**
   * Helper to encode any supported type into a number array for FHE
   */
  private encodeValue(value: any): number[] {
    if (typeof value === 'number') {
      return [value]
    }
    
    if (typeof value === 'string') {
      // Convert string to array of char codes
      return value.split('').map(c => c.charCodeAt(0))
    }
    
    if (typeof value === 'boolean') {
      return [value ? 1 : 0]
    }
    
    if (Array.isArray(value)) {
      // If it's already an array, try to use it if it's numbers, 
      // otherwise stringify first
      if (value.every(v => typeof v === 'number')) {
        return value
      }
    }
    
    // Fallback: JSON stringify and convert to codes
    const json = JSON.stringify(value)
    return json.split('').map(c => c.charCodeAt(0))
  }

  /**
   * Helper to decode a number array back to the original type
   */
  private decodeValue<T>(data: number[], dataType: string): T {
    if (dataType === 'number') {
      return data[0] as unknown as T
    }
    
    if (dataType === 'boolean') {
      return (data[0] !== 0) as unknown as T
    }
    
    if (dataType === 'string') {
      return String.fromCharCode(...data) as unknown as T
    }
    
    if (dataType === 'object' || dataType === 'array') {
      try {
        const json = String.fromCharCode(...data)
        return JSON.parse(json) as T
      } catch (err) {
        logger.warn('Failed to parse decrypted JSON, returning as char codes', { err })
        return data as unknown as T
      }
    }
    
    return data as unknown as T
  }

  /**
   * Helper to ensure the service is initialized
   */
  public async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }
  }

  /**
   * Get the current encryption mode (alias for getMode for backward compatibility)
   */
  public getEncryptionMode(): EncryptionMode {
    return this.getMode()
  }
  
  /**
   * Check if service is initialized
   */
  private checkInitialized() {
    if (!this.initialized) {
      throw new Error('Real FHE service not initialized. Call initialize() first.')
    }
  }
}

// Export a singleton instance
export const realFHEService = new RealFHEService()
