/**
 * Enhanced FHE Service
 *
 * This module provides an enhanced version of the FHE service with additional
 * capabilities like caching, logging, and error handling.
 */

import type {
  FHEOperation,
  FHEService,
  FHEServiceOptions,
  FHEConfig,
  EncryptedData,
} from './types'
import { EncryptionMode } from './types'
import { MockFHEService } from './mock/mock-fhe-service'
import { createBuildSafeLogger } from '../logging/build-safe-logger'

const logger = createBuildSafeLogger('enhanced-fhe')

/**
 * Interface for enhanced FHE service that extends the base FHE service
 */
export interface EnhancedFHEService extends FHEService {
  // Additional methods for enhanced service
  clearCache(): Promise<void>
  getStats(): Record<string, number>
}

/**
 * Create an enhanced FHE service with additional capabilities
 */
export function createEnhancedFHEService(
  config?: Record<string, unknown>,
): EnhancedFHEService {
  const options: FHEServiceOptions = {
    mode: EncryptionMode.NONE,
    useMock: true,
    ...config,
  }

  logger.info('Creating enhanced FHE service', { mode: options.mode })

  // Create base service - using mock implementation for now
  const baseService = new MockFHEService()

  // Stats tracking
  const stats = {
    encryptCount: 0,
    decryptCount: 0,
    operationCount: 0,
    errorCount: 0,
  }

  // Create enhanced service with additional capabilities
  const enhancedService: EnhancedFHEService = {
    // Pass through base service properties
    scheme: baseService.scheme,

    // Enhanced initialize method with logging
    async initialize(options?: unknown): Promise<void | boolean> {
      logger.info('Initializing enhanced FHE service')
      try {
        return await baseService.initialize(options)
      } catch (error: unknown) {
        logger.error('Failed to initialize FHE service', { error })
        stats.errorCount++
        throw error
      }
    },

    // Pass through with stats tracking
    generateKeys: async (config?: FHEConfig | undefined) => {
      try {
        return await baseService.generateKeys(config)
      } catch (error: unknown) {
        stats.errorCount++
        throw error
      }
    },

    isInitialized: () => baseService.isInitialized(),

    supportsOperation: (operation: FHEOperation) =>
      baseService.supportsOperation(operation),

    // Enhanced encrypt with stats tracking
    async encrypt<T>(
      value: T,
      options?: unknown,
    ): Promise<EncryptedData<unknown>> {
      try {
        stats.encryptCount++
        return await baseService.encrypt(value, options)
      } catch (error: unknown) {
        stats.errorCount++
        logger.error('Encryption failed', { error })
        throw error
      }
    },

    // Enhanced decrypt with stats tracking
    async decrypt<T>(
      encryptedData: EncryptedData<unknown>,
      options?: unknown,
    ): Promise<T> {
      try {
        stats.decryptCount++
        return await baseService.decrypt(encryptedData, options)
      } catch (error: unknown) {
        stats.errorCount++
        logger.error('Decryption failed', { error })
        throw error
      }
    },

    // Additional methods specific to enhanced service
    clearCache: async (): Promise<void> => {
      logger.info('Clearing FHE service cache')
      return Promise.resolve()
    },

    getStats: (): Record<string, number> => ({ ...stats }),
  }

  // Add operation methods if available on base service
  if (baseService.processEncrypted) {
    enhancedService.processEncrypted = async (
      encryptedData: string,
      operation: FHEOperation | string,
      params?: Record<string, unknown>,
    ): Promise<unknown> => {
      try {
        stats.operationCount++
        logger.debug('Processing encrypted data', { operation })
        return await baseService.processEncrypted!(
          encryptedData,
          operation,
          params,
        )
      } catch (error: unknown) {
        stats.errorCount++
        logger.error('Processing failed', { operation, error })
        throw error
      }
    }
  }

  return enhancedService
}
