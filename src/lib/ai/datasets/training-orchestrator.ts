/**
 * Back-compat re-export shim. The original implementation lived in
 * `src/lib/ai/datasets/training-orchestrator.ts` and exposed a class with
 * the public surface:
 *   - `FineTuningOrchestrator` class with `startFromPrepared`,
 *     `getJobStatus`, `listJobs`.
 *   - Type aliases `FineTuningBackend`, `FineTuningConfig`,
 *     `FineTuningStatus`, `FineTuningJob`, `DatasetPaths`.
 *
 * Those types and that class signature now live under
 * `src/lib/ai/training/`. This file re-exports them so any existing
 * `import { FineTuningOrchestrator } from ".../datasets/training-orchestrator"`
 * keeps working without a sweeping rename. New code should import from
 * `src/lib/ai/training` directly.
 */

import {
  FineTuningBackend,
  FineTuningConfig,
  FineTuningJob,
  FineTuningStatus,
  TrainingDatasetReference,
} from "../training/types";

export type {
  FineTuningBackend,
  FineTuningConfig,
  FineTuningJob,
  FineTuningStatus,
};

/** Alias kept for callers using the old `DatasetPaths` name. */
export type DatasetPaths = TrainingDatasetReference;
export type { TrainingDatasetReference };

export { FineTuningOrchestrator } from "../training/FineTuningOrchestrator";
