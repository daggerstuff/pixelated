import {
  getGateway,
  jsonError,
  jsonResponse,
  toMemoryScope,
  withAuthenticatedMemoryRoute,
} from './_shared'

const handleUpdate = withAuthenticatedMemoryRoute(
  'updating memory',
  async ({ request }, user) => {
    const body = await request.json()
    const { memoryId, content, metadata } = body

    if (!memoryId || !content) {
      return jsonError(
        400,
        'Bad Request',
        'memoryId and content parameters are required',
      )
    }

    const result = await getGateway().updateMemory({
      ...toMemoryScope(user.id),
      memoryId,
      content,
      metadata,
    })

    return jsonResponse({
      success: true,
      memory: result,
    })
  },
)

export const PUT = handleUpdate
export const PATCH = handleUpdate
