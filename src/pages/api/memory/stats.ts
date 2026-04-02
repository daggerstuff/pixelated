import {
  assertRequestedUser,
  getGateway,
  jsonResponse,
  toMemoryScope,
  withAuthenticatedMemoryRoute,
} from './_shared'

export async function buildMemoryStatsResponse(
  request: Request,
  user: { id: string },
): Promise<Response> {
  const url = new URL(request.url)
  const requestedUserId = url.searchParams.get('userId')
  const userError = assertRequestedUser(user.id, requestedUserId)
  if (userError) {
    return userError
  }

  const stats = await getGateway().getMemoryStats({
    ...toMemoryScope(user.id),
    limit: 500,
    offset: 0,
  })

  return jsonResponse({
    success: true,
    ...stats,
    recentActivity: [],
  })
}

export const GET = withAuthenticatedMemoryRoute('retrieving memory stats', async ({ request }, user) =>
  buildMemoryStatsResponse(request, user),
)
