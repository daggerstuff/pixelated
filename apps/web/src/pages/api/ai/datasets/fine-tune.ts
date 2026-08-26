import type { APIRoute } from "astro";

import { getCurrentUser } from "@/lib/auth";
import { hasPermission, type UserRole } from "@/lib/auth/roles";
import { createBuildSafeLogger } from "@/lib/logging/build-safe-logger";
import { logSecurityEvent } from "@/lib/security";
import { ALLOWED_DIRECTORIES, safeJoin } from "@/utils/path-security";
import { getDefaultProvenanceStore } from "@/lib/ai/datasets/provenance";
import { mergedDatasetExists } from "../../../../lib/ai/datasets/merge-datasets";
import {
  preparedDatasetsExist,
  prepareAllFormats,
} from "../../../../lib/ai/datasets/prepare-fine-tuning";
import {
  getDefaultOrchestrator,
} from "../../../../lib/ai/training/FineTuningOrchestrator";
import type {
  FineTuningBackend,
  FineTuningConfig,
  TrainingDatasetReference,
} from "../../../../lib/ai/training/types";

const logger = createBuildSafeLogger("fine-tune-api");

interface FineTuneBody {
  model: string;
  backend: string;
  nEpochs?: number;
  suffix?: string;
  batchSize?: number;
  learningRateMultiplier?: number;
  format?: string;
  prepareIfMissing?: boolean;
  parentMergeRunId?: string;
}

/** Validates and coerces the request body into a FineTuningConfig. */
function validateConfig(body: FineTuneBody): FineTuningConfig {
  if (!body.model || typeof body.model !== "string" || !body.model.trim()) {
    throw new Error("'model' is required and must be a non-empty string.");
  }
  if (
    !body.backend ||
    typeof body.backend !== "string" ||
    !["openai", "huggingface", "local", "dry-run"].includes(body.backend)
  ) {
    throw new Error(
      "'backend' is required and must be one of: openai, huggingface, local, dry-run.",
    );
  }
  if (
    body.nEpochs !== undefined &&
    (typeof body.nEpochs !== "number" || body.nEpochs < 1)
  ) {
    throw new Error("'nEpochs' must be a positive number.");
  }

  return {
    model: body.model.trim(),
    backend: body.backend as FineTuningBackend,
    suffix: body.suffix?.trim(),
    nEpochs: body.nEpochs ?? 3,
    batchSize: body.batchSize,
    learningRateMultiplier: body.learningRateMultiplier,
  };
}

/** Build a safe dataset path for the given format. */
function datasetPath(format: "openai" | "huggingface"): string {
  const baseDir = safeJoin(ALLOWED_DIRECTORIES.PROJECT_ROOT, "data", "prepared");
  const filename =
    format === "openai" ? "openai_dataset.jsonl" : "huggingface_dataset.jsonl";
  return safeJoin(baseDir, filename);
}

/**
 * Resolve prepared dataset paths, creating them on-demand if
 * `prepareIfMissing` is true. Validates provenance lineage first.
 */
async function resolveDatasetPaths(
  format: "openai" | "huggingface" | "all",
  parentMergeRunId: string | undefined,
  prepareIfMissing: boolean,
): Promise<TrainingDatasetReference> {
  if (parentMergeRunId) {
    const store = getDefaultProvenanceStore();
    const exists = await store.exists(parentMergeRunId);
    if (!exists) {
      throw new Error(
        `parentMergeRunId "${parentMergeRunId}" not found in provenance store.`,
      );
    }
  }

  const existing = preparedDatasetsExist();
  const allReady = existing.openai && existing.huggingface;

  if (!allReady) {
    if (!prepareIfMissing) {
      throw new Error(
        "No prepared datasets found. Run POST /api/ai/datasets/prepare first, or send { prepareIfMissing: true }.",
      );
    }
    logger.info("Creating prepared datasets on demand", {
      format,
      parentMergeRunId,
    });
    await prepareAllFormats(undefined, undefined, parentMergeRunId);
  }

  const prepared = preparedDatasetsExist();
  return {
    openai: prepared.openai ? datasetPath("openai") : null,
    huggingface: prepared.huggingface ? datasetPath("huggingface") : null,
  };
}

/**
 * POST /api/ai/datasets/fine-tune
 *
 * Submit a fine-tuning job. Orchestrates the full pipeline:
 *   1. Validate auth + RBAC (manage:training_data)
 *   2. Validate provenance lineage (parentMergeRunId)
 *   3. Ensure prepared datasets exist (optionally on-demand)
 *   4. Delegate to FineTuningOrchestrator.startFromPrepared()
 *
 * Provenance: records X-Dataset-Provenance response header.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Unauthorized",
          message: "Valid authentication required",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!hasPermission(user.role as UserRole, "manage:training_data")) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Forbidden",
          message: "Insufficient permissions to manage training data",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    logSecurityEvent("training_data_access", user.id, {
      op: "fine-tune",
      role: user.role,
    });

    const body = (await request.json()) as FineTuneBody;

    if (!mergedDatasetExists()) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Merged dataset not found. Run POST /api/ai/datasets/merge first.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const config = validateConfig(body);

    const resolvedFormat =
      body.format === "huggingface"
        ? "huggingface"
        : body.format === "openai"
          ? "openai"
          : "all";

    const paths = await resolveDatasetPaths(
      resolvedFormat,
      body.parentMergeRunId,
      body.prepareIfMissing ?? false,
    );

    const orchestrator = getDefaultOrchestrator();
    const job = await orchestrator.startFromPrepared(paths, config);

    logger.info(`Fine-tune job started: ${job.id} on ${job.backend}`, {
      userId: user.id,
      model: job.model,
    });

    const response = new Response(
      JSON.stringify({
        success: true,
        job: {
          id: job.id,
          model: job.model,
          status: job.status,
          createdAt: job.createdAt,
          backend: job.backend,
        },
      }),
      { status: 202, headers: { "Content-Type": "application/json" } },
    );

    response.headers.set(
      "X-Dataset-Provenance",
      `fine-tune:${job.id}`,
    );

    return response;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);

    if (
      msg.includes("parentMergeRunId") ||
      msg.includes("not found in provenance") ||
      msg.includes("Invalid backend") ||
      msg.includes("'model'") ||
      msg.includes("'nEpochs'")
    ) {
      return new Response(JSON.stringify({ success: false, error: msg }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (
      msg.includes("No dataset path available") ||
      msg.includes("No prepared datasets found") ||
      msg.includes("No dataset file available")
    ) {
      return new Response(JSON.stringify({ success: false, error: msg }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    logger.error(`Error in fine-tune API: ${msg}`);

    return new Response(
      JSON.stringify({ success: false, error: "An unexpected error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};

/**
 * GET /api/ai/datasets/fine-tune
 *
 * List fine-tune jobs visible to the current user.
 * Admins see all jobs; other roles see only their own.
 * Auth: requires read:training_jobs permission.
 */
export const GET: APIRoute = async ({ request }) => {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!hasPermission(user.role as UserRole, "read:training_jobs")) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Forbidden",
          message: "Insufficient permissions to read training jobs",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    const orchestrator = getDefaultOrchestrator();
    const allJobs = await orchestrator.listJobsAsync();

    const isAdmin =
      user.role === "admin" ||
      hasPermission(user.role as UserRole, "admin");
    const jobs = isAdmin
      ? allJobs
      : allJobs.filter((j) => !j.ownerId || j.ownerId === user.id);

    return new Response(
      JSON.stringify({
        success: true,
        jobs: jobs.map((j) => ({
          id: j.id,
          model: j.model,
          status: j.status,
          createdAt: j.createdAt,
          updatedAt: j.updatedAt,
          fineTunedModel: j.fineTunedModel,
          backend: j.backend,
          error: j.error,
        })),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    logger.error(`Error listing fine-tune jobs: ${String(error)}`);
    return new Response(
      JSON.stringify({ success: false, error: "An unexpected error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
