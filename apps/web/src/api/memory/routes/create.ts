/**
 * @file Create Memory Endpoint
 *
 * POST /api/memory
 *
 * Creates a new memory record in the unified memory system.
 */

import { z } from 'zod'

import {
  getGateway,
  jsonError,
  jsonResponse,
  toMemoryScope,
  withAuthenticatedMemoryRoute,
} from '../_shared'

// Define the input schema with Zod validation
const CreateMemoryRequestSchema = z.object({
  content: z.string().min(1).max(100000),
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
    .optional(),
  empathyMetrics: z
    .object({
      reciprocity: z.number().min(0).max(1),
      validationAccuracy: z.number().min(0).max(1),
      resistanceLevel: z.number().min(0).max(1),
    })
    .optional(),
})

export type CreateMemoryRequest = z.infer<typeof CreateMemoryRequestSchema>

export const POST = withAuthenticatedMemoryRoute(
  'creating memory',
  async ({ request }, user) => {
    try {
      // Parse and validate the request body
      const body: unknown = await request.json()
      const parsedBody = CreateMemoryRequestSchema.parse(body)

      // Create memory using the gateway
      const result = await getGateway().createMemory({
        ...toMemoryScope(user.id, user.accountId, user.workspaceId),
        content: parsedBody.content,
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

      // Return success response with created memory
      return jsonResponse(
        {
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
          message: 'Memory created successfully',
        },
        201, // Created
      )
    } catch (error) {
      // Handle validation errors
      if (error instanceof z.ZodError) {
        return jsonError(
          400, // Bad Request
          'Validation Error',
          'Invalid request body: ' +
            error.issues
              .map((e) => `${e.path.join('.')}: ${e.message}`)
              .join(', '),
        )
      }

      // Handle other errors
      return jsonError(
        500, // Internal Server Error
        'Internal Server Error',
        'Failed to create memory',
      )
    }
  },
)
