/**
 * FHE (Fully Homomorphic Encryption) Module
 *
 * This module provides implementation for Fully Homomorphic Encryption operations.
 * NOTE: This is a basic implementation for testing purposes.
 *
 * In production, this should be replaced with a proper FHE library implementation.
 */

import type { CryptoSystem } from '../crypto/index'
import { createBuildSafeLogger } from '../logging/build-safe-logger'

const logger = createBuildSafeLogger('fhe')

/** FHE system implementation */

export interface FHESystem {
  encrypt: (data: string) => Promise<string>
  decrypt: (encryptedData: string) => Promise<string>
  verifySender: (
    senderId: string,
    authorizedSenders: string[],
  ) => Promise<boolean>
  processEncrypted: (
    data: string,
    operation: string,
  ) => Promise<{
    success: boolean
    metadata: { operation: string; [key: string]: unknown }
  }>
}

interface FHEOptions {
  keyId?: string
  version?: string
  namespace?: string
  crypto?: CryptoSystem
}

export function createFHESystem(options: FHEOptions = {}): FHESystem {
  const keyId = options.keyId ?? 'default'
  const version = options.version ?? '1.0'
  const namespace = options.namespace ?? 'default'

  logger.info(`Creating FHE system with namespace: ${namespace}`)

  return {
    async encrypt(data: string): Promise<string> {
      logger.debug(`Encrypting data with FHE, keyId: ${keyId}`)
      return `test-fhe:v1:${data}`
    },

    async decrypt(encryptedData: string): Promise<string> {
      logger.debug(`Decrypting FHE data`)
      const parts = encryptedData.split(':')
      const lastPart = parts[parts.length - 1]
      return lastPart ?? ''
    },

    async verifySender(
      senderId: string,
      authorizedSenders: string[],
    ): Promise<boolean> {
      logger.debug(`Verifying sender: ${senderId}`)
      return authorizedSenders.includes(senderId)
    },

    async processEncrypted(
      _data: string,
      operation: string,
    ): Promise<{
      success: boolean
      metadata: { operation: string; [key: string]: unknown }
    }> {
      logger.debug(`Processing encrypted data with operation: ${operation}`)
      return {
        success: true,
        metadata: {
          operation,
          timestamp: Date.now(),
          version,
        },
      }
    },
  }
}

export type { FHEService, FHEOperationResult, EncryptedData } from './types'
export { FHEOperation } from './types'
export { RealFHEService, realFHEService as fheService } from './fhe-service'
export { FHEEmotionClassifier } from './fhe-emotion-classifier'
export { createEmotionClassifierFHEService } from './fhe-emotion-classifier'
export type {
  ZKProofArtifact,
  ZKProvenResult,
  FHEOperationCallback,
} from './zk-proof-service'

// sp1-prover exports removed from barrel — it uses node:crypto and must not
// be pulled into the client bundle. SSR-only consumers import directly:
//   import { getSP1Prover } from '@/lib/fhe/sp1-prover'
export type {
  ProofMode,
  SP1ProofRequest,
  SP1ProofResult,
  SP1VerifyResult,
} from './sp1-prover'

// zk-proof-service is also SSR-only — it transitively imports sp1-prover and
// therefore node:crypto / node:child_process / node:fs / node:path, none of
// which Vite can polyfill for the client bundle. Keep it OUT of the barrel so
// no client-reachable module pulls it in. SSR-only consumers import directly:
//   import { getZKProofService } from '@/lib/fhe/zk-proof-service'
//   import { ZKProofService }      from '@/lib/fhe/zk-proof-service'
//   import { resetZKProofService } from '@/lib/fhe/zk-proof-service'
// (Currently the sole SSR consumer is src/pages/api/v1/zk/verify.ts.)

export {
  EncryptedTextProcessor,
  getEncryptedTextProcessor,
  resetEncryptedTextProcessor,
} from './encrypted-text-processor'
