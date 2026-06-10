import {
  getGateway,
  jsonError,
  jsonResponse,
  toMemoryScope,
  withAuthenticatedMemoryRoute,
} from "./_shared";

function resolveMemoryId(params: Record<string, string | undefined>): string | undefined {
  return params["memoryId"];
}

function toUnifiedMemoryFormat(memory: any, userId: string) {
  return {
    id: memory.id,
    tenantId: memory.tenantId ?? "default",
    userId: memory.userId ?? userId,
    bankId: memory.bankId ?? "default",
    content: memory.content,
    scope: memory.scope ?? "session",
    retention: memory.retention ?? "short_term",
    category: memory.category ?? "general",
    tags: memory.tags ?? [],
    version: memory.version ?? 1,
    schemaVersion: memory.schemaVersion ?? "1.0.0",
    sourceService: memory.sourceService ?? "astro-frontend",
    importance: memory.importance ?? 0.5,
    decayRate: memory.decayRate ?? 0.01,
    strengthTrend: memory.strengthTrend ?? "stable",
    activationCount: memory.activationCount ?? 0,
    retrievalCount: memory.retrievalCount ?? 0,
    isGhost: memory.isGhost ?? false,
    gist: memory.gist ?? null,
    synthesizedFrom: memory.synthesizedFrom ?? [],
    vectorId: memory.vectorId ?? null,
    emotionalContext: memory.emotionalContext ?? null,
    empathyMetrics: memory.empathyMetrics ?? null,
    createdAt: memory.createdAt ?? new Date().toISOString(),
    updatedAt: memory.updatedAt ?? null,
    accessedAt: memory.accessedAt ?? null,
    lastRetrievedAt: memory.lastRetrievedAt ?? null,
  };
}

export const GET = withAuthenticatedMemoryRoute(
  "fetching memory",
  async ({ params, request }, user) => {
    const memoryId = resolveMemoryId(params ?? {});
    if (!memoryId) {
      return jsonError(400, "Bad Request", "memoryId parameter is required");
    }

    const memory = await getGateway().getMemory({
      ...toMemoryScope(user.id, user.accountId, user.workspaceId),
      memoryId,
    });
    if (!memory) {
      return jsonError(404, "Not Found", "Memory not found");
    }

    return jsonResponse({
      success: true,
      memory: toUnifiedMemoryFormat(memory, user.id),
    });
  },
);

const handlePatch = withAuthenticatedMemoryRoute(
  "updating memory",
  async ({ params, request }, user) => {
    const memoryId = resolveMemoryId(params ?? {});
    if (!memoryId) {
      return jsonError(400, "Bad Request", "memoryId parameter is required");
    }

    const body: Record<string, unknown> = (await request.json()) as Record<string, unknown>;
    const contentBody = body["content"];
    const textBody = body["text"];
    const content: string =
      typeof contentBody === "string" ? contentBody : typeof textBody === "string" ? textBody : "";
    if (!content) {
      return jsonError(400, "Bad Request", "content parameter is required");
    }

    const result = await getGateway().updateMemory({
      ...toMemoryScope(user.id, user.accountId, user.workspaceId),
      memoryId,
      content,
      metadata: body["metadata"] as Record<string, unknown> | undefined,
    });

    return jsonResponse({
      success: true,
      memory: toUnifiedMemoryFormat(result, user.id),
    });
  },
);

export const PATCH = handlePatch;

export const DELETE = withAuthenticatedMemoryRoute(
  "deleting memory",
  async ({ params, request }, user) => {
    const memoryId = resolveMemoryId(params ?? {});
    if (!memoryId) {
      return jsonError(400, "Bad Request", "memoryId parameter is required");
    }

    await getGateway().deleteMemory({
      ...toMemoryScope(user.id, user.accountId, user.workspaceId),
      memoryId,
    });

    return jsonResponse({
      success: true,
      message: "Memory deleted successfully",
    });
  },
);
