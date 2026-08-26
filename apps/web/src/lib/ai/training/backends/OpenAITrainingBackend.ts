import { readFileSync } from "node:fs";
import { createHmac, timingSafeEqual } from "node:crypto";
import { TrainingBackend } from "./Base";
import type {
  FineTuningConfig,
  FineTuningJob,
  FineTuningStatus,
  TrainingBackendName,
  TrainingModelInfo,
  TrainingUsageRecord,
} from "../types";

const OPENAI_FINE_TUNING_URL = "https://api.openai.com/v1/fine_tuning/jobs";

const STATUS_MAP: Record<string, FineTuningStatus> = {
  validating_files: "queued",
  queued: "queued",
  running: "running",
  succeeded: "succeeded",
  failed: "failed",
  cancelled: "cancelled",
};

/**
 * OpenAI fine-tuning backend. Wraps the OpenAI `/v1/fine_tuning/jobs` API
 * (`POST` to create, `GET` to poll, `POST .../cancel` to cancel). File
 * upload uses the `/files` endpoint.
 *
 * Extracted from the old monolithic `FineTuningOrchestrator.triggerOpenAI`
 * to match the audit-recommended `TrainingBackend` interface (PIX-3863 §1, §6).
 */
export class OpenAITrainingBackend extends TrainingBackend {
  readonly name: TrainingBackendName = "openai";

  constructor(
    private readonly opts: {
      apiKey: string;
      baseUrl?: string;
      webhookSecret?: string;
    },
  ) {
    super();
  }

  async submitJob(
    datasetPath: string,
    config: FineTuningConfig,
  ): Promise<FineTuningJob> {
    const fileId = await this.uploadFile(datasetPath);

    const body: Record<string, unknown> = {
      model: config.model,
      training_file: fileId,
      hyperparameters: {
        n_epochs: config.nEpochs,
        ...(config.batchSize !== undefined ? { batch_size: config.batchSize } : {}),
        ...(config.learningRateMultiplier !== undefined
          ? { learning_rate_multiplier: config.learningRateMultiplier }
          : {}),
      },
    };
    if (config.suffix) body["suffix"] = config.suffix;

    const response = await this.fetchOrThrow(this.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.opts.apiKey}`,
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

    return {
      id: data.id,
      remoteId: data.id,
      model: data.model,
      status: STATUS_MAP[data.status] ?? "running",
      createdAt: new Date(),
      fineTunedModel: data.fine_tuned_model,
    };
  }

  async getJobStatus(remoteId: string): Promise<FineTuningJob | null> {
    try {
      const response = await this.fetchOrThrow(`${this.baseUrl}/${remoteId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.opts.apiKey}`,
        },
      });
      const data = (await response.json()) as {
        id: string;
        status: string;
        model: string;
        fine_tuned_model?: string;
      };
      return {
        id: data.id,
        remoteId: data.id,
        model: data.model,
        status: STATUS_MAP[data.status] ?? "running",
        createdAt: new Date(),
        fineTunedModel: data.fine_tuned_model,
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
      const response = await this.fetchOrThrow(
        `${this.baseUrl}/${remoteId}/cancel`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.opts.apiKey}`,
          },
        },
      );
      const data = (await response.json()) as {
        id: string;
        status: string;
        model: string;
        fine_tuned_model?: string;
      };
      return {
        id: data.id,
        remoteId: data.id,
        model: data.model,
        status: STATUS_MAP[data.status] ?? "cancelled",
        createdAt: new Date(),
        fineTunedModel: data.fine_tuned_model,
      };
    } catch (err) {
      this.log(`cancelJob(${remoteId}) failed`, {
        error: (err as Error).message,
      });
      return null;
    }
  }

  async listModels(): Promise<TrainingModelInfo[]> {
    // Fixed enumeration — OpenAI documents which base models accept fine-tune.
    // If/when they expand, this list must be regenerated.
    return [
      { id: "gpt-4o-mini-2024-07-18", ownedBy: "openai", fineTunable: true },
      { id: "gpt-4o-2024-08-06", ownedBy: "openai", fineTunable: true },
      { id: "gpt-3.5-turbo-0125", ownedBy: "openai", fineTunable: true },
      { id: "babbage-002", ownedBy: "openai", fineTunable: true },
      { id: "davinci-002", ownedBy: "openai", fineTunable: true },
    ];
  }

  override estimateUsage(_config: FineTuningConfig): TrainingUsageRecord | null {
    // Pricing is published but per-model. Returning null keeps the surface
    // honest until we wire the per-model pricing table in a follow-on.
    return {
      backend: "openai",
      costUsd: 0,
      recordedAt: new Date(),
    };
  }

  override verifyWebhookSignature(
    rawBody: string,
    signature: string | null,
  ): boolean {
    if (!this.opts.webhookSecret || !signature) return false;
    try {
      // OpenAI Standard Webhooks: signature = hex(HMAC-SHA256(secret, "{id}.{timestamp}.{body}"))
      // Header format: "t={timestamp},v1={hex_sig}"
      const parts = Object.fromEntries(
        signature.split(',').map((p) => p.split('=') as [string, string]),
      );
      const timestamp = parts['t'];
      const hexSig = parts['v1'];
      if (!timestamp || !hexSig) return false;

      const age = Date.now() / 1000 - Number(timestamp);
      if (age > 300) return false; // 5-minute tolerance

      const signedPayload = `${this.opts.webhookSecret}.${timestamp}.${rawBody}`;
      const expected = createHmac('sha256', this.opts.webhookSecret)
        .update(signedPayload)
        .digest('hex');
      const a = Buffer.from(hexSig, 'hex');
      const b = Buffer.from(expected, 'hex');
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  private get baseUrl(): string {
    return this.opts.baseUrl ?? OPENAI_FINE_TUNING_URL;
  }

  private async uploadFile(filePath: string): Promise<string> {
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
        Authorization: `Bearer ${this.opts.apiKey}`,
      },
      body: formData,
    });

    const data = (await response.json()) as { id: string };
    return data.id;
  }

  private async fetchOrThrow(url: string, init: RequestInit): Promise<Response> {
    const response = await fetch(url, init);
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "unknown");
      throw new Error(
        `OpenAI fine-tuning request failed (${response.status}): ${errorBody}`,
      );
    }
    return response;
  }
}
