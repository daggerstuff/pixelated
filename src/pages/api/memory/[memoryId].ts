import {
  getGateway,
  jsonError,
  jsonResponse,
  toMemoryScope,
  withAuthenticatedMemoryRoute,
} from './_shared'

function resolveMemoryId(
  params: Record<string, string | undefined>,
): string | undefined {
  return params.memoryId
}

export const GET = withAuthenticatedMemoryRoute(
  'fetching memory',
  async ({ params, request }, user) => {
    const memoryId = resolveMemoryId(params)
    if (!memoryId) {
      return jsonError(400, 'Bad Request', 'memoryId parameter is required')
    }

    const memory = await getGateway().getMemory({
      ...toMemoryScope(user.id),
      memoryId,
    })
    if (!memory) {
      return jsonError(404, 'Not Found', 'Memory not found')
    }

    return jsonResponse({
      success: true,
      memory,
    })
  },
)

const handlePatch = withAuthenticatedMemoryRoute(
  'updating memory',
  async ({ params, request }, user) => {
    const memoryId = resolveMemoryId(params)
    if (!memoryId) {
      return jsonError(400, 'Bad Request', 'memoryId parameter is required')
    }

    const body = await request.json()
    const content = typeof body.content === 'string' ? body.content : body.text
    if (!content) {
      return jsonError(400, 'Bad Request', 'content parameter is required')
    }

    const result = await getGateway().updateMemory({
      ...toMemoryScope(user.id),
      memoryId,
      content,
      metadata: body.metadata,
    })

    return jsonResponse({
      success: true,
      memory: result,
    })
  },
)

export const PATCH = handlePatch

export const DELETE = withAuthenticatedMemoryRoute(
  'deleting memory',
  async ({ params, request }, user) => {
    const memoryId = resolveMemoryId(params)
    if (!memoryId) {
      return jsonError(400, 'Bad Request', 'memoryId parameter is required')
    }

    await getGateway().deleteMemory({
      ...toMemoryScope(user.id),
      memoryId,
    })

    return jsonResponse({
      success: true,
      message: 'Memory deleted successfully',
    })
  },
)
