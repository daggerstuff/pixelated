import {
  jsonError,
  jsonResponse,
  parseJson,
  parseRequestJson,
  toPublicMemory,
} from '@/lib/memory/contract/route-helpers'
import {
  DeleteMemoryResponse,
  GetMemoryResponse,
  MemoryIdParam,
  UpdateMemoryRequest,
  UpdateMemoryResponse,
} from '@/lib/memory/contract/v1'
import { withV1Contract } from '@/lib/middleware/with-v1-contract'
/**
 * @file src/pages/api/v1/memory/[memoryId].ts
 *
 * v1 public memory API — item endpoint.
 *
 *   GET    /api/v1/memory/:memoryId   — fetch one
 *   PATCH  /api/v1/memory/:memoryId   — update (partial)
 *   DELETE /api/v1/memory/:memoryId   — delete
 *
 * PUT is intentionally NOT supported: the public contract treats update as
 * a full-content replacement with optional metadata, exposed as PATCH for
 * REST-correct semantics.
 */
import { getProductMemoryGateway } from '@/lib/services/product-memory-gateway'

function resolveMemoryId(
  params: Record<string, string | undefined> | undefined,
): { ok: true; memoryId: string } | { ok: false; response: Response } {
  // Extract just the memoryId key — Astro may pass other keys in
  // `params`, and `MemoryIdParam` is strict to enforce the contract.
  const memoryId = params?.['memoryId']
  if (typeof memoryId !== 'string') {
    return {
      ok: false,
      response: jsonError({
        status: 400,
        code: 'bad_request',
        message: 'memoryId path parameter is required.',
      }),
    }
  }
  const parsed = parseJson(MemoryIdParam, { memoryId })
  if (!parsed.ok) return { ok: false, response: parsed.response }
  return { ok: true, memoryId: parsed.data.memoryId }
}

// ---------------------------------------------------------------------------
// GET /api/v1/memory/:memoryId
// ---------------------------------------------------------------------------

export const GET = withV1Contract('getMemory', async (context, caller) => {
  const id = resolveMemoryId(context.params)
  if (!id.ok) return id.response

  const record = await getProductMemoryGateway().getMemory({
    ...caller.scope,
    memoryId: id.memoryId,
  })
  if (!record) {
    return jsonError({
      status: 404,
      code: 'not_found',
      message: 'The requested memory was not found.',
    })
  }
  const body: GetMemoryResponse = {
    data: toPublicMemory(record),
  }
  return jsonResponse(body)
})

// ---------------------------------------------------------------------------
// PATCH /api/v1/memory/:memoryId
// ---------------------------------------------------------------------------

export const PATCH = withV1Contract('updateMemory', async (context, caller) => {
  const id = resolveMemoryId(context.params)
  if (!id.ok) return id.response

  const parsed = await parseRequestJson(UpdateMemoryRequest, context.request)
  if (!parsed.ok) return parsed.response
  const input = parsed.data

  const record = await getProductMemoryGateway().updateMemory({
    ...caller.scope,
    memoryId: id.memoryId,
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
  const body: UpdateMemoryResponse = {
    data: toPublicMemory(record),
  }
  return jsonResponse(body)
})

// ---------------------------------------------------------------------------
// DELETE /api/v1/memory/:memoryId
// ---------------------------------------------------------------------------

export const DELETE = withV1Contract(
  'deleteMemory',
  async (context, caller) => {
    const id = resolveMemoryId(context.params)
    if (!id.ok) return id.response

    await getProductMemoryGateway().deleteMemory({
      ...caller.scope,
      memoryId: id.memoryId,
    })
    const body: DeleteMemoryResponse = { data: { id: id.memoryId } }
    return jsonResponse(body)
  },
)
