import { createBuildSafeLogger } from "../../logging/build-safe-logger";
import type { FineTuningJob, FineTuningStatus } from "./types";

const logger = createBuildSafeLogger("training-job-store");

/**
 * Storage abstraction for fine-tuning jobs. The default implementation
 * (MemoryJobStore) is sufficient for unit tests, single-process dev, and the
 * dry-run backend. Production deployments should swap in a Redis hot + Mongo
 * cold implementation (PIX-3932 follow-on). The interface intentionally keeps
 * reads fast and writes idempotent so the implementation can be backed by
 * Redis (TTL 30d) for hot reads plus Mongo for cold storage.
 */
export interface JobStore {
  /** Persist (or overwrite) a job entry. Returns the stored record. */
  put(job: FineTuningJob): Promise<FineTuningJob>;
  /** Look up by job id (the orchestrator-assigned id). */
  get(id: string): Promise<FineTuningJob | null>;
  /** Look up by remote id (the backend-assigned id). */
  getByRemoteId(remoteId: string): Promise<FineTuningJob | null>;
  /** Update status + optional fields. No-op if the id does not exist. */
  updateStatus(
    id: string,
    status: FineTuningStatus,
    patch?: Partial<FineTuningJob>,
  ): Promise<FineTuningJob | null>;
  /** List all stored jobs. Newest first. */
  list(): Promise<FineTuningJob[]>;
  /** List all stored jobs owned by a particular user (id-key). */
  listByOwner(ownerId: string): Promise<FineTuningJob[]>;
}

/**
 * In-memory JobStore. Matches the behaviour of the original
 * `FineTuningOrchestrator.jobs` array exactly so the existing test suite
 * (src/lib/ai/datasets/training-orchestrator.test.ts) continues to pass.
 */
export class MemoryJobStore implements JobStore {
  private readonly jobs = new Map<string, FineTuningJob>();
  private readonly remoteIndex = new Map<string, string>();

  async put(job: FineTuningJob): Promise<FineTuningJob> {
    const previous = this.jobs.get(job.id);
    if (previous?.remoteId && previous.remoteId !== job.remoteId) {
      this.remoteIndex.delete(previous.remoteId);
    }
    this.jobs.set(job.id, { ...job });
    if (job.remoteId) {
      this.remoteIndex.set(job.remoteId, job.id);
    }
    return { ...job };
  }

  async get(id: string): Promise<FineTuningJob | null> {
    const found = this.jobs.get(id);
    return found ? { ...found } : null;
  }

  async getByRemoteId(remoteId: string): Promise<FineTuningJob | null> {
    const id = this.remoteIndex.get(remoteId);
    if (id === undefined) return null;
    return this.get(id);
  }

  async updateStatus(
    id: string,
    status: FineTuningStatus,
    patch?: Partial<FineTuningJob>,
  ): Promise<FineTuningJob | null> {
    const existing = this.jobs.get(id);
    if (!existing) {
      logger.warn(`updateStatus: unknown job id ${id}`);
      return null;
    }
    const updated: FineTuningJob = {
      ...existing,
      ...(patch ?? {}),
      status,
      updatedAt: new Date(),
    };
    // Keep the remoteIndex consistent if remoteId changed.
    if (existing.remoteId && existing.remoteId !== updated.remoteId) {
      this.remoteIndex.delete(existing.remoteId);
    }
    if (updated.remoteId) {
      this.remoteIndex.set(updated.remoteId, updated.id);
    }
    this.jobs.set(id, updated);
    return { ...updated };
  }

  async list(): Promise<FineTuningJob[]> {
    return Array.from(this.jobs.values())
      .map((j) => ({ ...j }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Synchronous variant matching the original FineTuningOrchestrator API.
   * Returns a snapshot list — callers must not mutate the records.
   */
  listSync(): FineTuningJob[] {
    return Array.from(this.jobs.values())
      .map((j) => ({ ...j }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async listByOwner(ownerId: string): Promise<FineTuningJob[]> {
    return Array.from(this.jobs.values())
      .filter((j) => (j as FineTuningJob & { ownerId?: string }).ownerId === ownerId)
      .map((j) => ({ ...j }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /** Test/diagnostic helper — number of jobs currently stored. */
  size(): number {
    return this.jobs.size;
  }
}

/**
 * Default singleton. Production callers should pass an explicit JobStore
 * (typically a Redis-backed one) but this gives module-load convenience for
 * tests and ad-hoc scripts.
 */
let defaultStore: JobStore | null = null;

export function getDefaultJobStore(): JobStore {
  defaultStore ??= new MemoryJobStore();
  return defaultStore;
}

/** Replace the default store (used in tests or production wiring-up). */
export function setDefaultJobStore(store: JobStore): void {
  defaultStore = store;
}
