import { existsSync, readFileSync } from "node:fs";
import { createBuildSafeLogger } from "../../logging/build-safe-logger";
import { JobStore, getDefaultJobStore } from "./job-store";
import {
  CostTracker,
  MemoryCostTracker,
  TrainingBackendFactory,
} from "./TrainingBackendFactory";
import type {
  FineTuningConfig,
  FineTuningJob,
  FineTuningStatus,
} from "./types";
import type {
  FineTuningBackend,
  TrainingDatasetReference,
  TrainingModelInfo,
} from "./types";

const logger = createBuildSafeLogger("fine-tuning-orchestrator");

/**
 * Multi-backend fine-tuning orchestrator. Refactored from the original
 * monolithic `src/lib/ai/datasets/training-orchestrator.ts` so each backend
 * is a self-contained `TrainingBackend` implementation, addressing the
 * PIX-3863 audit gap §1 (no provider factory) and §6 (abstractions).
 *
 * Backed by a swappable `JobStore` (default `MemoryJobStore`; production
 * wires Redis hot + Mongo cold per PIX-3932 acceptance checklist).
 */
export class FineTuningOrchestrator {
  private readonly factory: TrainingBackendFactory;

  constructor(opts?: {
    factory?: TrainingBackendFactory;
    store?: JobStore;
    costTracker?: CostTracker;
    /** Legacy: openai API key. Forwarded into the factory's env. */
    openaiApiKey?: string;
    /** Legacy: openai base URL. Forwarded into the factory's env. */
    baseUrl?: string;
  }) {
    this.factory = opts?.factory ?? this.buildFactory(opts ?? {});
    if (opts?.store) this.factory.setJobStore(opts.store);
    if (opts?.costTracker) this.factory.setCostTracker(opts.costTracker);
  }

  private buildFactory(opts: {
    openaiApiKey?: string;
    baseUrl?: string;
  }): TrainingBackendFactory {
    if (!opts.openaiApiKey && !opts.baseUrl) {
      return new TrainingBackendFactory(process.env);
    }
    return new TrainingBackendFactory({
      ...process.env,
      ...(opts.openaiApiKey ? { OPENAI_API_KEY: opts.openaiApiKey } : {}),
      ...(opts.baseUrl ? { OPENAI_BASE_URL: opts.baseUrl } : {}),
    });
  }

  /**
   * Resolve the dataset path for the chosen backend. Audited behaviour
   * preserved from the original orchestrator.
   */
  resolveDatasetPath(
    paths: TrainingDatasetReference,
    backend: FineTuningBackend,
    jobType?: string,
  ): string {
    // For PAL methodology, always prefer the PAL-formatted dataset
    if ((jobType === "sft" || jobType === "dpo") && paths.pal) {
      return paths.pal;
    }

    // Determine the appropriate dataset path for the backend
    if (backend === "openai") {
      // For OpenAI flows, check OpenAI path first
      if (paths.openai) return paths.openai;
      // Fall back to HuggingFace path if OpenAI not available
      if (paths.huggingface) return paths.huggingface;
      throw new Error("No dataset path available for OpenAI backend");
    }
    if (backend === "huggingface") {
      // For HuggingFace flows, check HuggingFace path first
      if (paths.huggingface) return paths.huggingface;
      // Fall back to OpenAI path if HuggingFace not available
      if (paths.openai) return paths.openai;
      throw new Error("No dataset path available for HuggingFace backend");
    }
    // For local and dry-run backends, prefer HuggingFace over OpenAI
    // (arbitrary choice - could be configured or based on other factors)
    if (paths.huggingface) return paths.huggingface;
    if (paths.openai) return paths.openai;
    throw new Error("No dataset path available");
  }

  /**
   * Validate that a dataset file exists, is non-empty, and contains at least
   * one JSONL record. Mirrors the original behaviour so the existing test
   * suite continues to pass.
   */
  validateDataset(filePath: string): void {
    if (!existsSync(filePath)) {
      throw new Error(`Dataset file not found: ${filePath}`);
    }
    const content = readFileSync(filePath, "utf-8").trim();
    if (!content) {
      throw new Error(`Dataset file is empty: ${filePath}`);
    }
    try {
      JSON.parse(content.split("\n")[0]);
    } catch {
      throw new Error(
        "Dataset file does not contain valid JSONL: " + filePath,
      );
    }
  }

  private validateOptimizerConfig(config: FineTuningConfig): void {
    if (config.optimizer?.name === "dimuon" && config.optimizer.lr === undefined) {
      throw new Error(
        "Dimuon optimizer requires an explicit lr (no default). Provide optimizer.lr, e.g. ~1.5e-3 for SFT (~15x AdamW) per Tinker guidance.",
      );
    }
  }

  private validateLoraConfig(config: FineTuningConfig): void {
    if (config.loraRank !== undefined && (!Number.isFinite(config.loraRank) || config.loraRank <= 0)) {
      throw new Error(`loraRank must be a positive integer, got ${String(config.loraRank)}`);
    }
    if (config.loraTarget === "attention-only") {
      logger.warn(
        "loraTarget 'attention-only' underperforms even rank-compensated per Tinker LoRA Primer; prefer 'all'.",
      );
    }
  }

  private logBatchScalingHint(config: FineTuningConfig): void {
    const baseBatch = config.baselineBatchSize;
    const newBatch = config.batchSize;
    const baseLr = config.learningRateMultiplier;
    if (baseLr === undefined || baseBatch === undefined || newBatch === undefined) return;
    if (baseBatch === newBatch || baseBatch <= 0 || newBatch <= 0) return;
    const suggested = baseLr * Math.sqrt(newBatch / baseBatch);
    logger.info(
      `Batch size changed ${baseBatch} → ${newBatch}: Tinker sqrt-scaling suggests LR ${baseLr} → ${suggested} (hint only; not auto-applied).`,
    );
  }

  /**
   * Start a fine-tune job on the requested backend. Persists via the active
   * JobStore and records usage on the active CostTracker.
   */
  async startFromPrepared(
    paths: TrainingDatasetReference,
    config: FineTuningConfig,
  ): Promise<FineTuningJob> {
    this.validateOptimizerConfig(config);
    this.validateLoraConfig(config);
    this.logBatchScalingHint(config);

    const filePath = this.resolveDatasetPath(paths, config.backend, config.jobType);
    if (config.backend !== "openai") {
      this.validateDataset(filePath);
    }

    logger.info(
      `Starting fine-tuning job on ${config.backend} (model: ${config.model}, optimizer: ${config.optimizer?.name ?? "adamw"}, schedule: ${config.lrSchedule?.kind ?? "constant"}, loraRank: ${config.loraRank ?? "default"})`,
    );

    const backend = this.factory.getProvider(config.backend);
    const job: FineTuningJob = {
      ...(await backend.submitJob(filePath, config)),
      backend: config.backend,
      ...(config.sourceProvenanceId ? { sourceProvenanceId: config.sourceProvenanceId } : {}),
    };

    const stored = await this.store.put(job);

    if (config.sourceProvenanceId) {
      try {
        const { getDefaultProvenanceStore } = await import("../datasets/provenance");
        const provStore = getDefaultProvenanceStore();
        await (provStore as unknown as { linkTrainingJob?: (id: string, jobId: string) => Promise<void> }).linkTrainingJob?.(
          config.sourceProvenanceId,
          stored.id,
        );
      } catch (e) {
        logger.warn("Failed to link training job to provenance", { error: String(e) });
      }
    }

    const estimate = backend.estimateUsage(config);
    if (estimate) {
      await this.cost.recordUsage(stored, estimate.costUsd, estimate.tokens);
    }

    return stored;
  }

  /**
   * Poll the backend for the canonical status of an already-submitted job and
   * persist any updates.
   */
  async getJobStatus(jobId: string): Promise<FineTuningJob | null> {
    const existing = await this.store.get(jobId);
    if (!existing) return null;

    if (!existing.remoteId || this.isTerminalStatus(existing.status)) {
      return existing;
    }

    const backend = this.factory.getProvider(
      existing.backend ?? this.guessBackendFromJob(existing),
    );
    const fresh = await backend.getJobStatus(existing.remoteId);
    if (!fresh || fresh.status === existing.status) {
      return existing;
    }

    return this.store.updateStatus(jobId, fresh.status, {
      fineTunedModel: fresh.fineTunedModel,
      error: fresh.error,
    });
  }

  /**
   * Cancel a queued or running job through the appropriate backend and write
   * the new status back to the store.
   */
  async cancelJob(jobId: string): Promise<FineTuningJob | null> {
    const existing = await this.store.get(jobId);
    if (!existing) return null;
    if (!existing.remoteId) return existing;

    const backend = this.factory.getProvider(
      existing.backend ?? this.guessBackendFromJob(existing),
    );
    const updated = await backend.cancelJob(existing.remoteId);
    if (!updated) return null;

    return this.store.updateStatus(jobId, updated.status, {
      fineTunedModel: updated.fineTunedModel,
      error: updated.error,
    });
  }

  /**
   * Return stored jobs, newest first. Synchronous on stores that support
   * `listSync()` (e.g. MemoryJobStore) for back-compat with the original API;
   * async on stores that expose only `list()`. The underlying store is
   * negotiated once at construction so per-call latency is stable.
   */
  listJobs(): FineTuningJob[] | Promise<FineTuningJob[]> {
    const syncHelper = (this.store as unknown as { listSync?: () => FineTuningJob[] }).listSync;
    if (typeof syncHelper === "function") {
      return syncHelper.call(this.store);
    }
    return this.store.list();
  }

  /**
   * Async-only variant for callers that want to negotiate via the store
   * directly (e.g. from server-rendered Astro pages). Always resolves to
   * the same data as `listJobs()`.
   */
  async listJobsAsync(): Promise<FineTuningJob[]> {
    return this.store.list();
  }

  async getJobProvenance(jobId: string): Promise<import("../datasets/provenance").DatasetProvenance | null> {
    const job = await this.store.get(jobId);
    if (!job?.sourceProvenanceId) return null;
    const { getDefaultProvenanceStore } = await import("../datasets/provenance");
    return getDefaultProvenanceStore().getByRunId(job.sourceProvenanceId);
  }

  /** Whether a given job id has reached a terminal state. */
  isTerminalStatus(status: FineTuningStatus): boolean {
    return status === "succeeded" || status === "failed" || status === "cancelled";
  }

  /** Aggregate model list across backends. */
  async listAvailableModels(): Promise<TrainingModelInfo[]> {
    return this.factory.listModels();
  }

  private readonly checkpoints = new Map<string, import("./types").TrainingCheckpoint>();

  async saveCheckpoint(jobId: string, kind: import("./types").CheckpointKind = "adapter"): Promise<import("./types").TrainingCheckpoint | null> {
    const job = await this.store.get(jobId);
    if (!job?.remoteId) return null;
    const backend = this.factory.getProvider(job.backend ?? this.guessBackendFromJob(job));
    const result = await backend.saveCheckpoint?.(job.remoteId, kind);
    if (!result) return null;
    const cp: import("./types").TrainingCheckpoint = {
      id: result.checkpointId,
      jobId,
      kind,
      path: result.path,
      createdAt: new Date().toISOString(),
    };
    this.checkpoints.set(cp.id, cp);
    await this.store.updateStatus(jobId, job.status, { checkpointId: cp.id });
    return cp;
  }

  getCheckpoint(checkpointId: string): import("./types").TrainingCheckpoint | null {
    return this.checkpoints.get(checkpointId) ?? null;
  }

  async resumeFromCheckpoint(checkpointId: string, overrides?: Partial<import("./types").FineTuningConfig>): Promise<import("./types").FineTuningJob | null> {
    const cp = this.checkpoints.get(checkpointId);
    if (!cp) return null;
    const origJob = await this.store.get(cp.jobId);
    if (!origJob) return null;
    const backend = this.factory.getProvider(origJob.backend ?? this.guessBackendFromJob(origJob));
    const resumed = await backend.resumeFromCheckpoint?.(checkpointId);
    if (!resumed) return null;
    const job: import("./types").FineTuningJob = {
      ...resumed,
      ...(overrides ?? {}),
      backend: origJob.backend,
      ...(origJob.sourceProvenanceId ? { sourceProvenanceId: origJob.sourceProvenanceId } : {}),
    };
    return this.store.put(job);
  }

    private get store(): JobStore {
    return this.factory.getJobStore();
  }

  private get cost(): CostTracker {
    return this.factory.getCostTracker();
  }

  /**
   * Best-effort inference of which backend produced the given job. The
   * strict solution would record this metadata when the job is first created;
   * for now, model names let us pick (HF models contain `/`).
   */
  private guessBackendFromJob(job: FineTuningJob): FineTuningBackend {
    if (!job.id) return "openai";
    if (job.id.startsWith("tinker-")) return "tinker";
    if (job.id.startsWith("hf-")) return "huggingface";
    if (job.id.startsWith("local-")) return "local";
    if (job.id.startsWith("ft-")) return "openai";
    if (job.model?.includes("/")) return "huggingface";
    return "openai";
  }
}

/** Default singleton used by ad-hoc scripts and integration test fixtures. */
let defaultOrchestrator: FineTuningOrchestrator | null = null;

export function getDefaultOrchestrator(): FineTuningOrchestrator {
  defaultOrchestrator ??= new FineTuningOrchestrator({
    store: getDefaultJobStore(),
    costTracker: new MemoryCostTracker(),
  });
  return defaultOrchestrator;
}

export function setDefaultOrchestrator(orch: FineTuningOrchestrator): void {
  defaultOrchestrator = orch;
}
