/* @vitest-environment node */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type DatasetProvenance,
  type IProvenanceStore,
  MemoryProvenanceStore,
  computeInputHash,
  generateMergeRunId,
  collectSourceDatasetIds,
  getDefaultProvenanceStore,
  setProvenanceStore,
} from "./provenance";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProvenance(overrides: Partial<DatasetProvenance> = {}): DatasetProvenance {
  return {
    mergeRunId: generateMergeRunId(),
    sourceDatasetIds: ["src-a_normalized.jsonl", "src-b_normalized.jsonl"],
    mergedAt: new Date().toISOString(),
    mergedByUserId: "user-123",
    qualityThresholdUsed: 0.7,
    dedupStrategy: "hybrid-bloom",
    inputHash: "abc123def456",
    childRunIds: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// ProvenanceStore tests
// ---------------------------------------------------------------------------

describe("ProvenanceStore (MemoryProvenanceStore)", () => {
  let store: IProvenanceStore;

  beforeEach(() => {
    store = new MemoryProvenanceStore();
  });

  describe("create + getByRunId", () => {
    it("S1: should store and retrieve a provenance record", async () => {
      const p = makeProvenance();
      await store.create(p);

      const retrieved = await store.getByRunId(p.mergeRunId);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.mergeRunId).toBe(p.mergeRunId);
      expect(retrieved!.sourceDatasetIds).toEqual(p.sourceDatasetIds);
      expect(retrieved!.mergedByUserId).toBe(p.mergedByUserId);
      expect(retrieved!.qualityThresholdUsed).toBe(p.qualityThresholdUsed);
      expect(retrieved!.dedupStrategy).toBe(p.dedupStrategy);
      expect(retrieved!.inputHash).toBe(p.inputHash);
    });

    it("S5: should return null for unknown runId", async () => {
      const retrieved = await store.getByRunId("nonexistent-run-id");
      expect(retrieved).toBeNull();
    });
  });

  describe("exists", () => {
    it("S2: should return true for existing record", async () => {
      const p = makeProvenance();
      await store.create(p);
      expect(await store.exists(p.mergeRunId)).toBe(true);
    });

    it("should return false for non-existing record", async () => {
      expect(await store.exists("nonexistent")).toBe(false);
    });
  });

  describe("getLineage", () => {
    it("S3: should return current, parent, and children", async () => {
      const parent = makeProvenance({ mergeRunId: "parent-1" });
      const current = makeProvenance({
        mergeRunId: "current-1",
        parentMergeRunId: "parent-1",
      });
      const child = makeProvenance({
        mergeRunId: "child-1",
        parentMergeRunId: "current-1",
      });

      await store.create(parent);
      await store.create(current);
      // Add childRunId linkage
      await store.addChildRunId("parent-1", "current-1");
      await store.create(child);
      await store.addChildRunId("current-1", "child-1");

      const lineage = await store.getLineage("current-1");
      expect(lineage.current.mergeRunId).toBe("current-1");
      expect(lineage.parent).not.toBeNull();
      expect(lineage.parent!.mergeRunId).toBe("parent-1");
      expect(lineage.children).toHaveLength(1);
      expect(lineage.children[0].mergeRunId).toBe("child-1");
    });

    it("should return null parent when no parentMergeRunId", async () => {
      const p = makeProvenance({ mergeRunId: "root-1" });
      await store.create(p);

      const lineage = await store.getLineage("root-1");
      expect(lineage.current.mergeRunId).toBe("root-1");
      expect(lineage.parent).toBeNull();
      expect(lineage.children).toEqual([]);
    });

    it("should throw for unknown runId", async () => {
      await expect(store.getLineage("unknown")).rejects.toThrow("Provenance record not found");
    });
  });

  describe("addChildRunId", () => {
    it("should add child run ID to parent", async () => {
      const p = makeProvenance({ mergeRunId: "parent-1" });
      await store.create(p);
      await store.addChildRunId("parent-1", "child-1");
      await store.addChildRunId("parent-1", "child-2");

      const retrieved = await store.getByRunId("parent-1");
      expect(retrieved!.childRunIds).toEqual(["child-1", "child-2"]);
    });

    it("should not duplicate child run IDs", async () => {
      const p = makeProvenance({ mergeRunId: "parent-1" });
      await store.create(p);
      await store.addChildRunId("parent-1", "child-1");
      await store.addChildRunId("parent-1", "child-1");

      const retrieved = await store.getByRunId("parent-1");
      expect(retrieved!.childRunIds).toEqual(["child-1"]);
    });

    it("should throw for unknown parent", async () => {
      await expect(store.addChildRunId("unknown", "child-1")).rejects.toThrow(
        "Cannot add child — parent not found",
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Helper function tests
// ---------------------------------------------------------------------------

describe("generateMergeRunId", () => {
  it("should generate a UUID v4 string", () => {
    const id = generateMergeRunId();
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("should generate unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateMergeRunId()));
    expect(ids.size).toBe(100);
  });
});

describe("computeInputHash", () => {
  it("should produce deterministic output for same inputs", () => {
    const paths = ["file_b.jsonl", "file_a.jsonl"];
    const hash1 = computeInputHash(paths);
    const hash2 = computeInputHash(paths);
    expect(hash1).toBe(hash2);
  });

  it("should produce identical hash regardless of input order", () => {
    const hashA = computeInputHash(["b.jsonl", "a.jsonl"]);
    const hashB = computeInputHash(["a.jsonl", "b.jsonl"]);
    expect(hashA).toBe(hashB);
  });

  it("should produce different hash for different inputs", () => {
    const hash1 = computeInputHash(["file_a.jsonl"]);
    const hash2 = computeInputHash(["file_b.jsonl"]);
    expect(hash1).not.toBe(hash2);
  });

  it("should return a SHA-256 hex digest (64 chars)", () => {
    const hash = computeInputHash(["test.jsonl"]);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("collectSourceDatasetIds", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(process.cwd(), "tmp-test-provenance-" + Date.now());
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it("should collect _normalized.jsonl files with size and mtime", () => {
    writeFileSync(join(tmpDir, "dataset_a_normalized.jsonl"), "data-a\n", "utf-8");
    writeFileSync(join(tmpDir, "dataset_b_normalized.jsonl"), "data-b\n", "utf-8");
    writeFileSync(join(tmpDir, "ignored.txt"), "not jsonl\n", "utf-8");
    writeFileSync(join(tmpDir, "raw.jsonl"), "no normalized suffix\n", "utf-8");

    const ids = collectSourceDatasetIds(tmpDir);
    expect(ids).toHaveLength(2);
    expect(ids.every((id) => id.includes("_normalized.jsonl"))).toBe(true);
  });

  it("should return empty array when no matching files", () => {
    writeFileSync(join(tmpDir, "random.txt"), "hello\n", "utf-8");
    const ids = collectSourceDatasetIds(tmpDir);
    expect(ids).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Default store tests
// ---------------------------------------------------------------------------

describe("getDefaultProvenanceStore", () => {
  afterEach(() => {
    setProvenanceStore(null);
  });

  it("should return MemoryProvenanceStore when PROVENANCE_STORE=memory", () => {
    process.env["PROVENANCE_STORE"] = "memory";
    const store = getDefaultProvenanceStore();
    expect(store).toBeInstanceOf(MemoryProvenanceStore);
  });

  it("should return the same instance on repeated calls", () => {
    process.env["PROVENANCE_STORE"] = "memory";
    const store1 = getDefaultProvenanceStore();
    const store2 = getDefaultProvenanceStore();
    expect(store1).toBe(store2);
  });

  it("should respect setProvenanceStore override", () => {
    const customStore = new MemoryProvenanceStore();
    setProvenanceStore(customStore);
    expect(getDefaultProvenanceStore()).toBe(customStore);
  });
});
