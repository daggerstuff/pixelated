/**
 * FHE Factory Service
 *
 * This module provides a factory for creating and managing Fully Homomorphic Encryption (FHE)
 * service instances. It supports multiple implementations, including development mocks
 * and production-ready implementations using the Microsoft SEAL library.
 */

import { createBuildSafeLogger } from '../logging/build-safe-logger'
import type { FHEOperation } from './types'
import type {
  FHEConfig,
  FHEService,
  EncryptedData,
  Polynomial,
  FHEKeys,
  TenantConfig,
} from './types'
import { mockFHEService } from './mock/mock-fhe-service'
import { SealService } from './seal-service'
import { SealScheme } from './seal-scheme'
import { SealSchemeType } from './seal-types'
import { SealOperations } from './seal-operations'

// Add version to mock scheme
if (
  mockFHEService &&
  typeof mockFHEService.scheme === 'object' &&
  mockFHEService.scheme !== null
) {
  ;(mockFHEService.scheme as { version?: string }).version = '1.0.0'
} else {
  // Optionally log a warning or handle the case where scheme is not as expected
  console.warn(
    '[fhe-factory] mockFHEService.scheme is not an object, cannot set version.',
  )
}

// Initialize logger
const logger = createBuildSafeLogger('fhe-factory')

// Initialize SEAL service singleton
const sealService = SealService.getInstance()
const sealOperations = new SealOperations(sealService)
const sealScheme = new SealScheme(SealSchemeType.BFV)

// Initialize tenant service instances map and default service instance
const tenantServiceInstances = new Map<string, FHEService>()
let defaultServiceInstance: FHEService | null = null

// Initialize tenant manager (placeholder - actual implementation would be more complex)
const tenantManager = {
  getTenant: (tenantId: string) => {
    // Simplified implementation - using string type to allow dynamic values
    return { tenantId, isolationLevel: 'shared' as string }
  },
  registerTenant: async (config: {
    tenantId: string
    isolationLevel: string
    metadata: Record<string, unknown>
  }) => {
    // Simplified implementation
    logger.info(`Registered tenant ${config.tenantId}`)
    return true
  },
  setupTenantResources: async (
    tenantId: string,
    keyId: string,
    _context: Record<string, unknown>,
  ) => {
    // Simplified implementation
    logger.info(`Set up resources for tenant ${tenantId} with key ${keyId}`)
    return true
  },
  trackOperation: (_tenantId: string) => {
    // Simplified implementation for rate limiting
    return true
  },
}

/**
 * SEAL FHE Service adapter
 * This wraps the SealService to implement the FHEService interface with correct types
 */
const sealFHEService: FHEService = {
  scheme: sealScheme,

  async initialize(): Promise<void> {
    try {
      await sealService.initialize()
    } catch (error: unknown) {
      logger.error('Failed to initialize SEAL FHE service', { error })
      throw error
    }
  },

  isInitialized(): boolean {
    // Check if service has been initialized by checking if the singleton has expected properties
    return Boolean(sealService && sealService.getContext)
  },

  supportsOperation(operation: FHEOperation): boolean {
    return sealScheme.supportsOperation(operation)
  },

  async generateKeys(_config?: FHEConfig): Promise<FHEKeys> {
    try {
      await sealService.generateKeys()
      return {
        keyId: 'seal-keys',
        createdAt: new Date(),
        scheme: 'SEAL',
        status: 'active',
      }
    } catch (error: unknown) {
      logger.error('Failed to generate SEAL keys', { error })
      throw error
    }
  },

  async encrypt<T>(
    data: T,
    _options?: unknown,
  ): Promise<EncryptedData<unknown>> {
    try {
      if (
        !Array.isArray(data) ||
        !data.every((item) => typeof item === 'number')
      ) {
        throw new Error('SEAL encryption requires a number array input')
      }
      const encrypted = await sealService.encrypt(data as number[])
      return createEncryptedData(encrypted, data as number[])
    } catch (error: unknown) {
      logger.error('SEAL encryption failed', { error })
      throw error
    }
  },

  async decrypt<T>(
    encryptedData: EncryptedData<unknown>,
    _options?: unknown,
  ): Promise<T> {
    try {
      // Extract serializedCiphertext from metadata if available
      const ciphertext =
        encryptedData.metadata?.serializedCiphertext ||
        (encryptedData.data as string)

      if (!ciphertext) {
        throw new Error('Invalid encrypted data: missing ciphertext')
      }

      return (await sealService.decrypt(ciphertext)) as T
    } catch (error: unknown) {
      logger.error('SEAL decryption failed', { error })
      throw error
    }
  },

  async add(
    a: EncryptedData<unknown>,
    b: EncryptedData<unknown> | number,
  ): Promise<EncryptedData<unknown>> {
    try {
      // Handle scalar (number) addition
      if (typeof b === 'number') {
        throw new Error('Scalar addition not yet implemented')
      }

      // Extract serializedCiphertext from metadata if available
      const aCiphertext = a.metadata?.serializedCiphertext || (a.data as string)
      const bCiphertext = b.metadata?.serializedCiphertext || (b.data as string)

      if (!aCiphertext || !bCiphertext) {
        throw new Error('Invalid encrypted data: missing ciphertext')
      }

      const result = await sealOperations.add(
        aCiphertext as string,
        bCiphertext as string,
      )

      if (!result.success) {
        throw new Error(result.error || 'Addition operation failed')
      }

      return createEncryptedData(result.result)
    } catch (error: unknown) {
      logger.error('SEAL addition failed', { error })
      throw error
    }
  },

  async subtract(
    a: EncryptedData<unknown>,
    b: EncryptedData<unknown> | number,
  ): Promise<EncryptedData<unknown>> {
    try {
      // Handle scalar (number) subtraction
      if (typeof b === 'number') {
        throw new Error('Scalar subtraction not yet implemented')
      }

      // Extract serializedCiphertext from metadata if available
      const aCiphertext = a.metadata?.serializedCiphertext || (a.data as string)
      const bCiphertext = b.metadata?.serializedCiphertext || (b.data as string)

      if (!aCiphertext || !bCiphertext) {
        throw new Error('Invalid encrypted data: missing ciphertext')
      }

      const result = await sealOperations.subtract(
        aCiphertext as string,
        bCiphertext as string,
      )

      if (!result.success) {
        throw new Error(result.error || 'Subtraction operation failed')
      }

      return createEncryptedData(result.result)
    } catch (error: unknown) {
      logger.error('SEAL subtraction failed', { error })
      throw error
    }
  },

  async multiply(
    a: EncryptedData<unknown>,
    b: EncryptedData<unknown> | number,
  ): Promise<EncryptedData<unknown>> {
    try {
      // Handle scalar (number) multiplication
      if (typeof b === 'number') {
        throw new Error('Scalar multiplication not yet implemented')
      }

      // Extract serializedCiphertext from metadata if available
      const aCiphertext = a.metadata?.serializedCiphertext || (a.data as string)
      const bCiphertext = b.metadata?.serializedCiphertext || (b.data as string)

      if (!aCiphertext || !bCiphertext) {
        throw new Error('Invalid encrypted data: missing ciphertext')
      }

      const result = await sealOperations.multiply(
        aCiphertext as string,
        bCiphertext as string,
      )

      if (!result.success) {
        throw new Error(result.error || 'Multiplication operation failed')
      }

      return createEncryptedData(result.result)
    } catch (error: unknown) {
      logger.error('SEAL multiplication failed', { error })
      throw error
    }
  },

  async negate(value: EncryptedData<unknown>): Promise<EncryptedData<unknown>> {
    try {
      // Extract serializedCiphertext from metadata if available
      const ciphertext =
        value.metadata?.serializedCiphertext || (value.data as string)

      if (!ciphertext) {
        throw new Error('Invalid encrypted data: missing ciphertext')
      }

      const result = await sealOperations.negate(ciphertext)

      if (!result.success) {
        throw new Error(result.error || 'Negation operation failed')
      }

      return createEncryptedData(result.result)
    } catch (error: unknown) {
      logger.error('SEAL negation failed', { error })
      throw error
    }
  },

  async applyPolynomial(
    value: EncryptedData<unknown>,
    coefficients: Polynomial,
  ): Promise<EncryptedData<unknown>> {
    try {
      // Extract serializedCiphertext from metadata if available
      const ciphertext =
        value.metadata?.serializedCiphertext || (value.data as string)

      if (!ciphertext) {
        throw new Error('Invalid encrypted data: missing ciphertext')
      }

      const result = await sealOperations.polynomial(ciphertext, coefficients)

      if (!result.success) {
        throw new Error(result.error || 'Polynomial operation failed')
      }

      return createEncryptedData(result.result)
    } catch (error: unknown) {
      logger.error('SEAL polynomial failed', { error })
      throw error
    }
  },

  async rotate(
    vector: EncryptedData<unknown>,
    steps: number,
  ): Promise<EncryptedData<unknown>> {
    try {
      // Extract serializedCiphertext from metadata if available
      const ciphertext =
        vector.metadata?.serializedCiphertext || (vector.data as string)

      if (!ciphertext) {
        throw new Error('Invalid encrypted data: missing ciphertext')
      }

      const result = await sealOperations.rotate(ciphertext, steps)

      if (!result.success) {
        throw new Error(result.error || 'Rotation operation failed')
      }

      return createEncryptedData(result.result)
    } catch (error: unknown) {
      logger.error('SEAL rotation failed', { error })
      throw error
    }
  },
}

/**
 * Helper function to create an EncryptedData object from a SEAL ciphertext
 */
function createEncryptedData(
  serializedCiphertext: string,
  originalData?: number[],
): EncryptedData<unknown> {
  return {
    id: `seal-encrypted-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
    data: serializedCiphertext,
    dataType: 'array', // Add the missing dataType property
    metadata: {
      scheme: 'SEAL',
      length: originalData?.length,
      serializedCiphertext, // Keep the serializedCiphertext in metadata for compatibility
    },
  }
}

// FHE factory configuration
export enum FHEImplementation {
  Auto = 'auto',
  Mock = 'mock',
  SEAL = 'seal',
  TFHE = 'tfhe', // Placeholder for future implementation
}

interface FHEFactoryOptions {
  implementation?: FHEImplementation
  requiredOperations?: FHEOperation[]
  useEncryption?: boolean // When false, always uses mock regardless of environment
  tenantConfig?: TenantConfig // Add tenant configuration to the interface
}

/**
 * Get the appropriate FHE service implementation based on environment and requirements
 */
export async function getFHEService(
  options: FHEFactoryOptions = {},
): Promise<FHEService> {
  const {
    implementation = FHEImplementation.Auto,
    requiredOperations = [],
    useEncryption = process.env['NODE_ENV'] === 'production',
    tenantConfig,
  } = options

  // Check if this is a tenant-specific request
  if (tenantConfig?.tenantId) {
    return getTenantFHEService(tenantConfig.tenantId, options)
  }

  // For non-tenant specific requests, use the standard logic
  const isDevelopment =
    typeof window !== 'undefined' ||
    (typeof process !== 'undefined' &&
      (process.env as unknown as { NODE_ENV?: string })?.['NODE_ENV'] ===
        'development')

  // Determine which implementation to use
  let selectedImplementation: FHEImplementation

  if (implementation === FHEImplementation.Auto) {
    // In dev or when encryption is disabled, use mock
    if (isDevelopment || !useEncryption) {
      selectedImplementation = FHEImplementation.Mock
    } else {
      // In production, use SEAL by default
      selectedImplementation = FHEImplementation.SEAL
    }
  } else {
    // Use explicitly requested implementation
    selectedImplementation = implementation
  }

  logger.info(
    `Selected FHE implementation: ${selectedImplementation}${
      useEncryption ? '' : ' (encryption disabled)'
    }`,
  )

  // Create or get the service based on selected implementation
  switch (selectedImplementation) {
    case FHEImplementation.Mock:
      logger.info('Using mock FHE service')
      if (requiredOperations.length > 0) {
        // Check if mock supports all required operations
        const unsupportedOps = requiredOperations.filter(
          (op) => !mockFHEService.supportsOperation(op),
        )
        if (unsupportedOps.length > 0) {
          logger.warn(
            `Mock FHE service does not support operations: ${unsupportedOps.join(
              ', ',
            )}`,
          )
        }
      }
      // Use type assertion to ensure compatibility with FHEService interface
      return mockFHEService as FHEService

    case FHEImplementation.SEAL:
      logger.info('Using SEAL FHE service')
      return sealFHEService

    // Placeholder for future implementation
    case FHEImplementation.TFHE:
      logger.warn('TFHE implementation not yet available, using SEAL instead')
      return sealFHEService

    default:
      throw new Error(`Unknown FHE implementation: ${selectedImplementation}`)
  }
}

/**
 * Get a tenant-specific FHE service
 * Creates or retrieves a dedicated service instance for the specified tenant
 */
export async function getTenantFHEService(
  tenantId: string,
  options: FHEFactoryOptions = {},
): Promise<FHEService> {
  // Check if we already have a service instance for this tenant
  if (tenantServiceInstances.has(tenantId)) {
    logger.info(`Using existing FHE service for tenant ${tenantId}`)
    return tenantServiceInstances.get(tenantId)!
  }

  // Get tenant configuration
  const tenant = tenantManager.getTenant(tenantId)
  if (!tenant) {
    logger.warn(
      `Tenant ${tenantId} not registered, registering with default configuration`,
    )

    // Auto-register tenant with default configuration
    await tenantManager.registerTenant({
      tenantId,
      isolationLevel: 'shared', // Default to shared isolation
      metadata: {
        autoRegistered: true,
        registeredAt: Date.now(),
      },
    })
  }

  // For "dedicated" isolation, we need to create a unique service instance
  if (tenant && tenant.isolationLevel === 'dedicated') {
    logger.info(`Creating dedicated FHE service for tenant ${tenantId}`)

    // Create a dedicated service instance
    const baseService = await getFHEService({
      ...options,
      tenantConfig: undefined, // Prevent infinite recursion
    })

    // Create a tenant-specific wrapper with isolated context
    const tenantService: FHEService = {
      ...baseService,
      // Override initialize to set up tenant-specific resources
      initialize: async (config?: FHEConfig): Promise<void> => {
        await baseService.initialize(config)

        // Generate tenant-specific keys if needed
        const keys = await baseService.generateKeys()

        // Set up tenant-specific resources
        await tenantManager.setupTenantResources(tenantId, keys.keyId, {
          /* tenant-specific context */
        })

        logger.info(
          `Tenant ${tenantId} FHE service initialized with dedicated resources`,
        )
      },
    }

    // Store the service instance for future use
    tenantServiceInstances.set(tenantId, tenantService)
    return tenantService
  }

  // For shared isolation, we can use the base service with tenant context
  logger.info(`Using shared FHE service for tenant ${tenantId}`)
  const baseService = await getFHEService({
    ...options,
    tenantConfig: undefined, // Prevent infinite recursion
  })

  // Create a tenant-aware wrapper around the base service
  const tenantService: FHEService = {
    ...baseService,

    // Override encrypt to use tenant-specific context
    encrypt: async <T>(
      data: T,
      options?: unknown,
    ): Promise<EncryptedData<unknown>> => {
      // Track operation for rate limiting
      if (!tenantManager.trackOperation(tenantId)) {
        throw new Error(`Rate limit exceeded for tenant ${tenantId}`)
      }

      // Add tenant ID to the metadata
      const result = await baseService.encrypt(data, options)

      if (result && typeof result === 'object') {
        result.metadata = {
          ...result.metadata,
          tenantId,
        }
      }

      return result
    },

    // Override decrypt to verify tenant ownership
    decrypt: async <T>(
      encryptedData: EncryptedData<unknown>,
      options?: unknown,
    ): Promise<T> => {
      // Verify tenant ownership if metadata contains tenant ID
      if (
        encryptedData &&
        encryptedData.metadata &&
        encryptedData.metadata.tenantId &&
        encryptedData.metadata.tenantId !== tenantId
      ) {
        logger.warn(
          `Tenant ${tenantId} attempted to decrypt data owned by tenant ${encryptedData.metadata.tenantId}`,
        )
        throw new Error(
          'Access denied: cannot decrypt data from another tenant',
        )
      }

      return baseService.decrypt<T>(encryptedData, options)
    },
  }

  // Cache the service instance
  tenantServiceInstances.set(tenantId, tenantService)
  return tenantService
}

/**
 * Get the default FHE service for the current environment
 */
export async function getDefaultFHEService(): Promise<FHEService> {
  if (!defaultServiceInstance) {
    defaultServiceInstance = await getFHEService()
  }
  return defaultServiceInstance
}

/**
 * Initialize the FHE services
 * This can be called at application startup to pre-initialize services
 */
export async function initializeFHEServices(): Promise<void> {
  try {
    logger.info('Initializing FHE services')

    // Initialize mock service
    if (!mockFHEService.isInitialized()) {
      await mockFHEService.initialize()
      logger.info('Mock FHE service initialized successfully')
    }

    // Initialize SEAL service
    if (!sealFHEService.isInitialized()) {
      await sealFHEService.initialize()
      logger.info('SEAL FHE service initialized successfully')
    }
  } catch (error: unknown) {
    logger.error('Failed to initialize FHE services', { error })
    throw error
  }
}
