/**
 * @file Memory by ID Endpoints
 *
 * GET /api/memory/{memoryId}
 * PATCH /api/memory/{memoryId}
 * DELETE /api/memory/{memoryId}
 *
 * Retrieves, updates, or deletes a specific memory record by its ID.
 */

import { z } from 'zod'

import {
  getGateway,
  jsonError,
  jsonResponse,
  toMemoryScope,
  withAuthenticatedMemoryRoute,
} from '../_shared'

// Define the input schema for updating a memory
const UpdateMemoryRequestSchema = z
  .object({
    content: z.string().min(1).max(100000).optional(),
    scope: z.enum(['session', 'arc', 'trait', 'fact']).optional(),
    retention: z
      .enum(['ephemeral', 'short_term', 'long_term', 'permanent'])
      .optional(),
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
  .partial()

export type UpdateMemoryRequest = z.infer<typeof UpdateMemoryRequestSchema>

// Memory IDs are constrained to alphanumeric, hyphen, and underscore characters
// (per the system's ID contract). We VALIDATE rather than sanitize: silently
// stripping characters would let a malformed request (e.g. "mem-123!") resolve to a
// DIFFERENT record on GET/PATCH/DELETE. Invalid IDs are rejected with 400 instead.
const MEMORY_ID_PATTERN = /^[a-zA-Z0-9_-]+$/

function isValidMemoryId(id: string): boolean {
  return MEMORY_ID_PATTERN.test(id)
}

// Helper function to extract and validate the memory ID from params.
// Returns: `undefined` if missing, `null` if present but malformed, else the valid id.
function resolveMemoryId(
  params: Record<string, string | undefined>,
): string | null | undefined {
  const memoryId = params['memoryId']
  if (!memoryId) return undefined
  return isValidMemoryId(memoryId) ? memoryId : null
}

export const GET = withAuthenticatedMemoryRoute(
  'fetching memory',
  async ({ params, request }, user) => {
    try {
      const memoryId = resolveMemoryId(params ?? {})
      if (memoryId === undefined) {
        return jsonError(400, 'Bad Request', 'memoryId parameter is required')
      }
      if (memoryId === null) {
        return jsonError(400, 'Bad Request', 'Invalid memoryId format')
      }

      const memory = await getGateway().getMemory({
        ...toMemoryScope(user.id, user.accountId, user.workspaceId),
        memoryId,
      })

      if (!memory) {
        return jsonError(404, 'Not Found', 'Memory not found')
      }

      return jsonResponse({
        success: true,
        data: {
          id: memory.id,
          content: memory.content,
          metadata: {
            scope: memory.scope,
            retention: memory.retention,
            category: memory.category,
            tags: memory.tags,
            importance: memory.importance,
            emotionalContext: memory.emotionalContext,
            empathyMetrics: memory.empathyMetrics,
          },
          createdAt: memory.createdAt,
          updatedAt: memory.updatedAt,
        },
        message: 'Memory retrieved successfully',
      })
    } catch {
      return jsonError(500, 'Internal Server Error', 'Failed to fetch memory')
    }
  },
)

export const PATCH = withAuthenticatedMemoryRoute(
  'updating memory',
  async ({ params, request }, user) => {
    try {
      const memoryId = resolveMemoryId(params ?? {})
      if (memoryId === undefined) {
        return jsonError(400, 'Bad Request', 'memoryId parameter is required')
      }
      if (memoryId === null) {
        return jsonError(400, 'Bad Request', 'Invalid memoryId format')
      }

      // Parse and validate the request body
      const body: unknown = await request.json()
      const parsedBody = UpdateMemoryRequestSchema.parse(body)

      // Fetch existing memory to preserve content if not being updated
      const existing = await getGateway().getMemory({
        ...toMemoryScope(user.id, user.accountId, user.workspaceId),
        memoryId,
      })

      if (!existing) {
        return jsonError(404, 'Not Found', 'Memory not found')
      }

      // Update memory using the gateway
      const result = await getGateway().updateMemory({
        ...toMemoryScope(user.id, user.accountId, user.workspaceId),
        memoryId,
        content: parsedBody.content ?? existing?.content ?? '',
        metadata: {
          scope: parsedBody.scope,
          retention: parsedBody.retention,
          category: parsedBody.category,
          tags: parsedBody.tags,
          importance: parsedBody.importance,
          emotionalContext: parsedBody.emotionalContext,
          empathyMetrics: parsedBody.empathyMetrics,
        },
      })

      return jsonResponse({
        success: true,
        data: {
          id: result.id,
          content: result.content,
          metadata: {
            scope: result.scope,
            retention: result.retention,
            category: result.category,
            tags: result.tags,
            importance: result.importance,
            emotionalContext: result.emotionalContext,
            empathyMetrics: result.empathyMetrics,
          },
        },
        message: 'Memory updated successfully',
      })
    } catch (error) {
      // Handle validation errors
      if (error instanceof z.ZodError) {
        return jsonError(
          400,
          'Validation Error',
          'Invalid request body format or content',
        )
      }

      return jsonError(500, 'Internal Server Error', 'Failed to update memory')
    }
  },
)

export const DELETE = withAuthenticatedMemoryRoute(
  'deleting memory',
  async ({ params, request }, user) => {
    try {
      const memoryId = resolveMemoryId(params ?? {})
      if (memoryId === undefined) {
        return jsonError(400, 'Bad Request', 'memoryId parameter is required')
      }
      if (memoryId === null) {
        return jsonError(400, 'Bad Request', 'Invalid memoryId format')
      }

      await getGateway().deleteMemory({
        ...toMemoryScope(user.id, user.accountId, user.workspaceId),
        memoryId,
      })

      return jsonResponse({
        success: true,
        message: 'Memory deleted successfully',
      })
    } catch {
      return jsonError(500, 'Internal Server Error', 'Failed to delete memory')
    }
  },
)
