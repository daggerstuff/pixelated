import {
  getGateway,
  jsonError,
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
      return jsonError(400, 'Bad Request', 'content parameter is required')
    }

    // Create memory
    const result = await getGateway().createMemory({
      ...toMemoryScope(user.id),
      content,
      metadata,
    })

    return jsonResponse(
      {
        success: true,
        memory_id: result.id,
        memory: result,
      },
      201,
    )
  },
)
