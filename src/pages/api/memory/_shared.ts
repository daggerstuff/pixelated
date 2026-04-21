import { randomUUID } from "node:crypto";

import { getCurrentUser } from "@/lib/auth";
import { createBuildSafeLogger } from "@/lib/logging/build-safe-logger";
import {
  ProductMemoryGatewayError,
  getProductMemoryGateway,
  type ProductMemoryScope,
} from "@/lib/services/product-memory-gateway";

export const memoryApiLogger = createBuildSafeLogger("memory-api");

export async function requireMemoryUser(request: Request) {
  return getCurrentUser(request);
}

export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export function jsonError(status: number, error: string, message: string): Response {
  return jsonResponse({ error, message }, status);
}

export function parsePagination(url: URL): {
  limit: number;
  offset: number;
} {
  const rawLimit = Number.parseInt(url.searchParams.get("limit") || "10", 10);
  const rawOffset = Number.parseInt(url.searchParams.get("offset") || "0", 10);

  return {
    limit: Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 10,
    offset: Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0,
  };
}

export function getGateway() {
  return getProductMemoryGateway();
}

/** The public product API scopes memory to user+account+workspace only.
 *  Higher-level scope dimensions (orgId, projectId, sessionId, agentId, runId)
 *  are intentionally omitted — they are internal-service concerns not exposed
 *  to external API consumers. */
export function toMemoryScope(
  userId: string,
  accountId?: string,
  workspaceId?: string,
): ProductMemoryScope {
  return {
    userId,
    accountId,
    workspaceId,
    includeShared: true,
  };
}

export function assertRequestedUser(
  actualUserId: string,
  requestedUserId: string | null | undefined,
): Response | null {
  if (requestedUserId && requestedUserId !== actualUserId) {
    return jsonError(400, "Bad Request", "userId must match the authenticated user");
  }
  return null;
}

type MemoryRouteContext = {
  request: Request;
  params?: Record<string, string | undefined>;
  cookies?: unknown;
};

type AuthenticatedMemoryUser = NonNullable<Awaited<ReturnType<typeof requireMemoryUser>>>;

export function withAuthenticatedMemoryRoute<TContext extends MemoryRouteContext>(
  action: string,
  handler: (context: TContext, user: AuthenticatedMemoryUser) => Promise<Response>,
) {
  return async (context: TContext): Promise<Response> => {
    const user = await requireMemoryUser(context.request);
    if (!user) {
      return jsonError(401, "Unauthorized", "You must be authenticated to access this endpoint");
    }

    try {
      return await handler(context, user);
    } catch (error: unknown) {
      return handleMemoryApiError(action, error);
    }
  };
}

export function handleMemoryApiError(action: string, error: unknown): Response {
  const correlationId = randomUUID();

  if (error instanceof ProductMemoryGatewayError) {
    memoryApiLogger.error(`Error ${action}:`, {
      correlationId,
      status: error.status,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    if (error.status === 404) {
      return jsonError(404, "Not Found", "Memory not found");
    }

    if (error.status === 400) {
      return jsonError(400, "Bad Request", "Invalid memory request");
    }

    if (error.status === 401 || error.status === 403) {
      return jsonError(
        502,
        "Bad Gateway",
        `Memory service authorization failed (${correlationId})`,
      );
    }

    return jsonError(502, "Bad Gateway", `Memory service request failed (${correlationId})`);
  }

  if (error instanceof Error) {
    memoryApiLogger.error(`Error ${action}:`, {
      correlationId,
      name: error.name,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return jsonError(500, "Internal Server Error", `Memory operation failed (${correlationId})`);
  }

  memoryApiLogger.error(`Error ${action}:`, {
    correlationId,
    message: "Unknown error",
  });
  return jsonError(500, "Internal Server Error", `Unknown memory error (${correlationId})`);
}
