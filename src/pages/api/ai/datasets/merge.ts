import type { APIRoute } from "astro";

import { getCurrentUser } from "@/lib/auth";
import { hasPermission, type UserRole } from "@/lib/auth/roles";
import { createBuildSafeLogger } from "@/lib/logging/build-safe-logger";
import { logSecurityEvent } from "@/lib/security";

import {
  mergeAllDatasets,
  mergedDatasetExists,
  getMergedDatasetPath,
} from "../../../../lib/ai/datasets/merge-datasets";
const logger = createBuildSafeLogger("dataset-merge");

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
      op: "merge",
      role: user.role,
    });

    const body = (await request.json()) as { force?: boolean };
    const { force = false } = body;

    if (mergedDatasetExists() && !force) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Dataset already exists. Use force: true to recreate.",
          datasetPath: getMergedDatasetPath(),
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const stats = await mergeAllDatasets({ mergedByUserId: user.id });

    if (!stats) {
      logger.error("Dataset merge failed via API call");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to merge datasets. Check server logs for details.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const responseHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (stats.provenance) {
      responseHeaders["X-Dataset-Provenance"] = stats.provenance.mergeRunId;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Datasets merged successfully",
        stats,
        provenance: stats.provenance ?? null,
        datasetPath: getMergedDatasetPath(),
      }),
      {
        status: 200,
        headers: responseHeaders,
      },
    );
  } catch (error: unknown) {
    logger.error(`Error in dataset merge API: ${String(error)}`);

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

    const exists = mergedDatasetExists();

    return new Response(
      JSON.stringify({
        exists,
        datasetPath: exists ? getMergedDatasetPath() : null,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    logger.error(`Error in dataset status API: ${String(error)}`);

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
