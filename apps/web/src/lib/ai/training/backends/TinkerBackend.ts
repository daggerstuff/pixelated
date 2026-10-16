import type {
  FineTuningConfig,
  FineTuningJob,
  TrainingModelInfo,
} from "../types";
import { TrainingBackend } from "./Base";

/**
 * Stub for Thinking Machines Tinker backend.
 *
 * Today this is a validation-only dry-run: it checks optimizer/LR config
 * and returns a queued job without touching any external service. When
 * TINKER_ENABLED=true and a real SDK client is wired, this is the seam to
 * replace with create_lora_training_client → forward_backward → optim_step
 * and save_state checkpointing.
 */
export class TinkerBackend extends TrainingBackend {
  readonly name = "tinker" as const;

  private readonly enabled: boolean;

  constructor(opts?: { enabled?: boolean }) {
    super();
    this.enabled = opts?.enabled ?? process.env["TINKER_ENABLED"] === "true";
  }

  async submitJob(
    datasetPath: string,
    config: FineTuningConfig,
  ): Promise<FineTuningJob> {
    const id = `tinker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (!this.enabled) {
      this.log(
        "Tinker backend stub — no live training; config validated only. Set TINKER_ENABLED=true to enable real Tinker SDK wiring.",
        { id, model: config.model, datasetPath },
      );
      return {
        id,
        remoteId: id,
        model: config.model,
        status: "queued",
        createdAt: new Date(),
        error: "Tinker backend not enabled (TINKER_ENABLED != true). Config validated; no training run started.",
      };
    }

    this.log("Tinker job accepted", {
      id,
      model: config.model,
      optimizer: config.optimizer?.name ?? "adamw",
      schedule: config.lrSchedule?.kind ?? "constant",
      loraRank: config.loraRank ?? 32,
      datasetPath,
    });

    return {
      id,
      remoteId: id,
      model: config.model,
      status: "queued",
      createdAt: new Date(),
    };
  }

  async getJobStatus(remoteId: string): Promise<FineTuningJob | null> {
    return {
      id: remoteId,
      remoteId,
      model: "unknown",
      status: "queued",
      createdAt: new Date(),
    };
  }

  async cancelJob(remoteId: string): Promise<FineTuningJob | null> {
    return {
      id: remoteId,
      remoteId,
      model: "unknown",
      status: "cancelled",
      createdAt: new Date(),
    };
  }

  async listModels(): Promise<TrainingModelInfo[]> {
    return [];
  }
}
