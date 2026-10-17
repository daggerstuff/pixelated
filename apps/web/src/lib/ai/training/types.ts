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
  | "dry-run"
  | "tinker";

export type FineTuningBackend = TrainingBackendName;

export type FineTuningStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export type OptimizerName = "adamw" | "dimuon";

export type LrScheduleKind = "constant" | "linear-decay-to-zero" | "cosine";

export interface OptimizerConfig {
  name: OptimizerName;
  /** Learning rate. Required for dimuon (no sensible default); optional for adamw (defaults to 1e-4 per Tinker docs). */
  lr?: number;
  /** Beta1 momentum. Default 0.9 for both optimizers. */
  beta1?: number;
  /** Beta2 for AdamW only. Default 0.95. Ignored for dimuon. */
  beta2?: number;
  /** Epsilon for AdamW only. Default 1e-12. Ignored for dimuon. */
  eps?: number;
  /** Weight decay. Default 0 (off) for both. */
  weightDecay?: number;
  /** Global gradient clipping threshold. Default 0 (off). */
  gradClip?: number;
}

export interface LrSchedule {
  /** Schedule kind. Default "constant" for back-compat. Tinker recommends "linear-decay-to-zero" (~1.3x more step-efficient than constant in SFT). */
  kind: LrScheduleKind;
  /** Linear warmup steps before schedule takes over. Default 0. */
  warmupSteps?: number;
  /** Total decay steps; defaults to nEpochs-derived total if omitted. */
  decaySteps?: number;
}

export type LoraTarget = "all" | "attention-only";

export interface RlRewardConfig {
  empathyWeight: number;
  crisisWeight: number;
  clinicalValidityWeight: number;
  rewardFnName?: string;
}

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
  jobType?: "sft" | "dpo" | "rl" | "grpo" | "standard";
  /** Optimizer selection. Defaults to { name: "adamw" } when omitted. */
  optimizer?: OptimizerConfig;
  /** LR schedule. Defaults to { kind: "constant" } for back-compat. */
  lrSchedule?: LrSchedule;
  /** LoRA rank. Defaults to backend default (32 per Tinker) when omitted. */
  loraRank?: number;
  /** Which matrices LoRA targets. Defaults to "all" (Tinker primer: attention-only underperforms even rank-compensated). */
  loraTarget?: LoraTarget;
  /** Baseline batch size for sqrt-scaling hint. When set and batchSize differs, orchestrator logs suggested LR adjustment. */
  baselineBatchSize?: number;
  /** RL reward config. Required when jobType is rl|grpo; ignored otherwise. */
  rlConfig?: RlRewardConfig;
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
  /** Dataset provenance this job derives from (DatasetProvenance.mergeRunId). */
  sourceProvenanceId?: string;
  /** Latest checkpoint produced by this job, if any. */
  checkpointId?: string;
}

export type CheckpointKind = "adapter" | "full";

export interface TrainingCheckpoint {
  id: string;
  jobId: string;
  kind: CheckpointKind;
  path: string;
  createdAt: string;
  metrics?: Record<string, number>;
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
