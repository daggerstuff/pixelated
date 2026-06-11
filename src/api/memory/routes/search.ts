/**
 * @file Search Memories Endpoint
 *
 * GET /api/memory/search
 * POST /api/memory/search
 *
 * Searches memories using text-based queries with optional filtering.
 */

import {
  assertRequestedUser,
  getGateway,
  jsonError,
  jsonResponse,
  parsePagination,
  toMemoryScope,
  withAuthenticatedMemoryRoute,
} from '../_shared'

export const GET = withAuthenticatedMemoryRoute(
  'searching memories',
  async ({ request }, user) => {
    try {
      const url = new URL(request.url)
      const query = url.searchParams.get('q')
      const { limit, offset } = parsePagination(url)
      const requestedUserId = url.searchParams.get('userId')
      const category = url.searchParams.get('category')
      const tags = url.searchParams.getAll('tag')

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
        category: category ?? undefined,
        tags: tags.length > 0 ? tags : undefined,
      })

      return jsonResponse({
        success: true,
        data: {
          memories: result.memories.map((memory) => ({
            id: memory.id,
            content: memory.content,
            metadata: {
              scope: memory.scope,
              retention: memory.retention,
              category: memory.category,
              tags: memory.tags,
              importance: memory.importance,
              emotionalContext: memory.emotionalContext,
              empathyMetrics: memory.empathyMetrics,
            },
            createdAt: memory.createdAt,
            updatedAt: memory.updatedAt,
          })),
          query,
          pagination: {
            limit,
            offset,
            total: result.total,
          },
        },
        message: 'Memories searched successfully',
      })
    } catch {
      return jsonError(
        500,
        'Internal Server Error',
        'Failed to search memories',
      )
    }
  },
)

export const POST = withAuthenticatedMemoryRoute(
  'searching memories',
  async ({ request }, user) => {
    try {
      const body: unknown = await request.json()

      if (typeof body !== 'object' || body === null) {
        return jsonError(400, 'Bad Request', 'Invalid request body')
      }

      const query =
        'query' in body && typeof body.query === 'string'
          ? body.query
          : 'q' in body && typeof body.q === 'string'
            ? body.q
            : ''

      const requestedUserId =
        'user_id' in body && typeof body.user_id === 'string'
          ? body.user_id
          : 'userId' in body && typeof body.userId === 'string'
            ? body.userId
            : null

      const limit =
        'limit' in body &&
        typeof body.limit === 'number' &&
        Number.isFinite(body.limit) &&
        body.limit > 0
          ? Math.min(Math.floor(body.limit), 100)
          : 10

      const offset =
        'offset' in body &&
        typeof body.offset === 'number' &&
        Number.isFinite(body.offset) &&
        body.offset >= 0
          ? Math.floor(body.offset)
          : 0

      const category =
        'category' in body && typeof body.category === 'string'
          ? body.category
          : undefined

      const rawTags: unknown = 'tags' in body ? body.tags : undefined
      const tags: string[] | undefined =
        Array.isArray(rawTags) &&
        rawTags.every((tag: unknown): tag is string => typeof tag === 'string')
          ? rawTags
          : undefined

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
        offset,
        category,
        tags,
      })

      return jsonResponse({
        success: true,
        data: {
          memories: result.memories.map((memory) => ({
            id: memory.id,
            content: memory.content,
            metadata: {
              scope: memory.scope,
              retention: memory.retention,
              category: memory.category,
              tags: memory.tags,
              importance: memory.importance,
              emotionalContext: memory.emotionalContext,
              empathyMetrics: memory.empathyMetrics,
            },
            createdAt: memory.createdAt,
            updatedAt: memory.updatedAt,
          })),
          query,
          pagination: {
            limit,
            offset,
            total: result.total,
          },
        },
        message: 'Memories searched successfully',
      })
    } catch {
      return jsonError(
        500,
        'Internal Server Error',
        'Failed to search memories',
      )
    }
  },
)
