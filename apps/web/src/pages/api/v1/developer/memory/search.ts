import {
  jsonResponse,
  parseRequestJson,
  parseSearchParams,
  toPublicMemory,
} from '@/lib/memory/contract/route-helpers'
import {
  Pagination,
  SearchMemoriesQuery,
  SearchMemoriesResponse,
  SearchMemoryRequest,
} from '@/lib/memory/contract/v1'
import { withDeveloperV1Contract } from '@/lib/middleware/with-developer-v1-contract'
/**
 * @file src/pages/api/v1/developer/memory/search.ts
 *
 * Developer v1 public memory API — search.
 *
 *   GET  /api/v1/developer/memory/search?q=<query>&limit=&offset=
 *   POST /api/v1/developer/memory/search  body: { q, limit?, offset? }
 *
 * Requires a valid API key with read | memory:read scope.
 */
import { getProductMemoryGateway } from '@/lib/services/product-memory-gateway'

// ---------------------------------------------------------------------------
// GET /api/v1/developer/memory/search
// ---------------------------------------------------------------------------

export const GET = withDeveloperV1Contract('read', async (context, caller) => {
  const url = new URL(context.request.url)
  const params = parseSearchParams(SearchMemoriesQuery, url)
  if (!params.ok) return params.response
  const { q, limit = 10, offset = 0 } = params.data

  const result = await getProductMemoryGateway().searchMemories({
    ...caller.scope,
    query: q,
    limit,
    offset,
  })

  const body: SearchMemoriesResponse = {
    data: result.memories.map((m) => toPublicMemory(m)),
    query: q,
    pagination: Pagination.parse({ limit, offset, total: result.total }),
  }
  return jsonResponse(body)
})

// ---------------------------------------------------------------------------
// POST /api/v1/developer/memory/search
// ---------------------------------------------------------------------------

export const POST = withDeveloperV1Contract('read', async (context, caller) => {
  const parsed = await parseRequestJson(SearchMemoryRequest, context.request)
  if (!parsed.ok) return parsed.response
  const { q, limit = 10, offset = 0 } = parsed.data

  const result = await getProductMemoryGateway().searchMemories({
    ...caller.scope,
    query: q,
    limit,
    offset,
  })

  const body: SearchMemoriesResponse = {
    data: result.memories.map((m) => toPublicMemory(m)),
    query: q,
    pagination: Pagination.parse({ limit, offset, total: result.total }),
  }
  return jsonResponse(body)
})
