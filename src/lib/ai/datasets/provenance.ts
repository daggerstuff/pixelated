/**
 * @file src/lib/ai/datasets/provenance.ts
 * @description Dataset provenance schema and store for tracking merge/prepare lineage.
 *
 * Provides DatasetProvenance records for every merge operation, validation of
 * parent merge runs in prepare(), and a lineage query endpoint.
 *
 * Two store implementations:
 *  - MemoryProvenanceStore — in-memory (for tests)
 *  - MongoProvenanceStore — MongoDB-backed (production)
 */

import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import mongodb from "@/config/mongodb.config";
import type { Collection, IndexDescription } from "mongodb";
import { createBuildSafeLogger } from "../../logging/build-safe-logger";

const logger = createBuildSafeLogger("provenance");

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export interface DatasetProvenance {
  /** Unique identifier for this merge run (UUID v4). */
  mergeRunId: string;
  /** Ordered list of source dataset identifiers that were merged. */
  sourceDatasetIds: string[];
  /** ISO timestamp when the merge completed. */
  mergedAt: string;
  /** ID of the user who triggered the merge. */
  mergedByUserId: string;
  /** Quality threshold filter applied during merge. */
  qualityThresholdUsed: number;
  /** Deduplication strategy name (e.g. "hybrid-bloom"). */
  dedupStrategy: string;
  /** SHA-256 hex digest of the sorted list of input file paths. */
  inputHash: string;
  /** If this dataset was prepared from a previous merge, the source mergeRunId. */
  parentMergeRunId?: string;
  /** Child run IDs (prepare runs) that used this merge as a parent. */
  childRunIds: string[];
}

// ---------------------------------------------------------------------------
// Mongo collection constants
// ---------------------------------------------------------------------------

const COLLECTION = "dataset_provenance";
const INDEXES: IndexDescription[] = [
  { key: { mergeRunId: 1 }, unique: true },
  { key: { sourceDatasetIds: 1 } },
  { key: { mergedByUserId: 1 } },
];

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export interface IProvenanceStore {
  create(provenance: DatasetProvenance): Promise<void>;
  getByRunId(runId: string): Promise<DatasetProvenance | null>;
  exists(runId: string): Promise<boolean>;
  getLineage(runId: string): Promise<{
    current: DatasetProvenance;
    parent: DatasetProvenance | null;
    children: DatasetProvenance[];
  }>;
  addChildRunId(parentRunId: string, childRunId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// In-memory store (for tests)
// ---------------------------------------------------------------------------

export class MemoryProvenanceStore implements IProvenanceStore {
  private readonly records = new Map<string, DatasetProvenance>();

  async create(provenance: DatasetProvenance): Promise<void> {
    this.records.set(provenance.mergeRunId, { ...provenance });
  }

  async getByRunId(runId: string): Promise<DatasetProvenance | null> {
    return this.records.get(runId) ?? null;
  }

  async exists(runId: string): Promise<boolean> {
    return this.records.has(runId);
  }

  async getLineage(runId: string): Promise<{
    current: DatasetProvenance;
    parent: DatasetProvenance | null;
    children: DatasetProvenance[];
  }> {
    const current = this.records.get(runId);
    if (!current) {
      throw new ProvenanceNotFoundError(runId);
    }

    const parent = current.parentMergeRunId
      ? (this.records.get(current.parentMergeRunId) ?? null)
      : null;

    const children: DatasetProvenance[] = [];
    for (const record of this.records.values()) {
      if (record.parentMergeRunId === runId) {
        children.push(record);
      }
    }

    return { current: { ...current }, parent: parent ? { ...parent } : null, children };
  }

  async addChildRunId(parentRunId: string, childRunId: string): Promise<void> {
    const record = this.records.get(parentRunId);
    if (!record) {
      throw new Error(`Cannot add child — parent not found: ${parentRunId}`);
    }
    if (!record.childRunIds.includes(childRunId)) {
      record.childRunIds.push(childRunId);
    }
  }
}

// ---------------------------------------------------------------------------
// MongoDB-backed store (production)
// ---------------------------------------------------------------------------

export class MongoProvenanceStore implements IProvenanceStore {
  private initialized = false;

  private async collection(): Promise<Collection<DatasetProvenance>> {
    const db = await mongodb.connect();
    const col = db.collection<DatasetProvenance>(COLLECTION);

    if (!this.initialized) {
      await col.createIndexes(INDEXES).catch((err: unknown) => {
        logger.warn("Failed to create provenance indexes (may already exist)", { error: err });
      });
      this.initialized = true;
    }

    return col;
  }

  async create(provenance: DatasetProvenance): Promise<void> {
    const col = await this.collection();
    await col.insertOne(provenance);
    logger.info("Provenance record created", { mergeRunId: provenance.mergeRunId });
  }

  async getByRunId(runId: string): Promise<DatasetProvenance | null> {
    const col = await this.collection();
    return col.findOne({ mergeRunId: runId });
  }

  async exists(runId: string): Promise<boolean> {
    const col = await this.collection();
    const count = await col.countDocuments({ mergeRunId: runId }, { limit: 1 });
    return count > 0;
  }

  async getLineage(runId: string): Promise<{
    current: DatasetProvenance;
    parent: DatasetProvenance | null;
    children: DatasetProvenance[];
  }> {
    const col = await this.collection();
    const current = await col.findOne({ mergeRunId: runId });
    if (!current) {
      throw new ProvenanceNotFoundError(runId);
    }

    const parent = current.parentMergeRunId
      ? await col.findOne({ mergeRunId: current.parentMergeRunId })
      : null;

    const children = await col.find({ parentMergeRunId: runId }).toArray();

    return {
      current: { ...current, childRunIds: [...current.childRunIds] },
      parent: parent ? { ...parent, childRunIds: [...parent.childRunIds] } : null,
      children: children.map((c: DatasetProvenance) => ({
        ...c,
        childRunIds: [...c.childRunIds],
      })),
    };
  }

  async addChildRunId(parentRunId: string, childRunId: string): Promise<void> {
    const col = await this.collection();
    const result = await col.updateOne(
      { mergeRunId: parentRunId },
      { $addToSet: { childRunIds: childRunId } },
    );
    if (result.matchedCount === 0) {
      throw new Error(`Cannot add child — parent not found: ${parentRunId}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Default store singleton
// ---------------------------------------------------------------------------

let defaultStore: IProvenanceStore | null = null;

/**
 * Get the default provenance store.
 *
 * Returns **MemoryProvenanceStore** when `PROVENANCE_STORE=memory` (default
 * in tests) or **MongoProvenanceStore** otherwise.  Tests should inject a
 * MemoryProvenanceStore explicitly via `setProvenanceStore()`.
 */
export function getDefaultProvenanceStore(): IProvenanceStore {
  if (defaultStore) return defaultStore;

  if (process.env["PROVENANCE_STORE"] === "memory") {
    defaultStore = new MemoryProvenanceStore();
  } else {
    defaultStore = new MongoProvenanceStore();
  }

  return defaultStore;
}

/**
 * Override the default store (for tests).
 */
export function setProvenanceStore(store: IProvenanceStore | null): void {
  defaultStore = store;
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Custom error types
// ---------------------------------------------------------------------------

export class ProvenanceNotFoundError extends Error {
  constructor(runId: string) {
    super(`Provenance record not found: ${runId}`);
    this.name = "ProvenanceNotFoundError";
  }
}

// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a deterministic input hash from an array of source file paths.
 *
 * SHA-256 hex digest of the sorted paths joined with newlines.  This gives
 * a repeatable identifier that changes when inputs change, without reading
 * the entire file content.
 */
export function computeInputHash(sourcePaths: string[]): string {
  const sorted = [...sourcePaths].sort();
  const payload = sorted.join("\n");
  return createHash("sha256").update(payload).digest("hex");
}

/**
 * Generate a UUID v4 merge-run identifier.
 */
export function generateMergeRunId(): string {
  return randomUUID();
}

/**
 * Collect the list of normalized file paths that exist in the given
 * directory (used as sourceDatasetIds).
 */
export function collectSourceDatasetIds(normalizedDir: string): string[] {
    if (!existsSync(normalizedDir)) {
    logger.warn("Dataset source directory does not exist, returning empty list", { normalizedDir });
    return [];
  }
const entries = readdirSync(normalizedDir, { withFileTypes: true });
  const paths: string[] = [];

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith("_normalized.jsonl")) {
      const fullPath = join(normalizedDir, entry.name);
      const st = statSync(fullPath);
      // Use relative filename + size + mtime as stable identifier
      paths.push(`${entry.name}:${st.size}:${st.mtimeMs}`);
    }
  }

  return paths.sort();
}
