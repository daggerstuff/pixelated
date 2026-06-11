/**
 * @file src/pages/api/v1/memory/index.ts
 *
 * v1 public memory API — collection endpoint.
 *
 *   GET  /api/v1/memory          — list memories
 *   POST /api/v1/memory          — create a memory
 *
 * This is the canonical public surface described in
 * `src/lib/memory/contract/v1.ts`. The route handlers:
 *
 *  - authenticate the caller via the existing product session
 *  - validate every input against the Zod schema
 *  - delegate to `ProductMemoryGateway` (NEVER directly to the internal
 *    memory service or MCP transport)
 *  - project internal records to the public `PublicMemory` shape
 *  - return the canonical error envelope on failure
 */
import { getProductMemoryGateway } from '@/lib/services/product-memory-gateway'

import {
  CreateMemoryRequest,
  CreateMemoryResponse,
  ListMemoriesQuery,
  ListMemoriesResponse,
  Pagination,
} from '@/lib/memory/contract/v1'
import {
  handleGatewayError,
  jsonResponse,
  parseRequestJson,
  parseSearchParams,
  requireAuthenticatedMemoryCaller,
  toPublicMemory,
} from '@/lib/memory/contract/route-helpers'

// ---------------------------------------------------------------------------
// GET /api/v1/memory — list
// ---------------------------------------------------------------------------

export const GET = async (context: { request: Request }): Promise<Response> => {
  const auth = await requireAuthenticatedMemoryCaller(context.request)
  if (!auth.ok) return auth.response

  const url = new URL(context.request.url)
  const params = parseSearchParams(ListMemoriesQuery, url)
  if (!params.ok) return params.response
  const { limit = 10, offset = 0, category, tags } = params.data

  try {
    const result = await getProductMemoryGateway().listMemories({
      ...auth.caller.scope,
      limit,
      offset,
      category,
      tags,
    })

    const body: ListMemoriesResponse = {        data: result.memories.map((m) => toPublicMemory(m)),
      pagination: Pagination.parse({
        limit,
        offset,
        total: result.total,
      }),
    }
    return jsonResponse(body)
  } catch (err) {
    return handleGatewayError('listMemories', err)
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/memory — create
// ---------------------------------------------------------------------------

export const POST = async (context: { request: Request }): Promise<Response> => {
  const auth = await requireAuthenticatedMemoryCaller(context.request)
  if (!auth.ok) return auth.response

  const parsed = await parseRequestJson(CreateMemoryRequest, context.request)
  if (!parsed.ok) return parsed.response
  const input = parsed.data

  // The public contract does not accept identity fields; we attach the
  // canonical session-derived scope here. Any caller-supplied identity
  // fields would already have been rejected by the strict Zod schema.
  try {
    const record = await getProductMemoryGateway().createMemory({
      ...auth.caller.scope,
      content: input.content,
      metadata: {
        ...(input.category ? { category: input.category } : {}),
        ...(input.tags ? { tags: input.tags } : {}),
        ...(input.scope ? { scope: input.scope } : {}),
        ...(input.retention ? { retention: input.retention } : {}),
        ...(typeof input.importance === 'number'
          ? { importance: input.importance }
          : {}),
      },
    })

    const body: CreateMemoryResponse = {
      data: toPublicMemory(record),
    }
    return jsonResponse(body, 201)
  } catch (err) {
    return handleGatewayError('createMemory', err)
  }
}
