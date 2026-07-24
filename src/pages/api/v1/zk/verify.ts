import { createBuildSafeLogger } from "@/lib/logging/build-safe-logger";
import { getZKProofService } from "@/lib/fhe/zk-proof-service";
import type { ZKProofArtifact } from "@/lib/fhe/zk-proof-service";

import { protectRoute } from "../../../../lib/auth/serverAuth";

export const prerender = false;
const logger = createBuildSafeLogger("zk-verify-api");

/**
 * POST /api/v1/zk/verify
 *
 * Verifies a Zero-Knowledge proof artifact for data pipeline integrity.
 *
 * Accepts a ZKProofArtifact (proof, publicInputHash, publicOutputHash,
 * merkleRoot, operationType, timestamp, durationMs) and returns whether
 * the proof is valid.
 *
 * Per ADR-0004, proofs use SP1 with hash-based commitments:
 * - SHA-256 input/output hash commitments
 * - Merkle root over pipeline step commitments
 * - Verification checks hash consistency and proof format
 *
 * Authentication required (any authenticated user can verify proofs).
 */
export const POST = protectRoute({})(async ({ request }) => {
  try {
    const body = (await request.json()) as Partial<ZKProofArtifact>;

    // Validate required fields
    const requiredFields: (keyof ZKProofArtifact)[] = [
      "proof",
      "publicInputHash",
      "publicOutputHash",
      "merkleRoot",
      "operationType",
      "timestamp",
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        return new Response(
          JSON.stringify({
            valid: false,
            error: `Missing required field: ${field}`,
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store, no-cache, must-revalidate",
              Pragma: "no-cache",
            },
          },
        );
      }
    }

    const proofArtifact: ZKProofArtifact = {
      proof: body.proof!,
      publicInputHash: body.publicInputHash!,
      publicOutputHash: body.publicOutputHash!,
      merkleRoot: body.merkleRoot!,
      operationType: body.operationType!,
      timestamp: body.timestamp!,
      durationMs: body.durationMs ?? 0,
      proofMode: body.proofMode ?? "hash-commitment",
    };

    const zkService = getZKProofService();

    // Verify the proof: the caller provides the expected input/output hashes
    // (these are public inputs to the ZK proof)
    const valid = await zkService.verifyProof(
      proofArtifact,
      proofArtifact.publicInputHash,
      proofArtifact.publicOutputHash,
    );

    logger.info("ZK proof verification requested", {
      valid,
      operationType: proofArtifact.operationType,
      merkleRoot: proofArtifact.merkleRoot.slice(0, 16),
    });

    return new Response(
      JSON.stringify({
        valid,
        operationType: proofArtifact.operationType,
        timestamp: proofArtifact.timestamp,
        merkleRoot: proofArtifact.merkleRoot,
        proofMode: proofArtifact.proofMode,
      }),
      {
        status: valid ? 200 : 422,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      },
    );
  } catch (error: unknown) {
    logger.error("ZK proof verification failed", { error });

    return new Response(
      JSON.stringify({
        valid: false,
        error: "Proof verification failed",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      },
    );
  }
});

/**
 * GET /api/v1/zk/verify
 *
 * Returns metadata about the ZK proof verification endpoint.
 */
export const GET = protectRoute({})(async () => {
  return new Response(
    JSON.stringify({
      endpoint: "/api/v1/zk/verify",
      method: "POST",
      description: "Verifies a Zero-Knowledge proof artifact for data pipeline integrity",
      proofSystem: "SP1 (Succinct) with hash-based commitments",
      adr: "ADR-0004",
      requiredFields: [
        "proof",
        "publicInputHash",
        "publicOutputHash",
        "merkleRoot",
        "operationType",
        "timestamp",
      ],
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    },
  );
});
