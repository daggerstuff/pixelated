import { createBuildSafeLogger } from "../../../logging/build-safe-logger";
import type {
  FineTuningConfig,
  FineTuningJob,
  TrainingBackendName,
  TrainingModelInfo,
  TrainingUsageRecord,
} from "../types";

const logger = createBuildSafeLogger("training-backend");

/**
 * Abstract base class for a fine-tuning backend. Concrete backends override
 * `submitJob`, `getJobStatus`, `cancelJob`, and `listModels`. Optional hooks
 * `estimateUsage` and `verifyWebhookSignature` have default no-op
 * implementations.
 *
 * The orchestrator never touches backend-specific types directly; everything
 * flows through this interface. This is the seam that the audit (PIX-3863 §1
 * + §6) flagged as missing — `src/lib/ai/providers.ts` had this pattern for
 * inference but no equivalent existed for fine-tuning.
 */
export abstract class TrainingBackend {
  abstract readonly name: TrainingBackendName;

  /** Begin a fine-tuning job. Implementations may return synchronously or after polling. */
  abstract submitJob(
    datasetPath: string,
    config: FineTuningConfig,
  ): Promise<FineTuningJob>;

  /** Poll the backend for the canonical status of an already-submitted job. */
  abstract getJobStatus(remoteId: string): Promise<FineTuningJob | null>;

  /** Cancel a running job. Returns the updated job, or null if already terminal. */
  abstract cancelJob(remoteId: string): Promise<FineTuningJob | null>;

  /** List models this backend can fine-tune. Implementations may return [] if not enumerable. */
  abstract listModels(): Promise<TrainingModelInfo[]>;

  /**
   * Optional best-effort usage estimate. Defaults to zero — backends with
   * pricing data (OpenAI) override to surface cost in the orchestrator UI.
   */
  estimateUsage(_config: FineTuningConfig): TrainingUsageRecord | null {
    return null;
  }

  /**
   * Optional webhook signature verifier. Backends that don't accept webhooks
   * (e.g. dry-run / local) can leave the default, which always rejects.
   * OpenAI overrides with its standard `whsec_*` Bearer check.
   */
  verifyWebhookSignature(
    _rawBody: string,
    _signature: string | null,
  ): boolean {
    return false;
  }

  /** Hook for tests — subclasses can override to swap fetch / subprocess. */
  protected log(message: string, meta?: Record<string, unknown>): void {
    logger.info(`[${this.name}] ${message}`, meta);
  }
}
