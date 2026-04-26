import {
  assertRequestedUser,
  getGateway,
  jsonError,
  jsonResponse,
  parsePagination,
  toMemoryScope,
  withAuthenticatedMemoryRoute,
} from "./_shared";

export const GET = withAuthenticatedMemoryRoute("searching memories", async ({ request }, user) => {
  const url = new URL(request.url);
  const query = url.searchParams.get("q");
  const { limit, offset } = parsePagination(url);
  const requestedUserId = url.searchParams.get("userId");

  const userError = assertRequestedUser(user.id, requestedUserId);
  if (userError) {
    return userError;
  }

  if (!query) {
    return jsonError(400, "Bad Request", "Search query parameter (q) is required");
  }

  // Search memories
  const result = await getGateway().searchMemories({
    ...toMemoryScope(user.id, user.accountId, user.workspaceId),
    query,
    limit,
    offset,
  });

  return jsonResponse({
    success: true,
    memories: result.memories,
    query,
    pagination: {
      limit,
      offset,
      total: result.total,
    },
    user: {
      id: user.id,
      role: user.role,
    },
  });
});

export const POST = withAuthenticatedMemoryRoute(
  "searching memories",
  async ({ request }, user) => {
    const body = await request.json();
    const query = typeof body.query === "string" ? body.query : body.q;
    const requestedUserId = body.user_id ?? body.userId;
    const limit = Number.isFinite(body.limit) && body.limit > 0 ? Math.min(body.limit, 100) : 10;

    const userError = assertRequestedUser(user.id, requestedUserId);
    if (userError) {
      return userError;
    }

    if (!query) {
      return jsonError(400, "Bad Request", "Search query parameter (query) is required");
    }

    const result = await getGateway().searchMemories({
      ...toMemoryScope(user.id, user.accountId, user.workspaceId),
      query,
      limit,
      offset: 0,
    });

    return jsonResponse({
      success: true,
      memories: result.memories,
      query,
      pagination: {
        limit,
        offset: 0,
        total: result.total,
      },
      user: {
        id: user.id,
        role: user.role,
      },
    });
  },
);
