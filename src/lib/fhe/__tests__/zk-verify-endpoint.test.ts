import { describe, it, expect, beforeEach } from 'vitest'
import { ZKProofService, resetZKProofService } from '../zk-proof-service'
import type { ZKProofArtifact } from '../zk-proof-service'

/**
 * Tests for ZK proof verification endpoint logic (PIX-4069).
 *
 * These tests verify the ZKProofService.verifyProof() method that the
 * POST /api/v1/zk/verify endpoint delegates to. The endpoint itself
 * requires authentication middleware (protectRoute) which is tested
 * in the Playwright API security suite.
 */

describe('ZK Proof Verification — Endpoint Logic', () => {
  let service: ZKProofService

  beforeEach(() => {
    resetZKProofService()
    service = ZKProofService.getInstance()
  })

  it('verifies a valid proof with matching input/output hashes', async () => {
    const inputData = 'Patient session transcript text'
    const operationType = 'fhe-summarize'
    const outputData = 'Summary of patient session'

    const proof = await service.generateProof(
      inputData,
      operationType,
      outputData,
    )

    const valid = await service.verifyProof(
      proof,
      proof.publicInputHash,
      proof.publicOutputHash,
    )

    expect(valid).toBe(true)
  })

  it('rejects proof with mismatched input hash', async () => {
    const proof = await service.generateProof('input', 'op', 'output')

    const valid = await service.verifyProof(
      proof,
      '0000000000000000000000000000000000000000000000000000000000000000',
      proof.publicOutputHash,
    )

    expect(valid).toBe(false)
  })

  it('rejects proof with mismatched output hash', async () => {
    const proof = await service.generateProof('input', 'op', 'output')

    const valid = await service.verifyProof(
      proof,
      proof.publicInputHash,
      '0000000000000000000000000000000000000000000000000000000000000000',
    )

    expect(valid).toBe(false)
  })

  it('rejects proof with invalid proof format (not hex)', async () => {
    const proof = await service.generateProof('input', 'op', 'output')

    const invalidProof: ZKProofArtifact = {
      ...proof,
      proof: 'not-a-valid-hex-string',
    }

    const valid = await service.verifyProof(
      invalidProof,
      proof.publicInputHash,
      proof.publicOutputHash,
    )

    expect(valid).toBe(false)
  })

  it('rejects proof with invalid proof format (wrong length)', async () => {
    const proof = await service.generateProof('input', 'op', 'output')

    const invalidProof: ZKProofArtifact = {
      ...proof,
      proof: 'abc123',
    }

    const valid = await service.verifyProof(
      invalidProof,
      proof.publicInputHash,
      proof.publicOutputHash,
    )

    expect(valid).toBe(false)
  })

  it('rejects proof with invalid Merkle root format', async () => {
    const proof = await service.generateProof('input', 'op', 'output')

    const invalidProof: ZKProofArtifact = {
      ...proof,
      merkleRoot: 'invalid-merkle-root',
    }

    const valid = await service.verifyProof(
      invalidProof,
      proof.publicInputHash,
      proof.publicOutputHash,
    )

    expect(valid).toBe(false)
  })

  it('rejects proof with both mismatched hashes', async () => {
    const proof = await service.generateProof('input', 'op', 'output')

    const valid = await service.verifyProof(
      proof,
      'wrong-input-hash',
      'wrong-output-hash',
    )

    expect(valid).toBe(false)
  })

  it('verifies proofs for different operation types', async () => {
    const operations = [
      'fhe-summarize',
      'fhe-tokenize',
      'fhe-sentiment',
      'fhe-categorize',
    ]

    for (const op of operations) {
      const proof = await service.generateProof('test input', op, 'test output')
      const valid = await service.verifyProof(
        proof,
        proof.publicInputHash,
        proof.publicOutputHash,
      )
      expect(valid).toBe(true)
    }
  })

  it('verifies proof generated via wrapOperation', async () => {
    const mockFheCallback = async (
      _input: string,
      _op: unknown,
      _params?: Record<string, unknown>,
    ) => ({
      success: true,
      result: 'mock FHE result',
      operationType: 'fhe-summarize',
      timestamp: Date.now(),
      metadata: {},
    })

    const result = await service.wrapOperation(
      'test input',
      'SUMMARIZE' as never,
      { maxLength: 100 },
      mockFheCallback,
    )

    expect(result.zkProof).toBeDefined()
    expect(result.success).toBe(true)

    const valid = await service.verifyProof(
      result.zkProof,
      result.zkProof.publicInputHash,
      result.zkProof.publicOutputHash,
    )

    expect(valid).toBe(true)
  })

  it('proof artifact has all required fields for API submission', async () => {
    const proof = await service.generateProof(
      'input',
      'fhe-summarize',
      'output',
    )

    // Verify all fields the API endpoint expects
    expect(proof.proof).toMatch(/^[0-9a-f]{64}$/)
    expect(proof.publicInputHash).toMatch(/^[0-9a-f]{64}$/)
    expect(proof.publicOutputHash).toMatch(/^[0-9a-f]{64}$/)
    expect(proof.merkleRoot).toMatch(/^[0-9a-f]{64}$/)
    expect(proof.operationType).toBe('fhe-summarize')
    expect(proof.timestamp).toBeGreaterThan(0)
    expect(proof.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('round-trip: generate -> serialize -> deserialize -> verify', async () => {
    const proof = await service.generateProof(
      'round-trip test input',
      'fhe-summarize',
      'round-trip test output',
    )

    // Serialize to JSON (as the API would receive it)
    const serialized = JSON.stringify(proof)
    const deserialized = JSON.parse(serialized) as ZKProofArtifact

    const valid = await service.verifyProof(
      deserialized,
      deserialized.publicInputHash,
      deserialized.publicOutputHash,
    )

    expect(valid).toBe(true)
  })

  it('verification completes in < 100ms (meets <10s target with margin)', async () => {
    const proof = await service.generateProof('input', 'op', 'output')

    const start = performance.now()
    await service.verifyProof(
      proof,
      proof.publicInputHash,
      proof.publicOutputHash,
    )
    const duration = performance.now() - start

    expect(duration).toBeLessThan(100)
  })
})
