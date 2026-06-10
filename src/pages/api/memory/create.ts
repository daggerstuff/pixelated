import {
  getGateway,
  jsonError,
  jsonResponse,
  toMemoryScope,
  withAuthenticatedMemoryRoute,
} from "./_shared";

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

export const POST = withAuthenticatedMemoryRoute("creating memory", async ({ request }, user) => {
  const body = await request.json();
  const { content, metadata } = body;

  if (!content) {
    return jsonError(400, "Bad Request", "content parameter is required");
  }

  // Create memory
  const result = await getGateway().createMemory({
    ...toMemoryScope(user.id, user.accountId, user.workspaceId),
    content,
    metadata,
  });

  return jsonResponse(
    {
      success: true,
      memory_id: result.id,
      memory: toUnifiedMemoryFormat(result, user.id),
    },
    201,
  );
});
