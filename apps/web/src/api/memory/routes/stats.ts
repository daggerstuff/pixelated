/**
 * @file Memory Stats Endpoint
 *
 * GET /api/memory/stats
 *
 * Retrieves statistics about memory usage and distribution.
 */

import {
  getGateway,
  jsonError,
  jsonResponse,
  toMemoryScope,
  withAuthenticatedMemoryRoute,
} from '../_shared'

export const GET = withAuthenticatedMemoryRoute(
  'getting memory stats',
  async ({ request }, user) => {
    try {
      const url = new URL(request.url)
      const category = url.searchParams.get('category')
      const scope = url.searchParams.get('scope') as
        | 'session'
        | 'arc'
        | 'trait'
        | 'fact'
        | null
      const retention = url.searchParams.get('retention') as
        | 'ephemeral'
        | 'short_term'
        | 'long_term'
        | 'permanent'
        | null

      const stats = await getGateway().getMemoryStats({
        ...toMemoryScope(user.id, user.accountId, user.workspaceId),
        category: category ?? undefined,
        scope: scope ?? undefined,
        retention: retention ?? undefined,
      })

      return jsonResponse({
        success: true,
        data: {
          totalMemories: stats.totalMemories,
          categoryCounts: stats.categoryCounts,
        },
        message: 'Memory statistics retrieved successfully',
      })
    } catch (error) {
      return jsonError(
        500,
        'Internal Server Error',
        'Failed to get memory statistics',
      )
    }
  },
)
