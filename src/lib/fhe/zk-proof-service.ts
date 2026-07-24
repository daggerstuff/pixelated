import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { FHEOperation } from './types'
import type { HomomorphicOperationResult } from './types'
// Lazy import to keep `node:crypto`/`node:fs`/`node:child_process` (used only by the
// server-side SP1 prover) out of the client bundle. Statically importing
// sp1-prover here would drag Node builtins into @/lib/fhe (client-reachable).
import type { SP1Prover } from './sp1-prover'

let getSP1ProverPromise: Promise<() => SP1Prover> | null = null
function loadSP1Prover(): Promise<() => SP1Prover> {
  if (!getSP1ProverPromise) {
    getSP1ProverPromise = import('./sp1-prover').then((m) => m.getSP1Prover)
  }
  return getSP1ProverPromise
}

const logger = createBuildSafeLogger('zk-proof-service')

const subtle = globalThis.crypto.subtle

async function sha256(data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data)
  const hashBuffer = await subtle.digest('SHA-256', encoded)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Build a Merkle root from a list of leaf hashes.
 */
export async function buildMerkleRoot(leaves: string[]): Promise<string> {
  if (leaves.length === 0) return sha256('empty')
  if (leaves.length === 1) return leaves[0]

  const nextLevel: string[] = []
  for (let i = 0; i < leaves.length; i += 2) {
    const left = leaves[i]
    const right = i + 1 < leaves.length ? leaves[i + 1] : leaves[i]
    nextLevel.push(await sha256(`${left}${right}`))
  }
  return buildMerkleRoot(nextLevel)
}

/**
 * Generate a random salt for proof commitments.
 */
function generateSalt(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * ZK Proof artifact for data pipeline integrity.
 *
 * When SP1 is available, `proof` contains the SP1 zkVM proof bytes.
 * When SP1 is not available, `proofMode` is 'hash-commitment' and
 * `proof` contains a SHA-256 hash commitment (fallback).
 */
export interface ZKProofArtifact {
  /** SP1 proof bytes (hex) or hash-commitment proof (hex) */
  proof: string
  /** SHA-256 hash of the input data (public input to the proof) */
  publicInputHash: string
  /** SHA-256 hash of the output data (public input to the proof) */
  publicOutputHash: string
  /** Merkle root over all pipeline step commitments */
  merkleRoot: string
  /** FHE operation type that was proven */
  operationType: string
  /** Timestamp when proof was generated */
  timestamp: number
  /** Proof generation duration in milliseconds */
  durationMs: number
  /** Proof mode: 'sp1' for real ZK proofs, 'hash-commitment' for fallback */
  proofMode: 'sp1' | 'hash-commitment'
}

/**
 * Result of wrapping an FHE operation with ZK proof generation.
 */
export interface ZKProvenResult extends HomomorphicOperationResult {
  zkProof: ZKProofArtifact
}

/**
 * Callback type for FHE operations wrapped by ZKProofService.
 */
export type FHEOperationCallback = (
  inputData: string,
  operation: FHEOperation,
  params?: Record<string, unknown>,
) => Promise<HomomorphicOperationResult>

/**
 * ZKProofService - generates zero-knowledge proofs of data pipeline
 * integrity for FHE operations.
 *
 * Per ADR-0004, this service wraps FHE operations with ZK proofs:
 * - SP1 zkVM guest program verifies Merkle root construction
 * - Hash-commitment fallback when SP1 toolchain is not installed
 *
 * The SP1 guest program (sp1-guest/src/main.rs) proves:
 * 1. Input hash commitment matches the committed input
 * 2. The correct FHE operation was dispatched
 * 3. Output hash matches the expected derivation
 * 4. All intermediate step hashes form a valid Merkle tree
 */
export class ZKProofService {
  private static instance: ZKProofService | null = null

  private constructor() {
    // SP1 prover (Node-only) is loaded lazily on first use via loadSP1Prover()
    // so this client-reachable module never statically pulls node:crypto et al.
    logger.info('ZKProofService initialized (SP1 prover loads on first proof)')
  }

  static getInstance(): ZKProofService {
    if (!ZKProofService.instance) {
      ZKProofService.instance = new ZKProofService()
    }
    return ZKProofService.instance
  }

  static reset(): void {
    ZKProofService.instance = null
  }

  /**
   * Generate a ZK proof for a data pipeline integrity claim.
   *
   * Uses SP1 zkVM when available, falls back to hash-commitment mode.
   *
   * @param inputData - The pre-encryption plaintext input
   * @param operationType - The FHE operation type (e.g., "summarize")
   * @param outputData - The post-decryption output
   * @param pipelineSteps - Optional intermediate step hashes (default: single step)
   * @returns ZKProofArtifact containing the proof and public inputs
   */
  async generateProof(
    inputData: string,
    operationType: string,
    outputData: string,
    pipelineSteps?: string[],
  ): Promise<ZKProofArtifact> {
    const start = performance.now()

    // Step 1: Input/output hash commitments
    const inputHash = await sha256(inputData)
    const outputHash = await sha256(outputData)

    // Step 2: Build pipeline step commitments
    const salt = generateSalt()
    const steps = pipelineSteps ?? [
      await sha256(`${inputHash}|${operationType}|${salt}`),
    ]
    const outputStep = await sha256(`${outputHash}|${operationType}|${salt}`)
    steps.push(outputStep)

    // Step 3: Merkle root over all pipeline step commitments
    const merkleRoot = await buildMerkleRoot(steps)

    // Step 4: Delegate to SP1Prover (SP1 if available, hash-commitment fallback)
    const sp1Prover = (await loadSP1Prover())()
    const proofResult = await sp1Prover.prove({
      inputHash,
      outputHash,
      operationType,
      merkleRoot,
      stepHashes: steps,
    })

    const durationMs = performance.now() - start

    logger.debug(
      `Generated ZK proof (${proofResult.mode}) for operation ${operationType} in ${durationMs.toFixed(2)}ms`,
    )

    return {
      proof: proofResult.proof,
      publicInputHash: inputHash,
      publicOutputHash: outputHash,
      merkleRoot,
      operationType,
      timestamp: Date.now(),
      durationMs,
      proofMode: proofResult.mode,
    }
  }

  /**
   * Wrap an FHE operation with ZK proof generation.
   */
  async wrapOperation(
    inputData: string,
    operation: FHEOperation,
    params: Record<string, unknown> | undefined,
    fheCallback: FHEOperationCallback,
  ): Promise<ZKProvenResult> {
    logger.info(`Wrapping FHE operation ${operation} with ZK proof`)

    const fheResult = await fheCallback(inputData, operation, params)

    if (!fheResult.success) {
      throw new Error(
        `FHE operation ${operation} failed: ${fheResult.error ?? 'unknown error'}`,
      )
    }

    const zkProof = await this.generateProof(
      inputData,
      operation,
      fheResult.result ?? '',
    )

    return {
      ...fheResult,
      zkProof,
    }
  }

  /**
   * Verify a ZK proof artifact.
   *
   * Uses SP1 verifier when available, falls back to hash-commitment verification.
   *
   * @param proof - The ZK proof artifact to verify
   * @param expectedInputHash - Expected input hash (from the caller)
   * @param expectedOutputHash - Expected output hash (from the caller)
   * @returns True if the proof is valid
   */
  async verifyProof(
    proof: ZKProofArtifact,
    expectedInputHash: string,
    expectedOutputHash: string,
  ): Promise<boolean> {
    if (proof.publicInputHash !== expectedInputHash) {
      logger.warn('ZK proof verification failed: input hash mismatch')
      return false
    }
    if (proof.publicOutputHash !== expectedOutputHash) {
      logger.warn('ZK proof verification failed: output hash mismatch')
      return false
    }

    const sp1Prover = (await loadSP1Prover())()
    const mode = proof.proofMode ?? 'hash-commitment'
    const result = await sp1Prover.verify(
      proof.proof,
      expectedInputHash,
      expectedOutputHash,
      mode,
    )

    if (result.valid) {
      logger.debug(
        `ZK proof verified (${mode}) in ${result.verificationTimeMs.toFixed(2)}ms`,
      )
    } else {
      logger.warn(`ZK proof verification failed (${mode})`)
    }

    return result.valid
  }
}

/**
 * Get the singleton ZKProofService instance.
 */
export function getZKProofService(): ZKProofService {
  return ZKProofService.getInstance()
}

/**
 * Reset the ZKProofService singleton (for testing).
 */
export function resetZKProofService(): void {
  ZKProofService.reset()
}
