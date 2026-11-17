import type { UnifiedMemory } from '@pixelated/memory-schema'
import { MEMORY_SCHEMA_VERSION } from '@pixelated/memory-schema'

import {
  assertRequestedUser,
  getGateway,
  jsonError,
  jsonResponse,
  parsePagination,
  toMemoryScope,
  withAuthenticatedMemoryRoute,
} from './_shared'

function toUnifiedMemoryFormat(memory: UnifiedMemory, userId: string) {
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
    schemaVersion: memory.schemaVersion ?? MEMORY_SCHEMA_VERSION,
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
      memories: result.memories.map((m) => toUnifiedMemoryFormat(m, user.id)),
      query,
      pagination: { limit, offset, total: result.total },
      user: { id: user.id, role: user.role },
    })
  },
)

type ParsedSearchBody =
  | {
      ok: true
      query: string
      requestedUserId: string | undefined
      limit: number
    }
  | { ok: false; response: Response }

function parseSearchBody(payload: unknown): ParsedSearchBody {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return {
      ok: false,
      response: jsonError(
        400,
        'Bad Request',
        'Request body must be a JSON object',
      ),
    }
  }

  const body = payload as Record<string, unknown>
  const candidate =
    typeof body['query'] === 'string' ? body['query'] : body['q']

  if (
    candidate !== undefined &&
    candidate !== null &&
    typeof candidate !== 'string'
  ) {
    return {
      ok: false,
      response: jsonError(400, 'Bad Request', 'Search query must be a string'),
    }
  }

  const rawUserId = body['user_id'] ?? body['userId']
  if (
    rawUserId !== undefined &&
    rawUserId !== null &&
    typeof rawUserId !== 'string'
  ) {
    return {
      ok: false,
      response: jsonError(
        400,
        'Bad Request',
        'userId must match the authenticated user',
      ),
    }
  }

  const rawLimit = body['limit']
  const limit =
    typeof rawLimit === 'number' && Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, 100)
      : 10

  return {
    ok: true,
    query: candidate ?? '',
    requestedUserId: rawUserId ?? undefined,
    limit,
  }
}

export const POST = withAuthenticatedMemoryRoute(
  'searching memories',
  async ({ request }, user) => {
    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return jsonError(400, 'Bad Request', 'Request body must be valid JSON')
    }

    const parsed = parseSearchBody(payload)
    if (!parsed.ok) {
      return parsed.response
    }

    const { limit, query, requestedUserId } = parsed

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
      memories: result.memories.map((m) => toUnifiedMemoryFormat(m, user.id)),
      query,
      pagination: { limit, offset: 0, total: result.total },
      user: { id: user.id, role: user.role },
    })
  },
)
