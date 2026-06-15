import { TrainingBackend } from "./Base";
import type {
  FineTuningConfig,
  FineTuningJob,
  TrainingBackendName,
  TrainingModelInfo,
} from "../types";

/**
 * Local backend stub. Full implementation (GGUF / transformers-local) is a
 * post-month Tier-3 backlog item per PIX-3863 §15 Deferred. Until then the
 * backend exists so the factory surface is complete and orchestrator code
 * paths are exercised; `submitJob` throws a descriptive error.
 */
export class LocalTrainingBackend extends TrainingBackend {
  readonly name: TrainingBackendName = "local";

  async submitJob(
    _datasetPath: string,
    _config: FineTuningConfig,
  ): Promise<FineTuningJob> {
    throw new Error(
      "Local fine-tuning backend not yet implemented; " +
        "see PIX-3863 §15 (post-month backlog).",
    );
  }

  async getJobStatus(_remoteId: string): Promise<FineTuningJob | null> {
    return null;
  }

  async cancelJob(_remoteId: string): Promise<FineTuningJob | null> {
    return null;
  }

  async listModels(): Promise<TrainingModelInfo[]> {
    return [
      { id: "local-gguf-base", ownedBy: "local", fineTunable: true },
    ];
  }
}
