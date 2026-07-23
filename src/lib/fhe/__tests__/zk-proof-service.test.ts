import { describe, it, expect, beforeEach } from 'vitest'
import { FHEOperation } from '../types'
import {
  ZKProofService,
  getZKProofService,
  resetZKProofService,
} from '../zk-proof-service'
import type { HomomorphicOperationResult } from '../types'

/**
 * ZKProofService Tests — PIX-4068
 *
 * Tests the ZK proof generation and verification for FHE data pipeline
 * integrity. Per ADR-0004, the proof covers hash-commitment of inputs,
 * operation dispatch verification, and output derivation.
 */

const subtle = globalThis.crypto.subtle

async function sha256(data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data)
  const hashBuffer = await subtle.digest('SHA-256', encoded)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

describe('ZKProofService', () => {
  let service: ZKProofService

  beforeEach(() => {
    resetZKProofService()
    service = getZKProofService()
  })

  describe('generateProof', () => {
    it('generates a valid proof artifact for summarize operation', async () => {
      const input = 'Patient reports feeling anxious in social situations.'
      const output = 'Patient reports feeling anxious.'
      const proof = await service.generateProof(input, 'summarize', output)

      expect(proof.proof).toMatch(/^[0-9a-f]{64}$/)
      expect(proof.publicInputHash).toMatch(/^[0-9a-f]{64}$/)
      expect(proof.publicOutputHash).toMatch(/^[0-9a-f]{64}$/)
      expect(proof.merkleRoot).toMatch(/^[0-9a-f]{64}$/)
      expect(proof.operationType).toBe('summarize')
      expect(proof.timestamp).toBeGreaterThan(0)
      expect(proof.durationMs).toBeGreaterThanOrEqual(0)
    })

    it('generates proof in < 10 seconds (PIX-4068 AC)', async () => {
      const input = 'x'.repeat(100000)
      const output = 'summary result'
      const proof = await service.generateProof(input, 'summarize', output)

      expect(proof.durationMs).toBeLessThan(10000)
    })

    it('generates proof in < 5 seconds for typical payloads', async () => {
      const input = 'Patient session notes for therapy appointment.'
      const output = 'Therapy session notes summary.'
      const proof = await service.generateProof(input, 'summarize', output)

      expect(proof.durationMs).toBeLessThan(5000)
    })

    it('proof is deterministic for same input and output', async () => {
      const input = 'Test input data'
      const output = 'Test output data'

      const proof1 = await service.generateProof(input, 'summarize', output)
      const proof2 = await service.generateProof(input, 'summarize', output)

      expect(proof1.publicInputHash).toBe(proof2.publicInputHash)
      expect(proof1.publicOutputHash).toBe(proof2.publicOutputHash)
    })

    it('proof changes when input changes', async () => {
      const proof1 = await service.generateProof(
        'input A',
        'summarize',
        'output',
      )
      const proof2 = await service.generateProof(
        'input B',
        'summarize',
        'output',
      )

      expect(proof1.publicInputHash).not.toBe(proof2.publicInputHash)
      expect(proof1.proof).not.toBe(proof2.proof)
    })

    it('proof changes when output changes', async () => {
      const proof1 = await service.generateProof(
        'input',
        'summarize',
        'output A',
      )
      const proof2 = await service.generateProof(
        'input',
        'summarize',
        'output B',
      )

      expect(proof1.publicOutputHash).not.toBe(proof2.publicOutputHash)
      expect(proof1.proof).not.toBe(proof2.proof)
    })

    it('proof changes when operation type changes', async () => {
      const proof1 = await service.generateProof('input', 'summarize', 'output')
      const proof2 = await service.generateProof('input', 'sentiment', 'output')

      expect(proof1.operationType).not.toBe(proof2.operationType)
      expect(proof1.proof).not.toBe(proof2.proof)
    })

    it('handles empty input (edge case)', async () => {
      const proof = await service.generateProof('', 'summarize', 'output')

      expect(proof.proof).toMatch(/^[0-9a-f]{64}$/)
      expect(proof.publicInputHash).toMatch(/^[0-9a-f]{64}$/)
    })

    it('handles empty output (edge case)', async () => {
      const proof = await service.generateProof('input', 'summarize', '')

      expect(proof.proof).toMatch(/^[0-9a-f]{64}$/)
      expect(proof.publicOutputHash).toMatch(/^[0-9a-f]{64}$/)
    })

    it('handles large input (100KB)', async () => {
      const input = 'x'.repeat(100000)
      const output = 'summary'
      const proof = await service.generateProof(input, 'summarize', output)

      expect(proof.proof).toMatch(/^[0-9a-f]{64}$/)
      expect(proof.durationMs).toBeLessThan(5000)
    })

    it('accepts custom pipeline steps', async () => {
      const input = 'test input'
      const output = 'test output'
      const steps = [
        await sha256('step-1-hash'),
        await sha256('step-2-hash'),
        await sha256('step-3-hash'),
      ]
      const proof = await service.generateProof(
        input,
        'summarize',
        output,
        steps,
      )

      expect(proof.proof).toMatch(/^[0-9a-f]{64}$/)
      expect(proof.merkleRoot).toMatch(/^[0-9a-f]{64}$/)
    })
  })

  describe('wrapOperation', () => {
    it('wraps an FHE operation and returns result with ZK proof', async () => {
      const inputData = 'Patient feels anxious during therapy.'
      const mockResult: HomomorphicOperationResult = {
        success: true,
        result: 'Patient feels anxious.',
        operationType: 'summarize',
        timestamp: Date.now(),
        metadata: { simulated: true },
      }
      const callback = async () => mockResult

      const result = await service.wrapOperation(
        inputData,
        FHEOperation.SUMMARIZE,
        { maxLength: 100 },
        callback,
      )

      expect(result.success).toBe(true)
      expect(result.result).toBe('Patient feels anxious.')
      expect(result.zkProof).toBeDefined()
      expect(result.zkProof.proof).toMatch(/^[0-9a-f]{64}$/)
      expect(result.zkProof.operationType).toBe('summarize')
    })

    it('throws when FHE operation fails', async () => {
      const mockResult: HomomorphicOperationResult = {
        success: false,
        error: 'FHE operation failed',
        operationType: 'summarize',
        timestamp: Date.now(),
      }
      const callback = async () => mockResult

      await expect(
        service.wrapOperation('input', FHEOperation.SUMMARIZE, {}, callback),
      ).rejects.toThrow('FHE operation summarize failed')
    })

    it('wraps operation in < 10 seconds total (PIX-4068 AC)', async () => {
      const inputData = 'x'.repeat(50000)
      const mockResult: HomomorphicOperationResult = {
        success: true,
        result: 'summary of large input',
        operationType: 'summarize',
        timestamp: Date.now(),
      }
      const callback = async () => mockResult

      const start = performance.now()
      const result = await service.wrapOperation(
        inputData,
        FHEOperation.SUMMARIZE,
        {},
        callback,
      )
      const totalMs = performance.now() - start

      expect(totalMs).toBeLessThan(10000)
      expect(result.zkProof.durationMs).toBeLessThan(10000)
    })

    it('passes correct arguments to FHE callback', async () => {
      let capturedInput: string | undefined
      let capturedOp: FHEOperation | undefined
      let capturedParams: Record<string, unknown> | undefined

      const callback = async (
        input: string,
        op: FHEOperation,
        params?: Record<string, unknown>,
      ) => {
        capturedInput = input
        capturedOp = op
        capturedParams = params
        return {
          success: true,
          result: 'result',
          operationType: 'summarize',
          timestamp: Date.now(),
        } as HomomorphicOperationResult
      }

      await service.wrapOperation(
        'test input',
        FHEOperation.SUMMARIZE,
        { maxLength: 50 },
        callback,
      )

      expect(capturedInput).toBe('test input')
      expect(capturedOp).toBe(FHEOperation.SUMMARIZE)
      expect(capturedParams).toEqual({ maxLength: 50 })
    })
  })

  describe('verifyProof', () => {
    it('verifies a valid proof with matching hashes', async () => {
      const input = 'test input'
      const output = 'test output'
      const proof = await service.generateProof(input, 'summarize', output)

      const expectedInputHash = await sha256(input)
      const expectedOutputHash = await sha256(output)

      const valid = await service.verifyProof(
        proof,
        expectedInputHash,
        expectedOutputHash,
      )
      expect(valid).toBe(true)
    })

    it('rejects proof with mismatched input hash', async () => {
      const proof = await service.generateProof('input', 'summarize', 'output')

      const valid = await service.verifyProof(
        proof,
        'wrong-hash',
        proof.publicOutputHash,
      )
      expect(valid).toBe(false)
    })

    it('rejects proof with mismatched output hash', async () => {
      const proof = await service.generateProof('input', 'summarize', 'output')

      const valid = await service.verifyProof(
        proof,
        proof.publicInputHash,
        'wrong-hash',
      )
      expect(valid).toBe(false)
    })

    it('rejects proof with invalid proof format', async () => {
      const proof = await service.generateProof('input', 'summarize', 'output')

      const invalidProof = {
        ...proof,
        proof: 'not-a-valid-hash',
      }

      const valid = await service.verifyProof(
        invalidProof,
        proof.publicInputHash,
        proof.publicOutputHash,
      )
      expect(valid).toBe(false)
    })

    it('rejects proof with invalid Merkle root format', async () => {
      const proof = await service.generateProof('input', 'summarize', 'output')

      const invalidProof = {
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
  })

  describe('singleton', () => {
    it('returns the same instance', () => {
      const a = getZKProofService()
      const b = getZKProofService()
      expect(a).toBe(b)
    })

    it('reset creates a new instance', () => {
      const a = getZKProofService()
      resetZKProofService()
      const b = getZKProofService()
      expect(a).not.toBe(b)
    })
  })
})
