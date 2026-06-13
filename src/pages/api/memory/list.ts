import {
  assertRequestedUser,
  getGateway,
  jsonResponse,
  parsePagination,
  toMemoryScope,
  withAuthenticatedMemoryRoute,
} from './_shared'

function toUnifiedMemoryFormat(memory: any, userId: string) {
  return {
    id: memory.id,
    tenantId: memory.tenantId ?? 'default',
    userId: memory.userId ?? userId,
    bankId: memory.bankId ?? 'default',
    content: memory.content,
    scope: memory.scope ?? 'session',
    retention: memory.retention ?? 'short_term',
    category: memory.category ?? 'general',
    tags: memory.tags ?? [],
    version: memory.version ?? 1,
    schemaVersion: memory.schemaVersion ?? '1.0.0',
    sourceService: memory.sourceService ?? 'astro-frontend',
    importance: memory.importance ?? 0.5,
    decayRate: memory.decayRate ?? 0.01,
    strengthTrend: memory.strengthTrend ?? 'stable',
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
  }
}

export const GET = withAuthenticatedMemoryRoute(
  'listing memories',
  async ({ request }, user) => {
    const url = new URL(request.url)
    const { limit, offset } = parsePagination(url)
    const requestedUserId = url.searchParams.get('userId')
    const category = url.searchParams.get('category')
    const tags = url.searchParams.getAll('tag')

    const userError = assertRequestedUser(user.id, requestedUserId)
    if (userError) {
      return userError
    }

    const result = await getGateway().listMemories({
      ...toMemoryScope(user.id, user.accountId, user.workspaceId),
      limit,
      offset,
      category: category ?? undefined,
      tags,
    })

    return jsonResponse({
      success: true,
      memories: (result.memories ?? []).map((m: any) =>
        toUnifiedMemoryFormat(m, user.id),
      ),
      pagination: { limit, offset, total: result.total },
    })
  },
)
