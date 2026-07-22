import { describe, it, expect } from 'vitest'

/**
 * ZK Proof Benchmark Harness — PIX-4067
 *
 * Measures hash-commitment proof generation time for the data pipeline
 * integrity claim documented in ADR-0004.
 *
 * The benchmark simulates:
 * 1. Input hash commitment (SHA-256 of pre-encryption plaintext)
 * 2. Operation dispatch verification (hash of operation ID + parameters)
 * 3. Output derivation (SHA-256 of input_hash || operation_id || salt)
 * 4. Merkle root construction over intermediate step hashes
 *
 * Target: < 5 seconds total for all payload sizes
 */

// Use global crypto (Web Crypto API, available in Node 18+ and jsdom)
const subtle = globalThis.crypto.subtle

async function sha256(data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data)
  const hashBuffer = await subtle.digest('SHA-256', encoded)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate a hash commitment for a single pipeline step.
 * This is what the SP1 guest program would prove:
 *   output_hash == SHA256(input_hash || operation_id || salt)
 */
async function generateCommitment(
  inputHash: string,
  operationId: string,
  salt: string,
): Promise<string> {
  const combined = `${inputHash}|${operationId}|${salt}`
  return sha256(combined)
}

/**
 * Build a Merkle root from a list of leaf hashes.
 * Used to commit to the entire pipeline (all intermediate steps).
 */
async function buildMerkleRoot(leaves: string[]): Promise<string> {
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
 * Simulate a full proof generation cycle:
 * 1. Hash input payload
 * 2. Generate commitments for each pipeline step
 * 3. Build Merkle root
 * 4. Return proof artifact
 */
async function generateProof(
  payload: string,
  operationId: string,
  numSteps: number,
): Promise<{ proofHash: string; durationMs: number }> {
  const start = performance.now()

  // Step 1: Input hash commitment
  const inputHash = await sha256(payload)

  // Step 2: Generate commitments for each pipeline step
  const salt = crypto.getRandomValues(new Uint8Array(32)).join('')
  const commitments: string[] = []
  let currentHash = inputHash
  for (let i = 0; i < numSteps; i++) {
    const stepOpId = `${operationId}-step-${i}`
    currentHash = await generateCommitment(currentHash, stepOpId, salt)
    commitments.push(currentHash)
  }

  // Step 3: Merkle root over all step commitments
  const merkleRoot = await buildMerkleRoot(commitments)

  // Step 4: Final proof hash (this would be the SP1 proof public output)
  const proofHash = await sha256(`${merkleRoot}|${inputHash}|${salt}`)

  const end = performance.now()
  return { proofHash, durationMs: end - start }
}

/**
 * Generate payloads of various sizes.
 */
function generatePayload(sizeBytes: number): string {
  const base = 'The patient reports feeling anxious during social situations. '
  const repeats = Math.ceil(sizeBytes / base.length)
  return base.repeat(repeats).slice(0, sizeBytes)
}

describe('ZK Proof Benchmark — Hash Commitment Proof Generation', () => {
  // Payload sizes to benchmark
  const payloadSizes = [
    { name: '1 KB', bytes: 1024 },
    { name: '10 KB', bytes: 10240 },
    { name: '100 KB', bytes: 102400 },
    { name: '1 MB', bytes: 1048576 },
  ]

  // Number of pipeline steps per proof (simulates multi-step FHE operations)
  const numSteps = 8

  payloadSizes.forEach(({ name, bytes }) => {
    it(`generates proof for ${name} payload in < 5 seconds`, async () => {
      const payload = generatePayload(bytes)
      const { proofHash, durationMs } = await generateProof(
        payload,
        'fhe-summarize',
        numSteps,
      )

      // Proof must be a valid 64-char hex string
      expect(proofHash).toMatch(/^[0-9a-f]{64}$/)

      // Must meet sub-5s target
      expect(durationMs).toBeLessThan(5000)

      // Log for documentation (visible in test output)
      console.log(
        `  [${name}] proof=${proofHash.slice(0, 16)}... duration=${durationMs.toFixed(2)}ms`,
      )
    })
  })

  it('generates proofs for all payload sizes in < 5 seconds total', async () => {
    const start = performance.now()

    for (const { bytes } of payloadSizes) {
      const payload = generatePayload(bytes)
      await generateProof(payload, 'fhe-summarize', numSteps)
    }

    const totalMs = performance.now() - start
    expect(totalMs).toBeLessThan(5000)
    console.log(`  [ALL] total=${totalMs.toFixed(2)}ms`)
  })

  it('proof is deterministic for same input + salt', async () => {
    const payload = generatePayload(1024)
    const salt = 'fixed-salt-for-determinism-test'

    // Run twice with same inputs (same salt, same payload, same op)
    const inputHash = await sha256(payload)
    const commitment1 = await generateCommitment(
      inputHash,
      'fhe-summarize',
      salt,
    )
    const commitment2 = await generateCommitment(
      inputHash,
      'fhe-summarize',
      salt,
    )

    expect(commitment1).toBe(commitment2)
  })

  it('proof changes when input changes', async () => {
    const payload1 = generatePayload(1024)
    const payload2 = generatePayload(1024) + 'modified'
    const salt = 'same-salt'

    const hash1 = await sha256(payload1)
    const hash2 = await sha256(payload2)
    const commitment1 = await generateCommitment(hash1, 'fhe-summarize', salt)
    const commitment2 = await generateCommitment(hash2, 'fhe-summarize', salt)

    expect(commitment1).not.toBe(commitment2)
  })

  it('proof changes when operation changes', async () => {
    const payload = generatePayload(1024)
    const salt = 'same-salt'

    const inputHash = await sha256(payload)
    const commitment1 = await generateCommitment(
      inputHash,
      'fhe-summarize',
      salt,
    )
    const commitment2 = await generateCommitment(
      inputHash,
      'fhe-tokenize',
      salt,
    )

    expect(commitment1).not.toBe(commitment2)
  })

  it('Merkle root is consistent for same leaves', async () => {
    const leaves = [
      await sha256('leaf-1'),
      await sha256('leaf-2'),
      await sha256('leaf-3'),
      await sha256('leaf-4'),
    ]

    const root1 = await buildMerkleRoot([...leaves])
    const root2 = await buildMerkleRoot([...leaves])

    expect(root1).toBe(root2)
  })

  it('Merkle root changes when any leaf changes', async () => {
    const leaves1 = [
      await sha256('leaf-1'),
      await sha256('leaf-2'),
      await sha256('leaf-3'),
      await sha256('leaf-4'),
    ]
    const leaves2 = [
      await sha256('leaf-1'),
      await sha256('leaf-2'),
      await sha256('leaf-MODIFIED'),
      await sha256('leaf-4'),
    ]

    const root1 = await buildMerkleRoot(leaves1)
    const root2 = await buildMerkleRoot(leaves2)

    expect(root1).not.toBe(root2)
  })

  it('handles single-step pipeline (edge case)', async () => {
    const payload = generatePayload(1024)
    const { proofHash, durationMs } = await generateProof(payload, 'fhe-add', 1)

    expect(proofHash).toMatch(/^[0-9a-f]{64}$/)
    expect(durationMs).toBeLessThan(5000)
  })

  it('handles empty payload (edge case)', async () => {
    const { proofHash, durationMs } = await generateProof('', 'fhe-noop', 1)

    expect(proofHash).toMatch(/^[0-9a-f]{64}$/)
    expect(durationMs).toBeLessThan(5000)
  })

  it('handles large number of pipeline steps (16 steps)', async () => {
    const payload = generatePayload(10240)
    const { proofHash, durationMs } = await generateProof(
      payload,
      'fhe-complex',
      16,
    )

    expect(proofHash).toMatch(/^[0-9a-f]{64}$/)
    expect(durationMs).toBeLessThan(5000)
  })
})
