/**
 * Training pipeline types shared by the orchestrator, backend implementations,
 * job store and webhook handler. Originally lived in
 * `src/lib/ai/datasets/training-orchestrator.ts` as `FineTuning*`; re-homed
 * here for the PIX-3932 multi-backend refactor without breaking the existing
 * `FineTuning*` re-export shim.
 */

export type TrainingBackendName =
  | "openai"
  | "huggingface"
  | "local"
  | "dry-run";

export type FineTuningBackend = TrainingBackendName;

export type FineTuningStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface FineTuningConfig {
  model: string;
  suffix?: string;
  nEpochs: number;
  batchSize?: number;
  learningRateMultiplier?: number;
  backend: FineTuningBackend;
  /**
   * Optional methodology or stage for this training run.
   * e.g., 'sft' (Supervised Fine-Tuning) or 'dpo' (Direct Preference Optimization).
   * Used for PAL (Persona-Aware Alignment).
   */
  jobType?: "sft" | "dpo" | "standard";
}

export interface FineTuningJob {
  id: string;
  model: string;
  status: FineTuningStatus;
  createdAt: Date;
  fineTunedModel?: string;
  /** Backend-specific opaque token used to issue follow-up calls (cancel, fetch). */
  remoteId?: string;
  /** Backend-reported human-readable error on failure. */
  error?: string;
  /** Last update from the backend; absent until the first poll/webhook arrives. */
  updatedAt?: Date;
  /** Backend that owns this job. Persisted so polling routes correctly. */
  backend?: FineTuningBackend;
  /** Optional owner id for per-user job listings. */
  ownerId?: string;
}

export interface TrainingModelInfo {
  id: string;
  ownedBy: string;
  /** Default fine-tune target if `model` is omitted from a config. */
  fineTunable: boolean;
}

export interface TrainingDatasetReference {
  /** Path or URI for the OpenAI-formatted JSONL. */
  openai: string | null;
  /** Path or URI for the HuggingFace-formatted JSONL. */
  huggingface: string | null;
  /** Path or URI for the PAL (Persona-Aware Alignment) DPO/SFT formatted JSONL. */
  pal?: string | null;
}

/** Cost / usage counter incremented by each successful submit. */
export interface TrainingUsageRecord {
  backend: TrainingBackendName;
  /** Cost in USD (best-effort; backends expose what their API returns). */
  costUsd: number;
  /** Tokens consumed by the training run, if reported by backend. */
  tokens?: number;
  /** Wall-clock seconds the training run took, if reported by backend. */
  durationSeconds?: number;
  /** Wall-clock UTC instant of the run. */
  recordedAt: Date;
}
