import { createBuildSafeLogger } from "../../../logging/build-safe-logger";
import { TrainingBackend } from "./Base";
import type {
  FineTuningConfig,
  FineTuningJob,
  FineTuningStatus,
  TrainingBackendName,
  TrainingModelInfo,
} from "../types";

const logger = createBuildSafeLogger("huggingface-training-backend");

const HF_BASE_URL =
  process.env["AI_SERVICE_URL"] ?? "http://localhost:5000";

const HF_API_KEY = process.env["AI_SERVICE_API_KEY"];
if (!HF_API_KEY) {
  logger.warn(
    "AI_SERVICE_API_KEY is not set. HuggingFace backend will fail closed on first request.",
  );
}

/**
 * HuggingFace fine-tuning backend. Routes all operations via internal HTTP to
 * the AI microservice (ai-services/api.py), isolating Python subprocess
 * execution from the main application.
 *
 * PIX-3926 (AI Microservice Isolation) — replaces the previous subprocess
 * dispatch that spawned `ai/training/finetune_model.py` directly.
 */
export class HuggingFaceTrainingBackend extends TrainingBackend {
  readonly name: TrainingBackendName = "huggingface";

  constructor(
    private readonly opts: {
      baseUrl?: string;
      apiKey?: string;
      timeoutMs?: number;
    } = {},
  ) {
    super();
  }

  private get baseUrl(): string {
    return (this.opts.baseUrl ?? HF_BASE_URL).replace(/\/$/, "");
  }

  private get apiKey(): string {
    const key = this.opts.apiKey ?? HF_API_KEY;
    if (!key) {
      throw new Error(
        "HuggingFaceTrainingBackend: AI_SERVICE_API_KEY is required. " +
          "Set it via env or pass apiKey when constructing the backend.",
      );
    }
    return key;
  }

  private get timeoutMs(): number {
    return this.opts.timeoutMs ?? 30 * 60 * 1000;
  }

  private async fetchJSON<T>(
    path: string,
    init?: RequestInit,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Pixelated-Client": "internal",
      "X-API-Key": this.apiKey,
    };
    if (init?.headers) {
      Object.assign(headers, init.headers as Record<string, string>);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        ...init,
        headers,
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "(no body)");
        throw new Error(
          `HuggingFace microservice ${path} returned ${res.status}: ${body}`,
        );
      }

      return (await res.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  async submitJob(
    datasetPath: string,
    config: FineTuningConfig,
  ): Promise<FineTuningJob> {
    const body: Record<string, unknown> = {
      model: config.model,
      dataset: datasetPath,
      epochs: config.nEpochs,
    };
    if (config.batchSize !== undefined) {
      body["batch_size"] = config.batchSize;
    }
    if (config.learningRateMultiplier !== undefined) {
      // The microservice expects an absolute learning rate. We convert the
      // OpenAI-style multiplier (relative to a base rate) to an absolute value
      // using the same 2e-5 base that finetune_model.py assumes.
      // This is a documented convention, not an undocumented magic constant.
      const BASE_LEARNING_RATE = 2e-5;
      body["learning_rate"] = config.learningRateMultiplier * BASE_LEARNING_RATE;
    }

    this.log("submitting job", { model: config.model, datasetPath });

    const data = await this.fetchJSON<{
      success: boolean;
      job: {
        id: string;
        model: string;
        status: string;
        created_at: number;
        fine_tuned_model?: string | null;
      };
    }>("/api/training/jobs", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const job = data.job;
    return {
      id: job.id,
      remoteId: job.id,
      model: job.model,
      status: mapHFStatus(job.status),
      createdAt: new Date(job.created_at * 1000),
      fineTunedModel: job.fine_tuned_model ?? undefined,
    };
  }

  async getJobStatus(remoteId: string): Promise<FineTuningJob | null> {
    try {
      const data = await this.fetchJSON<{
        success: boolean;
        job: {
          id: string;
          model: string;
          status: string;
          created_at: number;
          fine_tuned_model?: string | null;
          error?: string;
        };
      }>(`/api/training/jobs/${remoteId}`);

      const job = data.job;
      return {
        id: job.id,
        remoteId: job.id,
        model: job.model,
        status: mapHFStatus(job.status),
        createdAt: new Date(job.created_at * 1000),
        fineTunedModel: job.fine_tuned_model ?? undefined,
        error: job.error,
      };
    } catch (err) {
      this.log(`getJobStatus(${remoteId}) failed`, {
        error: (err as Error).message,
      });
      return null;
    }
  }

  async cancelJob(remoteId: string): Promise<FineTuningJob | null> {
    try {
      const data = await this.fetchJSON<{
        success: boolean;
        job: {
          id: string;
          status: string;
        };
      }>(`/api/training/jobs/${remoteId}/cancel`, {
        method: "POST",
      });

      return {
        id: data.job.id,
        remoteId: data.job.id,
        model: "huggingface-local",
        status: mapHFStatus(data.job.status),
        createdAt: new Date(),
      };
    } catch (err) {
      this.log(`cancelJob(${remoteId}) failed`, {
        error: (err as Error).message,
      });
      return null;
    }
  }

  async listModels(): Promise<TrainingModelInfo[]> {
    try {
      const data = await this.fetchJSON<{
        success: boolean;
        models: Array<{
          id: string;
          owned_by: string;
          fine_tunable: boolean;
        }>;
      }>("/api/training/models");

      return data.models.map((m) => ({
        id: m.id,
        ownedBy: m.owned_by,
        fineTunable: m.fine_tunable,
      }));
    } catch (err) {
      this.log("listModels failed", { error: (err as Error).message });
      // Fallback to static list so the UI doesn't break on transient errors.
      return [
        { id: "meta-llama/Llama-2-7b-hf", ownedBy: "meta", fineTunable: true },
        { id: "meta-llama/Llama-2-13b-hf", ownedBy: "meta", fineTunable: true },
        { id: "mistralai/Mistral-7B-v0.1", ownedBy: "mistralai", fineTunable: true },
        { id: "google/gemma-2b", ownedBy: "google", fineTunable: true },
      ];
    }
  }
}

/** Map microservice status strings to canonical FineTuningStatus. */
function mapHFStatus(rawStatus: string): FineTuningStatus {
  switch (rawStatus) {
    case "queued":
      return "queued";
    case "running":
      return "running";
    case "succeeded":
      return "succeeded";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      // Unknown status from the microservice should not be silently treated as
      // "running" — that would cause infinite polling. Log and surface as failed.
      logger.warn(`Unknown training status from microservice: ${rawStatus}`);
      return "failed";
  }
}
