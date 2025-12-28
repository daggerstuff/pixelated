/**
 * Unified export file for FHE functionality
 */

// FHE service entry point - exports all required types and functions
// for use in the application

import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { FHEAnalyticsService } from './analytics'
// Main FHE service instance
// Import core services
import { HomomorphicOperations } from './homomorphic-ops'
import { KeyRotationService } from './key-rotation'
import { EncryptionMode, FHEOperation } from './types'

// Initialize logger for PHI audit logging
const logger = createBuildSafeLogger('phi-audit')

// Log access to FHE module containing potential PHI encryption operations for HIPAA compliance
logger.info('FHE exports module accessed', {
  dataType: 'encryption-operations',
  action: 'module-access',
  component: 'fhe/exports.ts',
  containsPHI: true,
})

// Export the main FHE service instance
export { fheService } from './index'

// SEAL implementation exports
export { SealContext } from './seal-context'
export { SealService } from './seal-service'
export { SealOperations } from './seal-operations'
export { SealSchemeType } from './seal-types'

// Export helper functions for testing
export { testSEALIntegration } from './test-seal-integration'

// Re-export classes
export { FHEAnalyticsService, HomomorphicOperations, KeyRotationService }

// Initialization functions
export async function initializeHomomorphicOps(): Promise<void> {
  const homomorphicOps = HomomorphicOperations.getInstance()
  await homomorphicOps.initialize()
}

export async function initializeKeyRotation(): Promise<void> {
  const keyRotation = KeyRotationService.getInstance()
  await keyRotation.initialize()
}

export async function initializeFHEAnalytics(): Promise<void> {
  const analytics = FHEAnalyticsService.getInstance()
  await analytics.initialize()
}

/**
 * Create a preconfigured FHE service with specific settings
 *
 * @param mode The encryption mode to use
 * @param securityLevel The security level to use
 * @returns An initialized FHE service
 */
export async function createFHEService(
  mode: EncryptionMode = EncryptionMode.FHE,
  securityLevel: string = 'high',
): Promise<unknown> {
  const { fheService } = await import('./index')

  await fheService.initialize({
    mode,
    securityLevel,
    keySize: securityLevel === 'high' ? 4096 : 2048,
  })

  return fheService
}

// Export the FHEService class
export { FHEService } from './index'

// Re-export types explicitly to avoid ambiguity
export type {
  EncryptionOptions,
  FHEConfig,
  HomomorphicOperationResult,
  TFHEContext,
} from './types'

// Re-export enums
export { EncryptionMode, FHEOperation }
