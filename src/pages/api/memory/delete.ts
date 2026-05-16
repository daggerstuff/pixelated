import {
  getGateway,
  jsonError,
  jsonResponse,
  toMemoryScope,
  withAuthenticatedMemoryRoute,
} from './_shared'

export const DELETE = withAuthenticatedMemoryRoute(
  'deleting memory',
  async ({ request }, user) => {
    const body = await request.json()
    const { memoryId } = body

    if (!memoryId) {
      return jsonError(400, 'Bad Request', 'memoryId parameter is required')
    }

    // Delete memory
    await getGateway().deleteMemory({
      ...toMemoryScope(user.id, user.accountId, user.workspaceId),
      memoryId,
    })

    return jsonResponse({
      success: true,
      message: 'Memory deleted successfully',
    })
  },
)
