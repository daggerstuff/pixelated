import type {
  EncryptionMode,
  EncryptionOptions,
  HomomorphicOperationResult,
  TFHESecurityLevel,
  FHEKeys,
  FHEServiceInterface,
  EncryptedData,
} from '../fhe/types'
import { FHEOperation } from '../fhe/types'
import { create } from 'zustand'
import { getFHEService, FHEImplementation } from '../fhe/fhe-factory'
import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { KeyRotationService } from '../fhe/key-rotation'
import { SealSchemeType } from '../fhe/seal-types'
import type { SealContextOptions } from '../fhe/seal-types'
import { EncryptionMode as EncryptionModeEnum } from '../fhe/types'

// Initialize logger
const logger = createBuildSafeLogger('fhe-store')

// Default SEAL context options for production
const DEFAULT_SEAL_OPTIONS: SealContextOptions = {
  scheme: SealSchemeType.BFV,
  params: {
    polyModulusDegree: 8192,
    coeffModulusBits: [60, 40, 40, 40, 60],
    plainModulus: 1032193,
  },
}

interface FHEState {
  // State
  isInitialized: boolean
  encryptionMode: EncryptionMode
  keyId: string | null
  encryptionStatus: 'inactive' | 'initializing' | 'active' | 'error'
  lastError: Error | null
  securityLevel: TFHESecurityLevel
  performanceMetrics: {
    lastEncryptionTime: number
    lastDecryptionTime: number
    lastOperationTime: number
    averageEncryptionTime: number
    averageDecryptionTime: number
    averageOperationTime: number
    totalOperations: number
  }

  // Actions
  initializeFHE: (options: EncryptionOptions) => Promise<void>
  encrypt: (message: string) => Promise<string>
  decrypt: (encryptedMessage: string) => Promise<string>
  processEncrypted: (
    encryptedMessage: string,
    operation: FHEOperation,
    params?: Record<string, unknown>,
  ) => Promise<HomomorphicOperationResult>
  exportPublicKey: () => Promise<string | null>
  clearState: () => void
  setKeyId: (keyId: string | null) => void
  rotateKeys: () => Promise<void>
}

export const useFHEStore = create<FHEState>()((set, get) => {
  // Private FHE service instance
  let fheService: FHEServiceInterface | null = null
  let operationCount = 0
  let totalEncryptionTime = 0
  let totalDecryptionTime = 0
  let totalOperationTime = 0

  // Initialize key rotation service
  const keyRotationService = KeyRotationService.getInstance()

  // Listen for key rotation events to keep store in sync
  keyRotationService.on('key-rotated', ({ keyId }) => {
    set({ keyId })
    logger.info('Key rotation event received, updated keyId', { keyId })
  })

  const store: FHEState = {
    // Initial state
    isInitialized: false,
    encryptionMode: EncryptionModeEnum.NONE,
    keyId: null,
    encryptionStatus: 'inactive',
    lastError: null,
    securityLevel: 192,
    performanceMetrics: {
      lastEncryptionTime: 0,
      lastDecryptionTime: 0,
      lastOperationTime: 0,
      averageEncryptionTime: 0,
      averageDecryptionTime: 0,
      averageOperationTime: 0,
      totalOperations: 0,
    },

    // Initialize FHE
    initializeFHE: async (options: EncryptionOptions) => {
      try {
        set({ encryptionStatus: 'initializing' })
        logger.info('Initializing FHE service...', { options })

        const startTime = performance.now()

        // Get production FHE service instance
        fheService = (await getFHEService({
          implementation: FHEImplementation.SEAL,
          useEncryption: true,
          requiredOperations: [
            FHEOperation.Addition,
            FHEOperation.Multiplication,
            FHEOperation.Polynomial,
          ],
        })) as FHEServiceInterface

        // Initialize with SEAL options
        await fheService.initialize({
          ...options,
          sealOptions: DEFAULT_SEAL_OPTIONS,
          securityLevel: options.securityLevel || 'hipaa',
        })

        const endTime = performance.now()

        // Initialize key rotation service
        await keyRotationService.initialize({
          rotationPeriodMs: 30 * 24 * 60 * 60 * 1000,
          storagePrefix: 'seal_key_',
        })

        // Get or generate key ID
        const keyId = await keyRotationService.getActiveKeyId()

        set({
          isInitialized: true,
          encryptionMode: options.mode || EncryptionModeEnum.FHE,
          encryptionStatus: 'active',
          securityLevel:
            typeof options.securityLevel === 'number'
              ? options.securityLevel
              : 192,
          keyId,
          performanceMetrics: {
            ...get().performanceMetrics,
            lastEncryptionTime: endTime - startTime,
          },
        })

        logger.info('FHE service initialized successfully', {
          mode: options.mode,
          keyId,
          initTime: endTime - startTime,
        })
      } catch (error: unknown) {
        logger.error('FHE initialization error:', { error })
        set({
          encryptionStatus: 'error',
          lastError: error instanceof Error ? error : new Error(String(error)),
        })
        throw error
      }
    },

    // Encrypt a message
    encrypt: async (message: string) => {
      if (!get().isInitialized || !fheService) {
        throw new Error('FHE service not initialized')
      }

      try {
        const startTime = performance.now()

        // Validate input
        if (!message || typeof message !== 'string') {
          throw new Error('Invalid message format')
        }

        // Perform encryption
        const encrypted = await fheService.encrypt(message)
        const encryptedStr =
          typeof encrypted === 'string' ? encrypted : JSON.stringify(encrypted)

        const endTime = performance.now()
        const encryptionTime = endTime - startTime

        // Update metrics
        operationCount++
        totalEncryptionTime += encryptionTime

        set({
          performanceMetrics: {
            ...get().performanceMetrics,
            lastEncryptionTime: encryptionTime,
            averageEncryptionTime: totalEncryptionTime / operationCount,
            totalOperations: operationCount,
          },
        })

        return encryptedStr
      } catch (error: unknown) {
        logger.error('FHE encryption error:', { error })
        set({
          lastError: error instanceof Error ? error : new Error(String(error)),
        })
        throw error
      }
    },

    // Decrypt a message
    decrypt: async (encryptedMessage: string) => {
      if (!get().isInitialized || !fheService) {
        throw new Error('FHE service not initialized')
      }

      try {
        const startTime = performance.now()

        // Validate input
        if (!encryptedMessage) {
          throw new Error('Invalid encrypted message')
        }

        // Parse encrypted data if needed
        const encryptedData =
          typeof encryptedMessage === 'string' &&
          encryptedMessage.startsWith('{')
            ? isEncryptedData(JSON.parse(encryptedMessage) as unknown)
              ? (JSON.parse(encryptedMessage) as unknown)
              : { id: '', data: null, dataType: 'object' }
            : isEncryptedData(encryptedMessage)
              ? encryptedMessage
              : { id: '', data: null, dataType: 'object' }

        // Perform decryption
        const decrypted = await fheService.decrypt(encryptedData)
        const decryptedStr =
          typeof decrypted === 'string' ? decrypted : JSON.stringify(decrypted)

        const endTime = performance.now()
        const decryptionTime = endTime - startTime

        // Update metrics
        operationCount++
        totalDecryptionTime += decryptionTime

        set({
          performanceMetrics: {
            ...get().performanceMetrics,
            lastDecryptionTime: decryptionTime,
            averageDecryptionTime: totalDecryptionTime / operationCount,
            totalOperations: operationCount,
          },
        })

        return decryptedStr
      } catch (error: unknown) {
        logger.error('FHE decryption error:', { error })
        set({
          lastError: error instanceof Error ? error : new Error(String(error)),
        })
        throw error
      }
    },

    // Process encrypted data
    processEncrypted: async (
      encryptedMessage: string,
      operation: FHEOperation,
      params?: Record<string, unknown>,
    ) => {
      if (!get().isInitialized || !fheService) {
        throw new Error('FHE service not initialized')
      }

      if (get().encryptionMode !== EncryptionModeEnum.FHE) {
        throw new Error('Homomorphic operations require FHE mode')
      }

      try {
        const startTime = performance.now()

        // Validate operation support
        if (!fheService.scheme.supportsOperation(operation)) {
          throw new Error(`Operation ${operation} not supported`)
        }

        // Process the encrypted data using appropriate method
        let result: HomomorphicOperationResult

        if ('processEncrypted' in fheService && fheService.processEncrypted) {
          result = await fheService.processEncrypted(
            encryptedMessage,
            operation,
            params,
          )
        } else {
          // Fallback to individual operation methods
          const encryptedData =
            typeof encryptedMessage === 'string' &&
            encryptedMessage.startsWith('{')
              ? isEncryptedData(JSON.parse(encryptedMessage) as unknown)
                ? (JSON.parse(encryptedMessage) as unknown)
                : { id: '', data: null, dataType: 'object' }
              : isEncryptedData(encryptedMessage)
                ? encryptedMessage
                : { id: '', data: null, dataType: 'object' }

          let processedData: unknown
          switch (operation) {
            case FHEOperation.Addition:
              if ('add' in fheService && fheService.add && params?.['value']) {
                processedData = await fheService.add(
                  encryptedData,
                  params['value'] as EncryptedData<unknown>,
                )
              }
              break
            case FHEOperation.Multiplication:
              if (
                'multiply' in fheService &&
                fheService.multiply &&
                params?.['value']
              ) {
                processedData = await fheService.multiply(
                  encryptedData,
                  params['value'] as EncryptedData<unknown>,
                )
              }
              break
            default:
              throw new Error(`Operation ${operation} not implemented`)
          }

          result = {
            success: true,
            result: JSON.stringify(processedData),
            operationType: String(operation),
            timestamp: Date.now(),
          }
        }

        const endTime = performance.now()
        const operationTime = endTime - startTime

        // Update metrics
        operationCount++
        totalOperationTime += operationTime

        set({
          performanceMetrics: {
            ...get().performanceMetrics,
            lastOperationTime: operationTime,
            averageOperationTime: totalOperationTime / operationCount,
            totalOperations: operationCount,
          },
        })

        return result
      } catch (error: unknown) {
        logger.error(`FHE operation ${operation} error:`, { error, params })
        set({
          lastError: error instanceof Error ? error : new Error(String(error)),
        })
        throw error
      }
    },

    // Export public key
    exportPublicKey: async () => {
      if (!get().isInitialized || !fheService) {
        return null
      }

      try {
        const keys: FHEKeys = await fheService.generateKeys()
        logger.info('Keys generated successfully')

        // Extract public key from FHEKeys
        return typeof keys === 'string'
          ? keys
          : JSON.stringify({
              keyId: keys.keyId,
              createdAt: keys.createdAt,
              scheme: keys.scheme,
              status: keys.status,
            })
      } catch (error: unknown) {
        logger.error('FHE public key export error:', { error })
        set({
          lastError: error instanceof Error ? error : new Error(String(error)),
        })
        return null
      }
    },

    clearState: () => {
      fheService = null
      operationCount = 0
      totalEncryptionTime = 0
      totalDecryptionTime = 0
      totalOperationTime = 0

      set({
        isInitialized: false,
        encryptionMode: EncryptionModeEnum.NONE,
        keyId: null,
        encryptionStatus: 'inactive',
        lastError: null,
        performanceMetrics: {
          lastEncryptionTime: 0,
          lastDecryptionTime: 0,
          lastOperationTime: 0,
          averageEncryptionTime: 0,
          averageDecryptionTime: 0,
          averageOperationTime: 0,
          totalOperations: 0,
        },
      })

      logger.info('FHE state cleared')
    },

    setKeyId: (keyId: string | null) => {
      set({ keyId })
      logger.info('Key ID updated', { keyId })
    },

    rotateKeys: async () => {
      if (!get().isInitialized || !fheService) {
        throw new Error('FHE service not initialized')
      }

      try {
        logger.info('Starting key rotation...')

        // Generate new keys using the service
        await fheService.rotateKeys()

        // Get the new key ID
        const newKeyId = await keyRotationService.getActiveKeyId()

        // Update key ID
        set({ keyId: newKeyId })

        logger.info('Key rotation completed successfully', { keyId: newKeyId })
      } catch (error: unknown) {
        logger.error('Key rotation failed:', { error })
        set({
          lastError: error instanceof Error ? error : new Error(String(error)),
        })
        throw error
      }
    },
  }

  return store
})
