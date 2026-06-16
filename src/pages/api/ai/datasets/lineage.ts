import type { APIRoute } from "astro";

import { getCurrentUser } from "@/lib/auth";
import { hasPermission, type UserRole } from "@/lib/auth/roles";
import { createBuildSafeLogger } from "@/lib/logging/build-safe-logger";
import { ProvenanceNotFoundError, getDefaultProvenanceStore } from "@/lib/ai/datasets/provenance";

const logger = createBuildSafeLogger("dataset-lineage");

export const GET: APIRoute = async ({ url, request }) => {
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
        JSON.stringify({ success: false, error: "Forbidden", message: "Insufficient permissions" }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    const runId = url.searchParams.get("runId");
    if (!runId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required query parameter: runId" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const store = getDefaultProvenanceStore();
    const lineage = await store.getLineage(runId);

    return new Response(JSON.stringify({ success: true, lineage }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);

    // Distinguish "not found" from unexpected errors
    if (error instanceof ProvenanceNotFoundError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Provenance record not found",
          runId: url.searchParams.get("runId"),
        }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    logger.error("Error in lineage API", { error: msg });
    return new Response(JSON.stringify({ success: false, error: "An unexpected error occurred" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
