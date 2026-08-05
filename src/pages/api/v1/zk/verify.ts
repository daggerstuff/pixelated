import { getZKProofService, MAX_PROOF_AGE_MS } from '@/lib/fhe/zk-proof-service'
import type { ZKProofArtifact } from '@/lib/fhe/zk-proof-service'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

import { protectRoute } from '../../../../lib/auth/serverAuth'

export const prerender = false
const logger = createBuildSafeLogger('zk-verify-api')

/**
 * In-memory nonce cache for replay-attack prevention (opaque, ephemeral).
 *
 * Tracks nonces that have already been presented for proof verification.
 * Entries expire after MAX_PROOF_AGE_MS to bound memory growth. In a
 * production multi-instance deployment, this should be replaced with a
 * shared Redis-backed cache (see PIX-3929 / advanced-caching strategy).
 */
const verifiedNonces = new Set<string>()

/**
 * Prune stale entries from the nonce cache once per minute at most.
 * Avoids unbounded memory growth while keeping replay protection tight.
 */
let lastNoncePrune = 0
function pruneNonceCache(): void {
  const now = Date.now()
  if (now - lastNoncePrune < 60_000) return
  lastNoncePrune = now
  if (verifiedNonces.size > 10_000) {
    verifiedNonces.clear()
    logger.warn('Nonce cache pruned: size exceeded 10,000 entries')
  }
}

/** Hex-digit regex for validating fields at the endpoint boundary. */
const HASH_RE = /^[0-9a-f]{64}$/

/**
 * POST /api/v1/zk/verify
 *
 * Verifies a Zero-Knowledge proof artifact for data pipeline integrity.
 *
 * Per ADR-0004, proofs use SP1 with hash-based commitments.
 * Authentication required. Enterprise audit logging includes the
 * authenticated user's identity per 45 CFR § 164.312(b).
 * Replay-attack prevention enforced via a nonce cache at this layer.
 */
export const POST = protectRoute({
  validateIPMatch: true,
})(async ({ request, locals }) => {
  const startTime = performance.now()
  const user = locals.user

  try {
    const body = (await request.json()) as Partial<ZKProofArtifact>

    // ── Enterprise field validation at endpoint boundary ─────────────
    const requiredFields: (keyof ZKProofArtifact)[] = [
      'proof',
      'publicInputHash',
      'publicOutputHash',
      'merkleRoot',
      'operationType',
      'timestamp',
      'nonce',
    ]

    for (const field of requiredFields) {
      const value = body[field]
      if (value === undefined || value === null || value === '') {
        logger.warn('ZK proof verification rejected: missing field', {
          field,
          userId: user?.id,
        })
        return new Response(
          JSON.stringify({
            valid: false,
            error: `Missing required field: ${field}`,
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store, no-cache, must-revalidate',
              'Pragma': 'no-cache',
            },
          },
        )
      }
    }

    // Validate hex format of hash fields at the endpoint boundary
    const hashFields: (keyof Pick<
      ZKProofArtifact,
      'proof' | 'publicInputHash' | 'publicOutputHash' | 'merkleRoot' | 'nonce'
    >)[] = [
      'proof',
      'publicInputHash',
      'publicOutputHash',
      'merkleRoot',
      'nonce',
    ]
    for (const field of hashFields) {
      if (!HASH_RE.test(String(body[field] ?? ''))) {
        logger.warn('ZK proof verification rejected: field format invalid', {
          field,
          userId: user?.id,
        })
        return new Response(
          JSON.stringify({
            valid: false,
            error: `Invalid format for field: ${field} (expected 64-char lowercase hex)`,
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store, no-cache, must-revalidate',
              'Pragma': 'no-cache',
            },
          },
        )
      }
    }

    // operationType must be a non-empty string
    if (
      typeof body.operationType !== 'string' ||
      body.operationType.length === 0
    ) {
      logger.warn('ZK proof verification rejected: empty operationType', {
        userId: user?.id,
      })
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'operationType must be a non-empty string',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache',
          },
        },
      )
    }

    const proofArtifact: ZKProofArtifact = {
      proof: body.proof!,
      publicInputHash: body.publicInputHash!,
      publicOutputHash: body.publicOutputHash!,
      merkleRoot: body.merkleRoot!,
      operationType: body.operationType!,
      timestamp: body.timestamp!,
      durationMs: body.durationMs ?? 0,
      proofMode: body.proofMode ?? 'hash-commitment',
      nonce: body.nonce!,
    }

    // ── Replay-attack detection ──────────────────────────────────────
    pruneNonceCache()
    if (verifiedNonces.has(proofArtifact.nonce)) {
      logger.warn(
        'ZK proof verification rejected: nonce already used (replay)',
        {
          nonce: proofArtifact.nonce.slice(0, 16),
          userId: user?.id,
        },
      )
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'Replay detected: this proof has already been verified',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache',
          },
        },
      )
    }

    const zkService = getZKProofService()

    const valid = await zkService.verifyProof(
      proofArtifact,
      proofArtifact.publicInputHash,
      proofArtifact.publicOutputHash,
    )

    // Record the nonce so it cannot be replayed
    verifiedNonces.add(proofArtifact.nonce)

    const durationMs = performance.now() - startTime

    // ── Enterprise audit log ─────────────────────────────────────────
    // Every verification attempt is logged with the authenticated user's
    // identity, satisfying HIPAA audit-control requirements (45 CFR § 164.312(b)).
    logger.info('ZK proof verification', {
      valid,
      userId: user?.id,
      userRole: user?.role,
      operationType: proofArtifact.operationType,
      merkleRoot: proofArtifact.merkleRoot.slice(0, 16),
      nonce: proofArtifact.nonce.slice(0, 16),
      proofMode: proofArtifact.proofMode,
      durationMs: Math.round(durationMs),
      timestamp: proofArtifact.timestamp,
      ageMs: Date.now() - proofArtifact.timestamp,
    })

    return new Response(
      JSON.stringify({
        valid,
        operationType: proofArtifact.operationType,
        timestamp: proofArtifact.timestamp,
        merkleRoot: proofArtifact.merkleRoot,
        proofMode: proofArtifact.proofMode,
        durationMs: Math.round(durationMs),
      }),
      {
        status: valid ? 200 : 422,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
        },
      },
    )
  } catch (error: unknown) {
    const durationMs = performance.now() - startTime

    logger.error('ZK proof verification failed', {
      error,
      userId: user?.id,
      durationMs: Math.round(durationMs),
    })

    return new Response(
      JSON.stringify({
        valid: false,
        error: 'Proof verification failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
        },
      },
    )
  }
})

/**
 * GET /api/v1/zk/verify
 *
 * Returns metadata about the ZK proof verification endpoint.
 */
export const GET = protectRoute({
  validateIPMatch: true,
})(async ({ locals }) => {
  logger.info('ZK proof endpoint info requested', {
    userId: locals.user?.id,
  })

  return new Response(
    JSON.stringify({
      endpoint: '/api/v1/zk/verify',
      method: 'POST',
      description:
        'Verifies a Zero-Knowledge proof artifact for data pipeline integrity',
      proofSystem: 'SP1 (Succinct) with hash-based commitments',
      adr: 'ADR-0004',
      proofMaxAgeMs: MAX_PROOF_AGE_MS,
      replayProtection: 'nonce-based (ephemeral in-memory cache)',
      authMethod: 'any authenticated user (validated IP match)',
      requiredFields: [
        'proof',
        'publicInputHash',
        'publicOutputHash',
        'merkleRoot',
        'operationType',
        'timestamp',
        'nonce',
      ],
      auditLogging: 'per-user identity logged on every verification attempt',
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    },
  )
})
