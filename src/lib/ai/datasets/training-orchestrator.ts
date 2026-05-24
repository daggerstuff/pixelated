import { existsSync, readFileSync } from "node:fs";
import { createBuildSafeLogger } from "../../logging/build-safe-logger";

const logger = createBuildSafeLogger("training-orchestrator");

export type FineTuningBackend = "openai" | "huggingface" | "local" | "dry-run";

export interface FineTuningConfig {
  model: string;
  suffix?: string;
  nEpochs: number;
  batchSize?: number;
  learningRateMultiplier?: number;
  backend: FineTuningBackend;
}

export type FineTuningStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface FineTuningJob {
  id: string;
  model: string;
  status: FineTuningStatus;
  createdAt: Date;
  fineTunedModel?: string;
  error?: string;
}

export interface DatasetPaths {
  openai: string | null;
  huggingface: string | null;
}

const OPENAI_FINE_TUNING_URL = "https://api.openai.com/v1/fine_tuning/jobs";

const DEFAULTS: Required<Pick<FineTuningConfig, "nEpochs" | "batchSize" | "learningRateMultiplier">> = {
  nEpochs: 3,
  batchSize: 16,
  learningRateMultiplier: 1.0,
};

export class FineTuningOrchestrator {
  private readonly apiKey: string | null;
  private readonly baseUrl: string;
  private jobs: FineTuningJob[] = [];

  constructor(opts?: { openaiApiKey?: string; baseUrl?: string }) {
    this.apiKey =
      opts?.openaiApiKey ?? process.env["OPENAI_API_KEY"] ?? null;
    this.baseUrl = opts?.baseUrl ?? OPENAI_FINE_TUNING_URL;
  }

  async startFromPrepared(
    datasetPaths: DatasetPaths,
    config: FineTuningConfig,
  ): Promise<FineTuningJob> {
    const filePath = this.resolveDatasetPath(datasetPaths, config.backend);
    this.validateFile(filePath);

    const resolvedConfig = { ...DEFAULTS, ...config };
    const jobId = this.generateId();

    logger.info(
      `Starting fine-tuning job ${jobId} on ${config.backend} (model: ${config.model})`,
    );

    switch (config.backend) {
      case "openai":
        return this.triggerOpenAI(jobId, filePath, resolvedConfig);
      case "huggingface":
        return this.triggerHuggingFace(jobId, filePath, resolvedConfig);
      case "local":
        return this.triggerLocal(jobId, filePath, resolvedConfig);
      case "dry-run":
        return this.recordJob({
          id: jobId,
          model: config.model,
          status: "succeeded",
          createdAt: new Date(),
          fineTunedModel: `${config.model}:dry-run-${jobId.slice(0, 8)}`,
        });
    }
  }

  async getJobStatus(jobId: string): Promise<FineTuningJob | null> {
    const job = this.jobs.find((j) => j.id === jobId);
    if (!job) return null;
    return { ...job };
  }

  listJobs(): FineTuningJob[] {
    return [...this.jobs];
  }

  private resolveDatasetPath(
    paths: DatasetPaths,
    backend: FineTuningBackend,
  ): string {
    if (backend === "openai") {
      if (!paths.openai) throw new Error("OpenAI dataset path not set");
      return paths.openai;
    }
    if (paths.openai) return paths.openai;
    if (paths.huggingface) return paths.huggingface;
    throw new Error("No dataset path available");
  }

  private validateFile(filePath: string): void {
    if (!existsSync(filePath)) {
      throw new Error(`Dataset file not found: ${filePath}`);
    }
    const content = readFileSync(filePath, "utf-8").trim();
    if (!content) {
      throw new Error(`Dataset file is empty: ${filePath}`);
    }
    try {
      JSON.parse(content.split("\n")[0]);
    } catch {
      throw new Error("Dataset file does not contain valid JSONL: " + filePath);
    }
  }

  private async triggerOpenAI(
    jobId: string,
    filePath: string,
    config: FineTuningConfig & typeof DEFAULTS,
  ): Promise<FineTuningJob> {
    if (!this.apiKey) {
      throw new Error(
        "OpenAI API key not configured. Set OPENAI_API_KEY or pass openaiApiKey to constructor.",
      );
    }

    logger.info(`Uploading ${filePath} to OpenAI`);
    const uploadResult = await this.uploadFile(filePath);
    const fileId = uploadResult.id;

    logger.info(`Creating fine-tuning job ${jobId} with file ${fileId}`);
    const body: Record<string, unknown> = {
      model: config.model,
      training_file: fileId,
      hyperparameters: {
        n_epochs: config.nEpochs,
        batch_size: config.batchSize,
        learning_rate_multiplier: config.learningRateMultiplier,
      },
    };
    if (config.suffix) {
      body.suffix = config.suffix;
    }

    const response = await this.fetchOrThrow(this.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as {
      id: string;
      status: string;
      model: string;
      fine_tuned_model?: string;
    };

    return this.recordJob({
      id: data.id,
      model: data.model,
      status: this.mapOpenAIStatus(data.status),
      createdAt: new Date(),
      fineTunedModel: data.fine_tuned_model,
    });
  }

  private async uploadFile(filePath: string): Promise<{ id: string }> {
    const uploadUrl = this.baseUrl.replace("/fine_tuning/jobs", "/files");
    const blob = new Blob([readFileSync(filePath, "utf-8")], {
      type: "application/jsonl",
    });
    const formData = new FormData();
    formData.append("file", blob, "dataset.jsonl");
    formData.append("purpose", "fine-tune");

    const response = await this.fetchOrThrow(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    const data = (await response.json()) as { id: string };
    return data;
  }

  private async triggerHuggingFace(
    _jobId: string,
    _filePath: string,
    _config: FineTuningConfig & typeof DEFAULTS,
  ): Promise<FineTuningJob> {
    throw new Error("HuggingFace fine-tuning backend not yet implemented");
  }

  private async triggerLocal(
    _jobId: string,
    _filePath: string,
    _config: FineTuningConfig & typeof DEFAULTS,
  ): Promise<FineTuningJob> {
    throw new Error("Local fine-tuning backend not yet implemented");
  }

  private async fetchOrThrow(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    const response = await fetch(url, init);
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "unknown");
      throw new Error(
        `Fine-tuning API request failed (${response.status}): ${errorBody}`,
      );
    }
    return response;
  }

  private mapOpenAIStatus(apiStatus: string): FineTuningStatus {
    switch (apiStatus) {
      case "validating_files":
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

  private recordJob(job: FineTuningJob): FineTuningJob {
    this.jobs.push(job);
    return { ...job };
  }

  private generateId(): string {
    return `ft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
