import {
  assertRequestedUser,
  getGateway,
  jsonError,
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
  'searching memories',
  async ({ request }, user) => {
    const url = new URL(request.url)
    const query = url.searchParams.get('q')
    const { limit, offset } = parsePagination(url)
    const requestedUserId = url.searchParams.get('userId')

    const userError = assertRequestedUser(user.id, requestedUserId)
    if (userError) {
      return userError
    }

    if (!query) {
      return jsonError(
        400,
        'Bad Request',
        'Search query parameter (q) is required',
      )
    }

    const result = await getGateway().searchMemories({
      ...toMemoryScope(user.id, user.accountId, user.workspaceId),
      query,
      limit,
      offset,
    })

    return jsonResponse({
      success: true,
      memories: result.memories.map((m: any) =>
        toUnifiedMemoryFormat(m, user.id),
      ),
      query,
      pagination: { limit, offset, total: result.total },
      user: { id: user.id, role: user.role },
    })
  },
)

export const POST = withAuthenticatedMemoryRoute(
  'searching memories',
  async ({ request }, user) => {
    const body = await request.json()
    const query = typeof body.query === 'string' ? body.query : body.q
    const requestedUserId = body.user_id ?? body.userId
    const limit =
      Number.isFinite(body.limit) && body.limit > 0
        ? Math.min(body.limit, 100)
        : 10

    const userError = assertRequestedUser(user.id, requestedUserId)
    if (userError) {
      return userError
    }

    if (!query) {
      return jsonError(
        400,
        'Bad Request',
        'Search query parameter (query) is required',
      )
    }

    const result = await getGateway().searchMemories({
      ...toMemoryScope(user.id, user.accountId, user.workspaceId),
      query,
      limit,
      offset: 0,
    })

    return jsonResponse({
      success: true,
      memories: result.memories.map((m: any) =>
        toUnifiedMemoryFormat(m, user.id),
      ),
      query,
      pagination: { limit, offset: 0, total: result.total },
      user: { id: user.id, role: user.role },
    })
  },
)
