/**
 * @file Search Memories Endpoint
 *
 * GET /api/memory/search
 * POST /api/memory/search
 *
 * Searches memories using text-based queries with optional filtering.
 */

import {
  assertRequestedUser,
  getGateway,
  jsonError,
  jsonResponse,
  parsePagination,
  toMemoryScope,
  withAuthenticatedMemoryRoute,
} from "../_shared";

export const GET = withAuthenticatedMemoryRoute("searching memories", async ({ request }, user) => {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q");
    const { limit, offset } = parsePagination(url);
    const requestedUserId = url.searchParams.get("userId");
    const category = url.searchParams.get("category");
    const tags = url.searchParams.getAll("tag");

    const userError = assertRequestedUser(user.id, requestedUserId);
    if (userError) {
      return userError;
    }

    if (!query) {
      return jsonError(400, "Bad Request", "Search query parameter (q) is required");
    }

    const result = await getGateway().searchMemories({
      ...toMemoryScope(user.id, user.accountId, user.workspaceId),
      query,
      limit,
      offset,
      category: category ?? undefined,
      tags: tags.length > 0 ? tags : undefined,
    });

    return jsonResponse({
      success: true,
      data: {
        memories: result.memories.map((memory) => ({
          id: memory.id,
          content: memory.content,
          metadata: memory.metadata,
          createdAt: memory.createdAt,
          updatedAt: memory.updatedAt,
        })),
        query,
        pagination: {
          limit,
          offset,
          total: result.total,
        },
      },
      message: "Memories searched successfully",
    });
  } catch (error) {
    return jsonError(500, "Internal Server Error", "Failed to search memories");
  }
});

export const POST = withAuthenticatedMemoryRoute(
  "searching memories",
  async ({ request }, user) => {
    try {
      const body = await request.json();
      const query = typeof body.query === "string" ? body.query : body.q;
      const requestedUserId = body.user_id ?? body.userId;
      const limit = Number.isFinite(body.limit) && body.limit > 0 ? Math.min(body.limit, 100) : 10;
      const offset = Number.isFinite(body.offset) && body.offset >= 0 ? body.offset : 0;
      const category = body.category;
      const tags = Array.isArray(body.tags) ? body.tags : [];

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
        offset,
        category,
        tags,
      });

      return jsonResponse({
        success: true,
        data: {
          memories: result.memories.map((memory) => ({
            id: memory.id,
            content: memory.content,
            metadata: memory.metadata,
            createdAt: memory.createdAt,
            updatedAt: memory.updatedAt,
          })),
          query,
          pagination: {
            limit,
            offset,
            total: result.total,
          },
        },
        message: "Memories searched successfully",
      });
    } catch (error) {
      return jsonError(500, "Internal Server Error", "Failed to search memories");
    }
  },
);
