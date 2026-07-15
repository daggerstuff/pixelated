import { TrainingBackend } from "./Base";
import type {
  FineTuningConfig,
  FineTuningJob,
  FineTuningStatus,
  TrainingBackendName,
  TrainingModelInfo,
  TrainingUsageRecord,
} from "../types";

const LOCAL_BASE_URL =
  process.env["LOCAL_OLLAMA_BASE_URL"] ??
  process.env["OLLAMA_BASE_URL"] ??
  "http://127.0.0.1:11434";

const LOCAL_MODEL = process.env["LOCAL_OLLAMA_MODEL"] ?? "llama3";

/**
 * OpenAI-compatible API key for local servers that require one.
 * Set to a dummy value for open Ollama instances.
 */
const LOCAL_API_KEY =
  process.env["LOCAL_OLLAMA_API_KEY"] ?? "ollama";

const MICROSERVICE_BASE_URL =
  process.env["AI_SERVICE_URL"] ?? "http://localhost:5000";

const MICROSERVICE_API_KEY =
  process.env["AI_SERVICE_API_KEY"] ?? "pixelated-internal";

/**
 * Local backend for fine-tuning using a local model serving stack.
 *
 * Tries two modes in priority order:
 *   1. **OpenAI-compatible API** (`LOCAL_OLLAMA_BASE_URL`) — submits a job
 *      to `/v1/fine_tuning/jobs`. Works with Ollama >=0.5, LocalAI, or any
 *      server implementing the OpenAI fine-tuning API.
 *   2. **Microservice script fallback** (`LOCAL_TRAINING_SCRIPT_PATH`) — routes
 *      to the AI microservice (`ai-services/api.py`) which spawns
 *      `ai/training/finetune_model.py` in isolation. This eliminates direct
 *      Python subprocess execution from the main application (PIX-3926).
 *
 * Env vars:
 *   - `LOCAL_OLLAMA_BASE_URL` — base URL of the local server
 *     (default: http://127.0.0.1:11434)
 *   - `LOCAL_OLLAMA_MODEL` — model to fine-tune (default: llama3)
 *   - `LOCAL_OLLAMA_API_KEY` — API key for the local server
 *     (default: "ollama" — works for open Ollama instances)
 *   - `LOCAL_TRAINING_SCRIPT_PATH` — deprecated; kept for backwards compat.
 *     When set, the backend routes through the AI microservice instead of
 *     spawning Python directly.
 *   - `AI_SERVICE_URL` — URL of the AI microservice
 *     (default: http://localhost:5000)
 *   - `AI_SERVICE_API_KEY` — API key for the microservice
 *
 * PIX-3863 §15 (Local backend implementation).
 * PIX-3926 (AI Microservice Isolation).
 */
export class LocalTrainingBackend extends TrainingBackend {
  readonly name: TrainingBackendName = "local";

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly useMicroservice: boolean;
  private readonly microserviceUrl: string;
  private readonly microserviceKey: string;

  constructor(opts?: {
    baseUrl?: string;
    apiKey?: string;
    model?: string;
    scriptPath?: string;
    microserviceUrl?: string;
    microserviceKey?: string;
  }) {
    super();
    this.baseUrl = opts?.baseUrl ?? LOCAL_BASE_URL;
    this.apiKey = opts?.apiKey ?? LOCAL_API_KEY;
    this.model = opts?.model ?? LOCAL_MODEL;
    this.useMicroservice = !!(
      opts?.scriptPath ?? process.env["LOCAL_TRAINING_SCRIPT_PATH"]
    );
    this.microserviceUrl =
      (opts?.microserviceUrl ?? MICROSERVICE_BASE_URL).replace(/\/$/, "");
    this.microserviceKey = opts?.microserviceKey ?? MICROSERVICE_API_KEY;
  }

  private async fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const mergedHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
    if (init?.headers != null) {
      Object.assign(mergedHeaders, init.headers as Record<string, string>);
    }
    const res = await fetch(url, {
      ...init,
      headers: mergedHeaders,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "(no body)");
      throw new Error(
        `Local backend ${this.baseUrl}${path} returned ${res.status}: ${body}`,
      );
    }

    return res.json() as Promise<T>;
  }

  private async fetchMicroservice<T>(
    path: string,
    init?: RequestInit,
  ): Promise<T> {
    const url = `${this.microserviceUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Pixelated-Client": "internal",
      "X-API-Key": this.microserviceKey,
    };
    if (init?.headers) {
      Object.assign(headers, init.headers as Record<string, string>);
    }

    const res = await fetch(url, {
      ...init,
      headers,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "(no body)");
      throw new Error(
        `Local microservice ${path} returned ${res.status}: ${body}`,
      );
    }

    return res.json() as Promise<T>;
  }

  /**
   * Submit a local fine-tuning job.
   * Uses the OpenAI-compatible fine-tuning API if the server is reachable,
   * otherwise routes through the AI microservice for script-based execution.
   */
  async submitJob(
    datasetPath: string,
    config: FineTuningConfig,
  ): Promise<FineTuningJob> {
    const jobId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.log(`submitting job ${jobId}`, {
      model: config.model,
      datasetPath,
      useMicroservice: this.useMicroservice,
    });

    try {
      if (this.useMicroservice) {
        return await this.submitViaMicroservice(datasetPath, config, jobId);
      }
      return await this.submitViaAPI(datasetPath, config, jobId);
    } catch (err) {
      this.log(`job ${jobId} failed`, { error: String(err) });
      return {
        id: jobId,
        remoteId: jobId,
        model: config.model,
        status: "failed",
        createdAt: new Date(),
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** Submit via OpenAI-compatible `/v1/fine_tuning/jobs` endpoint. */
  private async submitViaAPI(
    datasetPath: string,
    config: FineTuningConfig,
    jobId: string,
  ): Promise<FineTuningJob> {
    interface OpenAIFineTuningResponse {
      id: string;
      object: string;
      status: string;
      model: string;
      created_at: number;
      trained_model?: string;
      error?: { message: string; code: string };
    }

    const body: Record<string, unknown> = {
      model: config.model ?? this.model,
      training_file: datasetPath,
    };

    if (config.nEpochs !== undefined) {
      body["hyperparameters"] = { num_epochs: config.nEpochs };
    }
    if (config.suffix) {
      body["suffix"] = config.suffix;
    }

    const remoteJob = await this.fetchJSON<OpenAIFineTuningResponse>(
      "/v1/fine_tuning/jobs",
      { method: "POST", body: JSON.stringify(body) },
    );

    return {
      id: jobId,
      remoteId: remoteJob.id,
      model: remoteJob.model ?? config.model,
      status: this.mapOpenAIStatus(remoteJob.status),
      createdAt: new Date(remoteJob.created_at * 1000),
      fineTunedModel: remoteJob.trained_model,
      error: remoteJob.error?.message,
    };
  }

  /** Submit via AI microservice (isolates Python subprocess execution). */
  private async submitViaMicroservice(
    datasetPath: string,
    config: FineTuningConfig,
    jobId: string,
  ): Promise<FineTuningJob> {
    const body: Record<string, unknown> = {
      model: config.model ?? this.model,
      dataset: datasetPath,
      epochs: config.nEpochs ?? 3,
    };
    if (config.batchSize !== undefined) {
      body["batch_size"] = config.batchSize;
    }
    if (config.learningRateMultiplier !== undefined) {
      body["learning_rate"] = config.learningRateMultiplier * 2e-5;
    }

    const data = await this.fetchMicroservice<{
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
      id: jobId,
      remoteId: job.id,
      model: job.model,
      status: mapLocalStatus(job.status),
      createdAt: new Date(job.created_at * 1000),
      fineTunedModel: job.fine_tuned_model ?? undefined,
    };
  }

  async getJobStatus(remoteId: string): Promise<FineTuningJob | null> {
    if (this.useMicroservice) {
      try {
        const data = await this.fetchMicroservice<{
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
          status: mapLocalStatus(job.status),
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

    try {
      interface OpenAIStatusResponse {
        id: string;
        model: string;
        status: string;
        trained_model?: string;
        error?: { message: string };
      }

      const remoteJob = await this.fetchJSON<OpenAIStatusResponse>(
        `/v1/fine_tuning/jobs/${remoteId}`,
      );

      return {
        id: remoteId,
        remoteId,
        model: remoteJob.model,
        status: this.mapOpenAIStatus(remoteJob.status),
        createdAt: new Date(),
        fineTunedModel: remoteJob.trained_model,
        error: remoteJob.error?.message,
      };
    } catch {
      return null;
    }
  }

  async cancelJob(remoteId: string): Promise<FineTuningJob | null> {
    if (this.useMicroservice) {
      try {
        const data = await this.fetchMicroservice<{
          success: boolean;
          job: { id: string; status: string; model?: string };
        }>(`/api/training/jobs/${remoteId}/cancel`, {
          method: "POST",
        });

        return {
          id: data.job.id,
          remoteId: data.job.id,
          model: data.job.model ?? this.model,
          status: mapLocalStatus(data.job.status),
          createdAt: new Date(),
        };
      } catch (err) {
        this.log(`cancelJob(${remoteId}) failed`, {
          error: (err as Error).message,
        });
        return null;
      }
    }

    try {
      interface OpenAICancelResponse {
        id: string;
        model: string;
        status: string;
      }

      const remoteJob = await this.fetchJSON<OpenAICancelResponse>(
        `/v1/fine_tuning/jobs/${remoteId}/cancel`,
        { method: "POST" },
      );

      return {
        id: remoteId,
        remoteId,
        model: remoteJob.model,
        status: this.mapOpenAIStatus(remoteJob.status),
        createdAt: new Date(),
      };
    } catch {
      return null;
    }
  }

  async listModels(): Promise<TrainingModelInfo[]> {
    try {
      interface OllamaModelList {
        models?: Array<{ name: string; model?: string }>;
      }
      const result = await this.fetchJSON<OllamaModelList>("/api/tags");
      return (result.models ?? []).map((m) => ({
        id: m.name ?? m.model ?? "unknown",
        ownedBy: "local",
        fineTunable: true,
      }));
    } catch {
      return [
        { id: this.model, ownedBy: "local", fineTunable: true },
      ];
    }
  }

  override estimateUsage(
    _config: FineTuningConfig,
  ): TrainingUsageRecord | null {
    return null;
  }

  override verifyWebhookSignature(): boolean {
    return false;
  }

  /** Map OpenAI job status strings to our internal status. */
  private mapOpenAIStatus(status: string): FineTuningStatus {
    switch (status) {
      case "pending":
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
        return "queued";
    }
  }
}

/** Map microservice status strings to canonical FineTuningStatus. */
function mapLocalStatus(rawStatus: string): FineTuningStatus {
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
      return "running";
  }
}
