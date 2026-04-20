import {
  assertRequestedUser,
  getGateway,
  jsonResponse,
  toMemoryScope,
  withAuthenticatedMemoryRoute,
} from "./_shared";

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

  // Get the full user object with accountId and workspaceId from auth
  const authUser = await requireMemoryUser(request);
  
  const stats = await getGateway().getMemoryStats({
    ...toMemoryScope(authUser!.id, authUser!.accountId, authUser!.workspaceId),
    limit: 500,
    offset: 0,
  })

  return jsonResponse({
    success: true,
    ...stats,
    recentActivity: [],
  })
}

  const stats = await getGateway().getMemoryStats({
    ...toMemoryScope(user.id, user.accountId, user.workspaceId),
    limit: 500,
    offset: 0,
  })

  return jsonResponse({
    success: true,
    ...stats,
    recentActivity: [],
  })
}

  const stats = await getGateway().getMemoryStats({
    ...toMemoryScope(user.id, user.accountId, user.workspaceId),
    limit: 500,
    offset: 0,
  });

  return jsonResponse({
    success: true,
    ...stats,
    recentActivity: [],
  });
}

export const GET = withAuthenticatedMemoryRoute(
  "retrieving memory stats",
  async ({ request }, user) => buildMemoryStatsResponse(request, user),
);
