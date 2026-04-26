import {
  assertRequestedUser,
  getGateway,
  jsonResponse,
  parsePagination,
  toMemoryScope,
  withAuthenticatedMemoryRoute,
} from "./_shared";

export const GET = withAuthenticatedMemoryRoute("listing memories", async ({ request }, user) => {
  const url = new URL(request.url);
  const { limit, offset } = parsePagination(url);
  const requestedUserId = url.searchParams.get("userId");
  const category = url.searchParams.get("category");
  const tags = url.searchParams.getAll("tag");

  const userError = assertRequestedUser(user.id, requestedUserId);
  if (userError) {
    return userError;
  }

  const result = await getGateway().listMemories({
    ...toMemoryScope(user.id, user.accountId, user.workspaceId),
    limit,
    offset,
    category: category || undefined,
    tags,
  });

  return jsonResponse({
    success: true,
    memories: result.memories,
    pagination: {
      limit,
      offset,
      total: result.total,
    },
  });
});
