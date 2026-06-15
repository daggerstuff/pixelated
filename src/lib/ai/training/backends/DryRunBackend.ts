import { TrainingBackend } from "./Base";
import type {
  FineTuningConfig,
  FineTuningJob,
  TrainingBackendName,
  TrainingModelInfo,
} from "../types";

/**
 * In-process dry-run backend. Used for unit tests and local CI runs that
 * should not touch real provider APIs. Returns a synthetic succeeded job
 * immediately so tests can assert orchestration logic without burning quota.
 */
export class DryRunTrainingBackend extends TrainingBackend {
  readonly name: TrainingBackendName = "dry-run";

  async submitJob(
    _datasetPath: string,
    config: FineTuningConfig,
  ): Promise<FineTuningJob> {
    const id = `ft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return {
      id,
      remoteId: id,
      model: config.model,
      status: "succeeded",
      createdAt: new Date(),
      fineTunedModel: `${config.model}:dry-run-${id.slice(0, 8)}`,
    };
  }

  async getJobStatus(remoteId: string): Promise<FineTuningJob | null> {
    return {
      id: remoteId,
      remoteId,
      model: "dry-run",
      status: "succeeded",
      createdAt: new Date(),
      fineTunedModel: `${remoteId}:dry-run`,
    };
  }

  async cancelJob(remoteId: string): Promise<FineTuningJob | null> {
    return {
      id: remoteId,
      remoteId,
      model: "dry-run",
      status: "cancelled",
      createdAt: new Date(),
    };
  }

  async listModels(): Promise<TrainingModelInfo[]> {
    return [
      { id: "gpt-4o-mini", ownedBy: "dry-run", fineTunable: true },
      { id: "gpt-4o", ownedBy: "dry-run", fineTunable: true },
    ];
  }
}
