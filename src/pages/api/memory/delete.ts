import {
  getGateway,
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
      return jsonResponse(
        {
          success: false,
          error: 'Bad Request',
          message: 'memoryId parameter is required',
        },
        400,
      )
    }

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
