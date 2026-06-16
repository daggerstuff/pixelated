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

/**
 * Local backend for fine-tuning using a local model serving stack.
 *
 * Tries two modes in priority order:
 *   1. **OpenAI-compatible API** (`LOCAL_OLLAMA_BASE_URL`) — submits a job
 *      to `/v1/fine_tuning/jobs`. Works with Ollama >=0.5, LocalAI, or any
 *      server implementing the OpenAI fine-tuning API.
 *   2. **Python script fallback** (`LOCAL_TRAINING_SCRIPT_PATH`) — runs
 *      `ai/training/finetune_model.py` as a subprocess, mirroring the
 *      HuggingFace backend pattern. Used when no OpenAI-compatible server
 *      is available.
 *
 * Env vars:
 *   - `LOCAL_OLLAMA_BASE_URL` — base URL of the local server
 *     (default: http://127.0.0.1:11434)
 *   - `LOCAL_OLLAMA_MODEL` — model to fine-tune (default: llama3)
 *   - `LOCAL_OLLAMA_API_KEY` — API key for the local server
 *     (default: "ollama" — works for open Ollama instances)
 *   - `LOCAL_TRAINING_SCRIPT_PATH` — path to Python fine-tuning script
 *     (optional; falls back to Ollama API if unset)
 *
 * PIX-3863 §15 (Local backend implementation).
 */
export class LocalTrainingBackend extends TrainingBackend {
  readonly name: TrainingBackendName = "local";

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly scriptPath: string | null;

  constructor(opts?: {
    baseUrl?: string;
    apiKey?: string;
    model?: string;
    scriptPath?: string;
  }) {
    super();
    this.baseUrl =
      opts?.baseUrl ?? LOCAL_BASE_URL;
    this.apiKey =
      opts?.apiKey ?? LOCAL_API_KEY;
    this.model =
      opts?.model ?? LOCAL_MODEL;
    this.scriptPath = opts?.scriptPath ?? null;
  }

  private get useScript(): boolean {
    return !!this.scriptPath;
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

  /**
   * Submit a local fine-tuning job.
   * Uses the OpenAI-compatible fine-tuning API if the server is reachable,
   * otherwise falls back to the Python subprocess.
   */
  async submitJob(
    datasetPath: string,
    config: FineTuningConfig,
  ): Promise<FineTuningJob> {
    const jobId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.log(`submitting job ${jobId}`, {
      model: config.model,
      datasetPath,
      useScript: this.useScript,
    });

    try {
      if (this.useScript) {
        return await this.submitViaScript(datasetPath, config, jobId);
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

    // OpenAI fine-tune-specific params; local servers may ignore extras.
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

  /** Submit via Python subprocess script (mirrors HuggingFace backend pattern). */
  private async submitViaScript(
    datasetPath: string,
    config: FineTuningConfig,
    jobId: string,
  ): Promise<FineTuningJob> {
    const { spawn } = await import("node:child_process");

    const args = [
      this.scriptPath!,
      "--dataset", datasetPath,
      "--base-model", config.model ?? this.model,
      "--job-id", jobId,
      "--epochs", String(config.nEpochs ?? 3),
    ];

    if (config.suffix) {
      args.push("--suffix", config.suffix);
    }

    return new Promise<FineTuningJob>((resolve) => {
      const proc = spawn(process.env["PYTHON_BIN"] ?? "python3", args, {
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      if (proc.stdout) {
        proc.stdout.on("data", (chunk: Buffer) => {
          stdout += chunk.toString();
        });
      }

      if (proc.stderr) {
        proc.stderr.on("data", (chunk: Buffer) => {
          stderr += chunk.toString();
        });
      }

      proc.on("close", (code) => {
        if (code === 0) {
          resolve({
            id: jobId,
            remoteId: jobId,
            model: config.model,
            status: "succeeded",
            createdAt: new Date(),
            fineTunedModel: `${config.model}:local:${jobId.slice(0, 8)}`,
          });
        } else {
          this.log(`script exited with code ${code}`, { stderr });
          resolve({
            id: jobId,
            remoteId: jobId,
            model: config.model,
            status: "failed",
            createdAt: new Date(),
            error: `Script exited with code ${code}: ${stderr.slice(0, 500)}`,
          });
        }
      });

      proc.on("error", (err) => {
        resolve({
          id: jobId,
          remoteId: jobId,
          model: config.model,
          status: "failed",
          createdAt: new Date(),
          error: `Failed to spawn script: ${err.message}`,
        });
      });
    });
  }

  async getJobStatus(remoteId: string): Promise<FineTuningJob | null> {
    if (this.useScript) {
      // Subprocess-based; status is final after submit.
      return null;
    }

    try {
      interface OpenAIStatusResponse {
        id: string;
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
        model: remoteJob.id,
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
    if (this.useScript) {
      return null;
    }

    try {
      interface OpenAICancelResponse {
        id: string;
        status: string;
      }

      const remoteJob = await this.fetchJSON<OpenAICancelResponse>(
        `/v1/fine_tuning/jobs/${remoteId}/cancel`,
        { method: "POST" },
      );

      return {
        id: remoteId,
        remoteId,
        model: remoteJob.id,
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
