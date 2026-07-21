import {
  jsonResponse,
  parseRequestJson,
  parseSearchParams,
  toPublicMemory,
} from '@/lib/memory/contract/route-helpers'
import {
  CreateMemoryRequest,
  CreateMemoryResponse,
  ListMemoriesQuery,
  ListMemoriesResponse,
  Pagination,
} from '@/lib/memory/contract/v1'
import { withDeveloperV1Contract } from '@/lib/middleware/with-developer-v1-contract'
/**
 * @file src/pages/api/v1/developer/memory/index.ts
 *
 * Developer v1 public memory API — collection endpoint.
 *
 *   GET  /api/v1/developer/memory          — list memories
 *   POST /api/v1/developer/memory          — create a memory
 *
 * Requires a valid API key with the appropriate scope:
 *   GET  → read | memory:read
 *   POST → write | memory:write
 */
import { getProductMemoryGateway } from '@/lib/services/product-memory-gateway'

// ---------------------------------------------------------------------------
// GET /api/v1/developer/memory — list
// ---------------------------------------------------------------------------

export const GET = withDeveloperV1Contract(
  'read',
  async (context, caller) => {
    const url = new URL(context.request.url)
    const params = parseSearchParams(ListMemoriesQuery, url)
    if (!params.ok) return params.response
    const { limit = 10, offset = 0, category, tags } = params.data

    const result = await getProductMemoryGateway().listMemories({
      ...caller.scope,
      limit,
      offset,
      category,
      tags,
    })

    const body: ListMemoriesResponse = {
      data: result.memories.map((m) => toPublicMemory(m)),
      pagination: Pagination.parse({
        limit,
        offset,
        total: result.total,
      }),
    }
    return jsonResponse(body)
  },
)

// ---------------------------------------------------------------------------
// POST /api/v1/developer/memory — create
// ---------------------------------------------------------------------------

export const POST = withDeveloperV1Contract(
  'write',
  async (context, caller) => {
    const parsed = await parseRequestJson(
      CreateMemoryRequest,
      context.request,
    )
    if (!parsed.ok) return parsed.response
    const input = parsed.data

    const record = await getProductMemoryGateway().createMemory({
      ...caller.scope,
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
  },
)
