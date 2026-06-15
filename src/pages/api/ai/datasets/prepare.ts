import type { APIRoute } from "astro";

import { getCurrentUser } from "@/lib/auth";
import { hasPermission, type UserRole } from "@/lib/auth/roles";
import { createBuildSafeLogger } from "@/lib/logging/build-safe-logger";
import { logSecurityEvent } from "@/lib/security";
import { getDefaultProvenanceStore } from "@/lib/ai/datasets/provenance";

import { mergedDatasetExists } from "../../../../lib/ai/datasets/merge-datasets";
import {
  prepareAllFormats,
  prepareForOpenAI,
  prepareForHuggingFace,
  preparedDatasetsExist,
  type DatasetPaths,
} from "../../../../lib/ai/datasets/prepare-fine-tuning";
const logger = createBuildSafeLogger("dataset-prepare");

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
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (!hasPermission(user.role as UserRole, "manage:training_data")) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Forbidden",
          message: "Insufficient permissions to manage training data",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    logSecurityEvent("training_data_access", user.id, {
      op: "prepare",
      role: user.role,
    });

    const body = (await request.json()) as {
      format?: string;
      force?: boolean;
      parentMergeRunId?: string;
    };
    const { format = "all", force = false, parentMergeRunId } = body;

    if (!mergedDatasetExists()) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Merged dataset not found. Run the dataset merge process first.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const existingDatasets = preparedDatasetsExist();
    if (
      !force &&
      ((format === "all" && existingDatasets.openai && existingDatasets.huggingface) ||
        (format === "openai" && existingDatasets.openai) ||
        (format === "huggingface" && existingDatasets.huggingface))
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Prepared datasets already exist. Use force: true to recreate.",
          existingDatasets,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Validate parentMergeRunId before calling prepare functions
    if (parentMergeRunId) {
      const store = getDefaultProvenanceStore();
      const mergeExists = await store.exists(parentMergeRunId);
      if (!mergeExists) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `parentMergeRunId "${parentMergeRunId}" not found in provenance store.`,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    let result: DatasetPaths | null = null;
    if (format === "all") {
      result = await prepareAllFormats(undefined, undefined, parentMergeRunId);
    } else if (format === "openai") {
      const openaiPath = await prepareForOpenAI(undefined, undefined, parentMergeRunId);
      result = { openai: openaiPath, huggingface: null };
    } else if (format === "huggingface") {
      const huggingfacePath = await prepareForHuggingFace(undefined, undefined, parentMergeRunId);
      result = { openai: null, huggingface: huggingfacePath };
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid format. Use "all", "openai", or "huggingface".',
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (
      !result ||
      (format === "all" && (!result.openai || !result.huggingface)) ||
      (format === "openai" && !result.openai) ||
      (format === "huggingface" && !result.huggingface)
    ) {
      logger.error("Dataset preparation failed via API call");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to prepare datasets. Check server logs for details.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Datasets prepared successfully",
        openai: result.openai,
        huggingface: result.huggingface,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);

    // Distinguish provenance validation errors
    if (msg.includes("parentMergeRunId") || msg.includes("not found in provenance store")) {
      return new Response(JSON.stringify({ success: false, error: msg }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    logger.error(`Error in dataset preparation API: ${msg}`);

    return new Response(JSON.stringify({ success: false, error: "An unexpected error occurred" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const GET: APIRoute = async ({ request }) => {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Unauthorized",
          message: "Valid authentication required",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const preparedStatus = preparedDatasetsExist();
    const mergedExists = mergedDatasetExists();

    return new Response(
      JSON.stringify({
        mergedDatasetExists: mergedExists,
        preparedDatasets: preparedStatus,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    logger.error(`Error in dataset preparation status API: ${String(error)}`);

    return new Response(
      JSON.stringify({
        success: false,
        error: "An unexpected error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
