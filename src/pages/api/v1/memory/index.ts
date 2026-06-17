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
import { withV1Contract } from '@/lib/middleware/with-v1-contract'
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

// ---------------------------------------------------------------------------
// GET /api/v1/memory — list
// ---------------------------------------------------------------------------

export const GET = withV1Contract('listMemories', async (context, caller) => {
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
})

// ---------------------------------------------------------------------------
// POST /api/v1/memory — create
// ---------------------------------------------------------------------------

export const POST = withV1Contract('createMemory', async (context, caller) => {
  const parsed = await parseRequestJson(CreateMemoryRequest, context.request)
  if (!parsed.ok) return parsed.response
  const input = parsed.data

  // The public contract does not accept identity fields; we attach the
  // canonical session-derived scope here. Any caller-supplied identity
  // fields would already have been rejected by the strict Zod schema.
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
})
