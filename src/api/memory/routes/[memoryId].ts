/**
 * @file Memory by ID Endpoints
 *
 * GET /api/memory/{memoryId}
 * PATCH /api/memory/{memoryId}
 * DELETE /api/memory/{memoryId}
 *
 * Retrieves, updates, or deletes a specific memory record by its ID.
 */

import {
  getGateway,
  jsonError,
  jsonResponse,
  toMemoryScope,
  withAuthenticatedMemoryRoute,
} from "../_shared";
import { z } from "zod";

// Define the input schema for updating a memory
const UpdateMemoryRequestSchema = z
  .object({
    content: z.string().min(1).max(100000).optional(),
    scope: z.enum(["session", "arc", "trait", "fact"]).optional(),
    retention: z.enum(["ephemeral", "short_term", "long_term", "permanent"]).optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    importance: z.number().min(0).max(1).optional(),
    emotionalContext: z
      .object({
        valence: z.number().min(-1).max(1),
        arousal: z.number().min(0).max(1),
        dominance: z.number().min(0).max(1),
        primaryEmotion: z.string(),
        intensity: z.number().min(0).max(1),
      })
      .optional()
      .nullable(),
    empathyMetrics: z
      .object({
        reciprocity: z.number().min(0).max(1),
        validationAccuracy: z.number().min(0).max(1),
        resistanceLevel: z.number().min(0).max(1),
      })
      .optional()
      .nullable(),
  })
  .partial();

export type UpdateMemoryRequest = z.infer<typeof UpdateMemoryRequestSchema>;

// Helper function to extract memory ID from params
function resolveMemoryId(params: Record<string, string | undefined>): string | undefined {
  return params["memoryId"];
}

export const GET = withAuthenticatedMemoryRoute(
  "fetching memory",
  async ({ params, request }, user) => {
    try {
      const memoryId = resolveMemoryId(params ?? {});
      if (!memoryId) {
        return jsonError(400, "Bad Request", "memoryId parameter is required");
      }

      const memory = await getGateway().getMemory({
        ...toMemoryScope(user.id, user.accountId, user.workspaceId),
        memoryId,
      });

      if (!memory) {
        return jsonError(404, "Not Found", "Memory not found");
      }

      return jsonResponse({
        success: true,
        data: {
          id: memory.id,
          content: memory.content,
          metadata: memory.metadata,
          createdAt: memory.createdAt,
          updatedAt: memory.updatedAt,
        },
        message: "Memory retrieved successfully",
      });
    } catch (error) {
      return jsonError(500, "Internal Server Error", "Failed to fetch memory");
    }
  },
);

export const PATCH = withAuthenticatedMemoryRoute(
  "updating memory",
  async ({ params, request }, user) => {
    try {
      const memoryId = resolveMemoryId(params ?? {});
      if (!memoryId) {
        return jsonError(400, "Bad Request", "memoryId parameter is required");
      }

      // Parse and validate the request body
      const body = await request.json();
      const parsedBody = UpdateMemoryRequestSchema.parse(body);

      // Update memory using the gateway
      const result = await getGateway().updateMemory({
        ...toMemoryScope(user.id, user.accountId, user.workspaceId),
        memoryId,
        content: parsedBody.content || "",
        metadata: {
          scope: parsedBody.scope,
          retention: parsedBody.retention,
          category: parsedBody.category,
          tags: parsedBody.tags,
          importance: parsedBody.importance,
          emotionalContext: parsedBody.emotionalContext,
          empathyMetrics: parsedBody.empathyMetrics,
        },
      });

      return jsonResponse({
        success: true,
        data: {
          id: result.id,
          content: result.content,
          metadata: result.metadata,
        },
        message: "Memory updated successfully",
      });
    } catch (error) {
      // Handle validation errors
      if (error instanceof z.ZodError) {
        return jsonError(
          400,
          "Validation Error",
          "Invalid request body: " +
            error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", "),
        );
      }

      return jsonError(500, "Internal Server Error", "Failed to update memory");
    }
  },
);

export const DELETE = withAuthenticatedMemoryRoute(
  "deleting memory",
  async ({ params, request }, user) => {
    try {
      const memoryId = resolveMemoryId(params ?? {});
      if (!memoryId) {
        return jsonError(400, "Bad Request", "memoryId parameter is required");
      }

      await getGateway().deleteMemory({
        ...toMemoryScope(user.id, user.accountId, user.workspaceId),
        memoryId,
      });

      return jsonResponse({
        success: true,
        message: "Memory deleted successfully",
      });
    } catch (error) {
      return jsonError(500, "Internal Server Error", "Failed to delete memory");
    }
  },
);
