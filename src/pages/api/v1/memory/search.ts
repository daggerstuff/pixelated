import {
  handleGatewayError,
  jsonResponse,
  parseRequestJson,
  parseSearchParams,
  requireAuthenticatedMemoryCaller,
  toPublicMemory,
} from '@/lib/memory/contract/route-helpers'
import {
  Pagination,
  SearchMemoriesQuery,
  SearchMemoriesResponse,
  SearchMemoryRequest,
} from '@/lib/memory/contract/v1'
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

export const GET = async (context: { request: Request }): Promise<Response> => {
  const auth = await requireAuthenticatedMemoryCaller(context.request)
  if (!auth.ok) return auth.response

  const url = new URL(context.request.url)
  const params = parseSearchParams(SearchMemoriesQuery, url)
  if (!params.ok) return params.response
  const { q, limit = 10, offset = 0 } = params.data

  try {
    const result = await getProductMemoryGateway().searchMemories({
      ...auth.caller.scope,
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
  } catch (err) {
    return handleGatewayError('searchMemories', err)
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/memory/search
// ---------------------------------------------------------------------------

export const POST = async (context: {
  request: Request
}): Promise<Response> => {
  const auth = await requireAuthenticatedMemoryCaller(context.request)
  if (!auth.ok) return auth.response

  const parsed = await parseRequestJson(SearchMemoryRequest, context.request)
  if (!parsed.ok) return parsed.response
  const { q, limit = 10, offset = 0 } = parsed.data

  try {
    const result = await getProductMemoryGateway().searchMemories({
      ...auth.caller.scope,
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
  } catch (err) {
    return handleGatewayError('searchMemories', err)
  }
}
