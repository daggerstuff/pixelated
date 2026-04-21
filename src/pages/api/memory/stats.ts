import {
  assertRequestedUser,
  getGateway,
  jsonResponse,
  toMemoryScope,
  withAuthenticatedMemoryRoute,
} from "./_shared";

export const GET = withAuthenticatedMemoryRoute(
  "retrieving memory stats",
  async ({ request }, user) => {
    const url = new URL(request.url);
    const requestedUserId = url.searchParams.get("userId");
    const userError = assertRequestedUser(user.id, requestedUserId);
    if (userError) {
      return userError;
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
  },
);
