import { describe, it, expect, beforeEach, vi } from "vitest";

import { sp1ProverMock } from "./_helpers/sp1ProverMock";

// Single source of truth for the sp1-prover mock lives in
// src/lib/fhe/__tests__/_helpers/sp1ProverMock.ts. Tests that want the real
// sp1-prover should declare `@vitest-environment node` at the top instead
// and skip this mock.
//
// IMPORTANT: wrap the helper in an inline arrow when passing to vi.mock.
// Vitest's transformer hoists vi.mock above imports and lowers function
// arguments to internal `__vi_import_X__` bindings. Passing the helper
// directly (`vi.mock(path, sp1ProverMock)`) triggers a TDZ ReferenceError
// at hoisted-eval time. The thunk defers the call until vitest actually
// resolves the mocked module, by which point the ESM import is fully
// initialized.
vi.mock("../sp1-prover", () => sp1ProverMock());

import { ZKProofService } from "../zk-proof-service";

describe("ZKProofService (SP1-integrated)", () => {
  let service: ZKProofService;

  beforeEach(() => {
    ZKProofService.reset();
    service = ZKProofService.getInstance();
  });

  describe("generateProof", () => {
    it("should generate a proof with proofMode field", async () => {
      const result = await service.generateProof(
        "test input",
        "SUMMARIZE",
        "test output",
      );
      expect(result.proof).toBeDefined();
      expect(result.proofMode).toBe("hash-commitment");
      expect(result.publicInputHash).toHaveLength(64);
      expect(result.publicOutputHash).toHaveLength(64);
      expect(result.merkleRoot).toHaveLength(64);
      expect(result.operationType).toBe("SUMMARIZE");
      expect(result.timestamp).toBeGreaterThan(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("should accept pipeline steps", async () => {
      const steps = ["step1hash", "step2hash", "step3hash"];
      const result = await service.generateProof(
        "input",
        "SENTIMENT",
        "output",
        steps,
      );
      expect(result.merkleRoot).toBeDefined();
      expect(result.merkleRoot).toHaveLength(64);
    });

    it("should generate different proofs for different inputs", async () => {
      const proof1 = await service.generateProof("input1", "SUMMARIZE", "out1");
      const proof2 = await service.generateProof("input2", "SUMMARIZE", "out2");
      expect(proof1.publicInputHash).not.toBe(proof2.publicInputHash);
      expect(proof1.publicOutputHash).not.toBe(proof2.publicOutputHash);
    });

    it("should generate consistent hashes for same input", async () => {
      const proof1 = await service.generateProof("same", "SUMMARIZE", "same");
      const proof2 = await service.generateProof("same", "SUMMARIZE", "same");
      expect(proof1.publicInputHash).toBe(proof2.publicInputHash);
      expect(proof1.publicOutputHash).toBe(proof2.publicOutputHash);
    });
  });

  describe("wrapOperation", () => {
    it("should wrap an FHE operation with ZK proof", async () => {
      const mockCallback = vi.fn(
        async (
          _input: string,
          operation: string,
          _params?: Record<string, unknown>,
        ) => ({
          success: true,
          result: "FHE result",
          operationType: operation,
          timestamp: new Date().toISOString(),
          metadata: {},
        }),
      );

      const result = await service.wrapOperation(
        "test input",
        "SENTIMENT" as never,
        undefined,
        mockCallback,
      );

      expect(result.success).toBe(true);
      expect(result.zkProof).toBeDefined();
      expect(result.zkProof.proofMode).toBe("hash-commitment");
      expect(mockCallback).toHaveBeenCalledOnce();
    });

    it("should throw on FHE operation failure", async () => {
      const mockCallback = vi.fn(
        async (
          _input: string,
          operation: string,
          _params?: Record<string, unknown>,
        ) => ({
          success: false,
          result: null,
          operationType: operation,
          timestamp: new Date().toISOString(),
          metadata: {},
          error: "FHE error",
        }),
      );

      await expect(
        service.wrapOperation(
          "test",
          "SENTIMENT" as never,
          undefined,
          mockCallback,
        ),
      ).rejects.toThrow();
    });
  });

  describe("verifyProof", () => {
    it("should verify a valid proof", async () => {
      const proof = await service.generateProof("test", "SUMMARIZE", "output");
      const valid = await service.verifyProof(
        proof,
        proof.publicInputHash,
        proof.publicOutputHash,
      );
      expect(valid).toBe(true);
    });

    it("should reject proof with wrong input hash", async () => {
      const proof = await service.generateProof("test", "SUMMARIZE", "output");
      const valid = await service.verifyProof(
        proof,
        "0".repeat(64),
        proof.publicOutputHash,
      );
      expect(valid).toBe(false);
    });

    it("should reject proof with wrong output hash", async () => {
      const proof = await service.generateProof("test", "SUMMARIZE", "output");
      const valid = await service.verifyProof(
        proof,
        proof.publicInputHash,
        "0".repeat(64),
      );
      expect(valid).toBe(false);
    });
  });

  describe("buildMerkleRoot", () => {
    it("should build merkle root from leaves", async () => {
      const { buildMerkleRoot } = await import("../zk-proof-service");
      const root = await buildMerkleRoot(["a", "b", "c", "d"]);
      expect(root).toHaveLength(64);
    });

    it("should handle single leaf", async () => {
      const { buildMerkleRoot } = await import("../zk-proof-service");
      const root = await buildMerkleRoot(["single"]);
      expect(root).toBe("single");
    });

    it("should handle empty leaves", async () => {
      const { buildMerkleRoot } = await import("../zk-proof-service");
      const root = await buildMerkleRoot([]);
      expect(root).toHaveLength(64);
    });
  });
});
