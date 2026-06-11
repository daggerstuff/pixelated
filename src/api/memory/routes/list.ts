/**
 * @file List Memories Endpoint
 *
 * GET /api/memory
 *
 * Lists memories with optional filtering and pagination.
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
  'listing memories',
  async ({ request }, user) => {
    try {
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
          pagination: {
            limit,
            offset,
            total: result.total,
          },
        },
        message: 'Memories retrieved successfully',
      })
    } catch {
      return jsonError(500, 'Internal Server Error', 'Failed to list memories')
    }
  },
)
