/**
 * FHE (Fully Homomorphic Encryption) Module
 *
 * Central barrel for the Fully Homomorphic Encryption subsystem.
 * The `fheService` singleton (RealFHEService / SEAL-backed) is the canonical
 * entry-point for all FHE operations across the platform.
 */


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
