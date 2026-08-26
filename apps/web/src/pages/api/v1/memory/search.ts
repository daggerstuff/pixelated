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
import { withV1Contract } from '@/lib/middleware/with-v1-contract'
/**
 * @file src/pages/api/v1/memory/search.ts
 *
 * v1 public memory API — search.
 *
 *   GET  /api/v1/memory/search?q=<query>&limit=&offset=
 *   POST /api/v1/memory/search  body: { q, limit?, offset? }
 */
import { getProductMemoryGateway } from '@/lib/services/product-memory-gateway'

// ---------------------------------------------------------------------------
// GET /api/v1/memory/search
// ---------------------------------------------------------------------------

export const GET = withV1Contract('searchMemories', async (context, caller) => {
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
// POST /api/v1/memory/search
// ---------------------------------------------------------------------------

export const POST = withV1Contract(
  'searchMemories',
  async (context, caller) => {
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
  },
)
