import {
  assertRequestedUser,
  getGateway,
  jsonResponse,
  toMemoryScope,
  withAuthenticatedMemoryRoute,
} from '../_shared'

export const GET = withAuthenticatedMemoryRoute('retrieving memory stats', async ({ params }, user) => {
  const requestedUserId = params.userId
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
})
