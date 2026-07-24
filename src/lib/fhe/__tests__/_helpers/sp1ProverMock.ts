/**
 * @file src/lib/fhe/__tests__/_helpers/sp1ProverMock.ts
 *
 * Single source of truth for the `vi.mock('../sp1-prover', ...)` factory used
 * by FHE ZK tests that need to keep `node:crypto` / `node:child_process` /
 * `node:fs` / `node:path` out of the jsdom test sandbox.
 *
 * Usage from a jsdom-env test file (the default vitest project here):
 *
 *   import { sp1ProverMock } from './_helpers/sp1ProverMock'
 *   // ⚠️ Wrap in an inline arrow thunk — passing the helper directly
 *   // (vi.mock(path, sp1ProverMock)) triggers a TDZ ReferenceError because
 *   // vitest's transformer lowers function args to internal `__vi_import_X__`
 *   // bindings that aren't initialized at hoisted-eval time.
 *   vi.mock('../sp1-prover', () => sp1ProverMock())
 *
 * Tests that want the real sp1-prover (e.g., to exercise hash-commitment
 * fallback against real SHA-256) should declare `@vitest-environment node`
 * at the top of the file instead and skip this mock entirely — see
 * zk-proof-service.test.ts and zk-verify-endpoint.test.ts for examples.
 *
 * The previous form of this mock was duplicated inline in three test files
 * (the integration test plus the two that ran in jsdom before the env-tag
 * fix). Consolidating here removes the DRY violation documented in CLAUDE.md
 * ("Code Reuse: Always reuse helper functions, components, classes, etc.",
 * whenever possible).
 */

type ProveRequest = {
  inputHash: string
  outputHash: string
  operationType: string
  merkleRoot: string
  stepHashes: string[]
}

type ProveResult = {
  proof: string
  mode: 'hash-commitment'
  publicInputs: {
    inputHash: string
    outputHash: string
    merkleRoot: string
    operationType: string
  }
  proofSizeBytes: number
  generationTimeMs: number
}

type VerifyResult = {
  valid: boolean
  mode: 'hash-commitment'
  verificationTimeMs: number
}

const mockProve = async (req: ProveRequest): Promise<ProveResult> => ({
  proof: 'a'.repeat(64),
  mode: 'hash-commitment',
  publicInputs: {
    inputHash: req.inputHash,
    outputHash: req.outputHash,
    merkleRoot: req.merkleRoot,
    operationType: req.operationType,
  },
  proofSizeBytes: 32,
  generationTimeMs: 1.5,
})

const mockVerify = async (
  _proof: string,
  _expectedInputHash: string,
  _expectedOutputHash: string,
): Promise<VerifyResult> => ({
  valid: true,
  mode: 'hash-commitment',
  verificationTimeMs: 0.5,
})

const mockProverInstance = {
  isSP1Available: () => false,
  getProofMode: () => 'hash-commitment' as const,
  prove: mockProve,
  verify: mockVerify,
}

/**
 * Vitest factory usable as `vi.mock('../sp1-prover', sp1ProverMock)`.
 * Returns a deterministic hash-commitment stub that satisfies every call
 * shape the real SP1Prover / getSP1Prover / resetSP1Prover exports expose.
 *
 * The stub deliberately returns constant values (`'a'.repeat(64)` for proof,
 * `valid: true` for verification) — this trades cryptographic realism for
 * deterministic, environment-independent behavior. Any test asserting on
 * real-SHA256 / SP1 properties must run with `@vitest-environment node`.
 */
export function sp1ProverMock() {
  return {
    SP1Prover: class SP1ProverMock {
      isSP1Available = mockProverInstance.isSP1Available
      getProofMode = mockProverInstance.getProofMode
      prove = mockProve
      verify = mockVerify
    },
    getSP1Prover: () => mockProverInstance,
    resetSP1Prover: () => {},
  }
}
