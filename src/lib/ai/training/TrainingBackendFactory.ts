import { DryRunTrainingBackend } from "./backends/DryRunBackend";
import { HuggingFaceTrainingBackend } from "./backends/HuggingFaceTrainingBackend";
import { LocalTrainingBackend } from "./backends/LocalBackend";
import { OpenAITrainingBackend } from "./backends/OpenAITrainingBackend";
import type { TrainingBackend } from "./backends/Base";
import { JobStore, MemoryJobStore } from "./job-store";
import type {
  FineTuningBackend,
  FineTuningJob,
  TrainingModelInfo,
} from "./types";

const TEST_FINE_TUNEABLE_MODEL = "gpt-4o-mini";
const TEST_DEFAULT_MODEL = "gpt-4o-mini";
const TEST_FALLBACK_MODEL = "gpt-4o";

/**
 * Lightweight in-memory cost / usage tracker. Will be replaced with a Redis-
 * backed implementation in the production rollout (PIX-3932 follow-up). The
 * public API is deliberately small so the swap is mechanical.
 */
export interface CostTracker {
  recordUsage(job: FineTuningJob, costUsd: number, tokens?: number): Promise<void>;
  totalForBackend(backend: FineTuningBackend): number;
  snapshot(): Record<FineTuningBackend, number>;
}

export class MemoryCostTracker implements CostTracker {
  private readonly totals = new Map<FineTuningBackend, number>();
  // Per-job counters retained in case future rendering wants breakdowns.
  private readonly perJob = new Map<string, number>();

  async recordUsage(
    job: FineTuningJob,
    costUsd: number,
    _tokens?: number,
  ): Promise<void> {
    const bucket = job.backend ?? "openai";
    this.totals.set(bucket, (this.totals.get(bucket) ?? 0) + costUsd);
    this.perJob.set(job.id, costUsd);
  }

  totalForBackend(backend: FineTuningBackend): number {
    return this.totals.get(backend) ?? 0;
  }

  snapshot(): Record<FineTuningBackend, number> {
    return {
      openai: this.totals.get("openai") ?? 0,
      huggingface: this.totals.get("huggingface") ?? 0,
      local: this.totals.get("local") ?? 0,
      "dry-run": this.totals.get("dry-run") ?? 0,
    };
  }
}

/**
 * A single instance of the orchestrator-subclass wiring. The factory mirrors
 * the `ProviderFactory` shape in `src/lib/ai/providers.ts`, as recommended by
 * the PIX-3863 audit (§1, §6). Backends are constructed lazily on first use;
 * `MemoryJobStore` and `MemoryCostTracker` are the default for tests.
 */
export class TrainingBackendFactory {
  private readonly backends = new Map<FineTuningBackend, TrainingBackend>();
  private store: JobStore = new MemoryJobStore();
  private cost: CostTracker = new MemoryCostTracker();

  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  /** Register a backend under a name (used for tests). */
  register(name: FineTuningBackend, backend: TrainingBackend): void {
    this.backends.set(name, backend);
  }

  /** Replace the job store (e.g. wire a Redis-backed one). */
  setJobStore(store: JobStore): void {
    this.store = store;
  }

  /** Replace the cost tracker. */
  setCostTracker(tracker: CostTracker): void {
    this.cost = tracker;
  }

  /** Expose the active job store (read-only access for UIConsumers). */
  getJobStore(): JobStore {
    return this.store;
  }

  /** Expose the active cost tracker. */
  getCostTracker(): CostTracker {
    return this.cost;
  }

  /**
   * Get a backend by name. Constructs lazily from env if not explicitly
   * registered. Throws if no backend matches and no env wiring is available.
   */
  getProvider(name: FineTuningBackend): TrainingBackend {
    const existing = this.backends.get(name);
    if (existing) return existing;

    const built = this.buildFromEnv(name);
    this.backends.set(name, built);
    return built;
  }

  /** Aggregated model list across all backends (de-duplicated by id). */
  async listModels(): Promise<TrainingModelInfo[]> {
    const seen = new Set<string>();
    const result: TrainingModelInfo[] = [];
    for (const backend of this.backends.values()) {
      const models = await backend.listModels();
      for (const model of models) {
        if (seen.has(model.id)) continue;
        seen.add(model.id);
        result.push(model);
      }
    }
    return result;
  }

  private buildFromEnv(name: FineTuningBackend): TrainingBackend {
    switch (name) {
      case "openai": {
        const apiKey = this.env["OPENAI_API_KEY"];
        if (!apiKey) {
          throw new Error(
            "OpenAI backend requested but OPENAI_API_KEY not set. " +
              "Wire it via env or pass an explicit apiKey when constructing.",
          );
        }
        return new OpenAITrainingBackend({
          apiKey,
          ...(this.env["OPENAI_BASE_URL"]
            ? { baseUrl: this.env["OPENAI_BASE_URL"] }
            : {}),
          ...(this.env["OPENAI_FT_WEBHOOK_SECRET"]
            ? { webhookSecret: this.env["OPENAI_FT_WEBHOOK_SECRET"] }
            : {}),
        });
      }
      case "huggingface":
        return new HuggingFaceTrainingBackend({});
      case "local":
        return new LocalTrainingBackend();
      case "dry-run":
        return new DryRunTrainingBackend();
      default: {
        // Exhaustive check — TypeScript will warn if a new FineTuningBackend
        // variant is added without a handler. The runtime guard below is
        // for callers using plain JS.
        const exhaustive: never = name;
        throw new Error(`No backend registered for ${String(exhaustive)}`);
      }
    }
  }
}

const TEST_MODEL_SETS: Record<FineTuningBackend, TrainingModelInfo[]> = {
  openai: [
    { id: TEST_FINE_TUNEABLE_MODEL, ownedBy: "openai", fineTunable: true },
    { id: TEST_DEFAULT_MODEL, ownedBy: "openai", fineTunable: true },
    { id: TEST_FALLBACK_MODEL, ownedBy: "openai", fineTunable: true },
  ],
  huggingface: [
    { id: "mistralai/Mistral-7B-v0.1", ownedBy: "mistralai", fineTunable: true },
  ],
  local: [
    { id: "local-gguf-base", ownedBy: "local", fineTunable: true },
  ],
  "dry-run": [
    { id: TEST_DEFAULT_MODEL, ownedBy: "dry-run", fineTunable: true },
  ],
};

/** Convenience: model list for a single named backend (used by tests). */
export function modelsForBackend(name: FineTuningBackend): TrainingModelInfo[] {
  return TEST_MODEL_SETS[name] ?? [];
}
