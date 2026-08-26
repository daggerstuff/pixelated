import {
  getGateway,
  jsonResponse,
  toMemoryScope,
  withAuthenticatedMemoryRoute,
} from './_shared'

export const POST = withAuthenticatedMemoryRoute(
  'creating memory',
  async ({ request }, user) => {
    const body = await request.json()
    const { content, metadata } = body

    if (!content) {
      return jsonResponse(
        {
          success: false,
          error: 'Bad Request',
          message: 'content parameter is required',
        },
        400,
      )
    }

    const result = await getGateway().createMemory({
      ...toMemoryScope(user.id, user.accountId, user.workspaceId),
      content,
      metadata,
    })

    return jsonResponse(
      { success: true, memory_id: result.id, memory: result },
      201,
    )
  },
)
