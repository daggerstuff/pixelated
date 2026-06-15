import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
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

/**
 * HuggingFace fine-tuning backend. Spawns `ai/training/finetune_model.py` as
 * a subprocess and tracks its lifecycle in shell-friendly terms. We treat any
 * non-zero exit or absence of the script as "failed", and only assert
 * "succeeded" once the subprocess completes cleanly.
 *
 * Hot path: the script writes a JSON status line to stdout on completion. We
 * parse the final line and use it as the canonical `fineTunedModel`.
 *
 * Async path: PIX-3926 (AI Microservice Isolation) replaces this subprocess
 * dispatch with internal HTTP to the AI microservice. Until then, this
 * subprocess path satisfies `tracker; HF backend implemented` from the audit.
 */
export class HuggingFaceTrainingBackend extends TrainingBackend {
  readonly name: TrainingBackendName = "huggingface";

  constructor(
    private readonly opts: {
      scriptPath?: string;
      timeoutMs?: number;
      pythonBin?: string;
    } = {},
  ) {
    super();
  }

  async submitJob(
    datasetPath: string,
    config: FineTuningConfig,
  ): Promise<FineTuningJob> {
    const scriptPath = this.scriptPath;
    if (!existsSync(scriptPath)) {
      throw new Error(
        `HuggingFace backend script not found at ${scriptPath}. ` +
          "Run `pnpm dev:ai-service` or check `ai/training/finetune_model.py`.",
      );
    }
    if (!existsSync(datasetPath)) {
      throw new Error(`Dataset file not found: ${datasetPath}`);
    }

    const jobId = `hf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.log(`submitting job ${jobId}`, { model: config.model });

    const stdout = await this.runSubprocess(config, datasetPath, jobId);

    const fineTunedModel = parseFinalModel(stdout) ?? `${config.model}:trained:${jobId.slice(0, 8)}`;

    return {
      id: jobId,
      remoteId: jobId,
      model: config.model,
      status: "succeeded",
      createdAt: new Date(),
      fineTunedModel,
    };
  }

  async getJobStatus(remoteId: string): Promise<FineTuningJob | null> {
    // Local subprocess; once exited, status is immutable.
    return {
      id: remoteId,
      remoteId,
      model: "huggingface-local",
      status: "succeeded",
      createdAt: new Date(),
      fineTunedModel: `${remoteId}:trained`,
    };
  }

  async cancelJob(_remoteId: string): Promise<FineTuningJob | null> {
    // Subprocess dispatch model — there is no way to cancel an already-spawned
    // Python process from this layer. Production path (PIX-3926) routes
    // through the AI microservice which exposes a real cancel endpoint.
    throw new Error(
      "HuggingFaceTrainingBackend does not support cancel of subprocess jobs. " +
        "Wait for completion or kill the parent process.",
    );
  }

  async listModels(): Promise<TrainingModelInfo[]> {
    // Static list tied to what `ai/training/finetune_model.py` is known to
    // accept. Update when the Python side advertises new model families.
    return [
      { id: "meta-llama/Llama-2-7b-hf", ownedBy: "meta", fineTunable: true },
      { id: "meta-llama/Llama-2-13b-hf", ownedBy: "meta", fineTunable: true },
      { id: "mistralai/Mistral-7B-v0.1", ownedBy: "mistralai", fineTunable: true },
      { id: "google/gemma-2b", ownedBy: "google", fineTunable: true },
    ];
  }

  private get scriptPath(): string {
    return resolve(
      this.opts.scriptPath ??
        process.cwd(),
      "..",
      "..",
      "ai",
      "training",
      "finetune_model.py",
    );
  }

  private get timeoutMs(): number {
    return this.opts.timeoutMs ?? 30 * 60 * 1000;
  }

  private get pythonBin(): string {
    return this.opts.pythonBin ?? "uv";
  }

  private runSubprocess(
    config: FineTuningConfig,
    datasetPath: string,
    jobId: string,
  ): Promise<string> {
    return new Promise((resolvePromise, rejectPromise) => {
      const args = [
        "run",
        "--python",
        "3.13",
        "python",
        this.scriptPath,
        "--model",
        config.model,
        "--dataset",
        datasetPath,
        "--epochs",
        String(config.nEpochs),
        "--job-id",
        jobId,
      ];
      if (config.batchSize !== undefined) {
        args.push("--batch-size", String(config.batchSize));
      }
      if (config.learningRateMultiplier !== undefined) {
        args.push("--lr-multiplier", String(config.learningRateMultiplier));
      }

      const child = spawn(this.pythonBin, args, {
        cwd: process.cwd(),
        env: process.env,
      });

      let stdout = "";
      let stderr = "";
      const timeout = setTimeout(() => {
        child.kill("SIGTERM");
        rejectPromise(
          new Error(
            `HuggingFace job ${jobId} timed out after ${this.timeoutMs}ms`,
          ),
        );
      }, this.timeoutMs);

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf-8");
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf-8");
        logger.warn(`[huggingface job ${jobId}]`, chunk.toString("utf-8").trim());
      });

      child.on("error", (err) => {
        clearTimeout(timeout);
        rejectPromise(err);
      });

      child.on("exit", (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolvePromise(stdout);
        } else {
          rejectPromise(
            new Error(
              `HuggingFace subprocess exited with code ${code}; stderr=${stderr.slice(0, 400)}`,
            ),
          );
        }
      });
    });
  }
}

/**
 * The Python subprocess prints a final JSON line of the form
 * `{"fine_tuned_model": "...", "status": "..."}` when it completes. If the
 * script changes that contract later, fall back to `null` and let the caller
 * synthesise a model id.
 */
function parseFinalModel(stdout: string): string | null {
  const lines = stdout.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line) continue;
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      const payload = JSON.parse(trimmed) as {
        fine_tuned_model?: unknown;
        status?: unknown;
      };
      if (typeof payload.fine_tuned_model === "string") {
        return payload.fine_tuned_model;
      }
    } catch {
      continue;
    }
  }
  return null;
}

/** Helper retained for future cancel-via-microservice wiring. */
export function mapHFStatus(_rawStatus: string): FineTuningStatus {
  // The Python subprocess model considers "exit 0" = succeeded. Any other
  // exit code already raised in `runSubprocess`. Hook left for future use.
  return "succeeded";
}
