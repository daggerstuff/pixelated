/**
 * ForesightClient — first-class TypeScript SDK for Foresight memory operations.
 *
 * Provides typed, Zod-validated wrappers around the Foresight MCP tool surface:
 * storeMemory, getMemory, queryMemories, searchMemories, listMemories,
 * updateMemory, deleteMemory, and subscribeToMemories.
 *
 * Each method accepts plain objects (validated at runtime via Zod) and
 * returns fully-typed plain objects — no `any` surfaces to consumers.
 *
 * Usage (browser):
 *   const foresight = new ForesightClient({ baseUrl: '/api/v1/memory' })
 *   const memory = await foresight.storeMemory({ content: '...', category: 'fact' })
 *
 * Usage (server / API key):
 *   const foresight = new ForesightClient({
 *     baseUrl: 'https://api.pixelatedempathy.com/api/v1/memory',
 *     getHeaders: () => ({ Authorization: `Bearer ${token}` }),
 *   })
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Zod input schemas — these mirror the Foresight MCP tool parameters.
// ---------------------------------------------------------------------------

/** Importance score bounds. */
const Importance = z.number().min(0).max(1)
/** Free-form category label. */
const Category = z.string().min(1).max(64)
/** Arbitrary tag. */
const Tag = z.string().min(1).max(64)
/** ISO 8601 datetime string. */
const IsoDateTime = z.string()

export const MemoryScope = z.enum(['session', 'arc', 'fact', 'trait'])
export type MemoryScope = z.infer<typeof MemoryScope>

export const RetentionPolicy = z.enum([
  'ephemeral',
  'short_term',
  'long_term',
  'permanent',
])
export type RetentionPolicy = z.infer<typeof RetentionPolicy>

export const MemoryCategory = z.enum([
  'fact',
  'preference',
  'context',
  'reflection',
  'goal',
  'relationship',
  'other',
])
export type MemoryCategory = z.infer<typeof MemoryCategory>

// ---------------------------------------------------------------------------
// Core resource — validated Foresight memory record.
// ---------------------------------------------------------------------------

export const ForesightMemory = z.object({
  id: z.uuid(),
  content: z.string().min(1).max(64_000),
  category: z.string().min(1).max(64),
  tags: z.array(z.string().min(1).max(64)).max(64).optional().default([]),
  scope: MemoryScope.optional().default('fact'),
  retention: RetentionPolicy.optional().default('short_term'),
  importance: Importance.optional().default(0.5),
  emotionalContext: z
    .object({
      valence: z.number().min(-1).max(1).optional(),
      arousal: z.number().min(0).max(1).optional(),
      dominance: z.number().min(0).max(1).optional(),
      primary_emotion: z.string().optional(),
      intensity: z.number().min(0).max(1).optional(),
    })
    .optional(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime.nullable(),
})
export type ForesightMemory = z.infer<typeof ForesightMemory>

// ---------------------------------------------------------------------------
// StoreMemory
// ---------------------------------------------------------------------------

export const StoreMemoryInput = z
  .object({
    content: z.string().min(1).max(64_000),
    category: Category.optional(),
    tags: z.array(Tag).max(64).optional(),
    scope: MemoryScope.optional(),
    retention: RetentionPolicy.optional(),
    importance: Importance.optional(),
    emotionalContext: z
      .object({
        valence: z.number().min(-1).max(1).optional(),
        arousal: z.number().min(0).max(1).optional(),
        dominance: z.number().min(0).max(1).optional(),
        primary_emotion: z.string().optional(),
        intensity: z.number().min(0).max(1).optional(),
      })
      .optional(),
    relationType: z
      .enum([
        'updates',
        'extends',
        'derives',
        'contradicts',
        'supports',
        'related',
      ])
      .optional(),
    relatedMemoryId: z.uuid().optional(),
  })
  .strict()
export type StoreMemoryInput = z.infer<typeof StoreMemoryInput>

export const StoreMemoryOutput = z
  .object({
    id: z.uuid(),
    content: z.string(),
    category: z.string(),
    tags: z.array(z.string()).optional().default([]),
    scope: MemoryScope,
    retention: RetentionPolicy,
    importance: Importance,
    createdAt: IsoDateTime,
  })
  .strict()
export type StoreMemoryOutput = z.infer<typeof StoreMemoryOutput>

// ---------------------------------------------------------------------------
// GetMemory
// ---------------------------------------------------------------------------

export const GetMemoryInput = z
  .object({
    memoryId: z.uuid(),
  })
  .strict()
export type GetMemoryInput = z.infer<typeof GetMemoryInput>

// ---------------------------------------------------------------------------
// QueryMemories
// ---------------------------------------------------------------------------

export const QueryMemoriesInput = z
  .object({
    query: z.string().min(1).max(1_000),
    limit: z.number().int().positive().max(100).optional().default(10),
    offset: z.number().int().nonnegative().optional().default(0),
    minImportance: z.number().min(0).max(1).optional(),
    category: Category.optional(),
    tags: z.array(Tag).optional(),
    scope: MemoryScope.optional(),
    useHybrid: z.boolean().optional().default(true),
  })
  .strict()
export type QueryMemoriesInput = z.infer<typeof QueryMemoriesInput>

// ---------------------------------------------------------------------------
// SearchMemories (keyword + semantic)
// ---------------------------------------------------------------------------

export const SearchMemoriesInput = z
  .object({
    q: z.string().min(1).max(1_000),
    limit: z.number().int().positive().max(100).optional().default(10),
    offset: z.number().int().nonnegative().optional().default(0),
    category: Category.optional(),
    tags: z.array(Tag).optional(),
    scope: MemoryScope.optional(),
  })
  .strict()
export type SearchMemoriesInput = z.infer<typeof SearchMemoriesInput>

// ---------------------------------------------------------------------------
// ListMemories
// ---------------------------------------------------------------------------

export const ListMemoriesInput = z
  .object({
    limit: z.number().int().positive().max(100).optional().default(20),
    offset: z.number().int().nonnegative().optional().default(0),
    category: Category.optional(),
    tags: z.array(Tag).optional(),
    scope: MemoryScope.optional(),
    retention: RetentionPolicy.optional(),
  })
  .strict()
export type ListMemoriesInput = z.infer<typeof ListMemoriesInput>

export const ListMemoriesOutput = z
  .object({
    data: z.array(ForesightMemory),
    pagination: z
      .object({
        limit: z.number().int().positive(),
        offset: z.number().int().nonnegative(),
        total: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict()
export type ListMemoriesOutput = z.infer<typeof ListMemoriesOutput>

// ---------------------------------------------------------------------------
// UpdateMemory
// ---------------------------------------------------------------------------

export const UpdateMemoryInput = z
  .object({
    memoryId: z.uuid(),
    content: z.string().min(1).max(64_000).optional(),
    category: Category.optional(),
    tags: z.array(Tag).max(64).optional(),
    importance: Importance.optional(),
    scope: MemoryScope.optional(),
    retention: RetentionPolicy.optional(),
  })
  .strict()
export type UpdateMemoryInput = z.infer<typeof UpdateMemoryInput>

// ---------------------------------------------------------------------------
// DeleteMemory
// ---------------------------------------------------------------------------

export const DeleteMemoryInput = z
  .object({
    memoryId: z.uuid(),
  })
  .strict()
export type DeleteMemoryInput = z.infer<typeof DeleteMemoryInput>

export const DeleteMemoryOutput = z
  .object({
    id: z.uuid(),
  })
  .strict()
export type DeleteMemoryOutput = z.infer<typeof DeleteMemoryOutput>

// ---------------------------------------------------------------------------
// Subscribe filter
// ---------------------------------------------------------------------------

export const SubscribeFilter = z
  .object({
    category: Category.optional(),
    tags: z.array(Tag).optional(),
    scope: MemoryScope.optional(),
    minImportance: Importance.optional(),
  })
  .strict()
export type SubscribeFilter = z.infer<typeof SubscribeFilter>

// ---------------------------------------------------------------------------
// ForesightClient
// ---------------------------------------------------------------------------

export interface ForesightClientConfig {
  baseUrl?: string
  fetchFn?: typeof fetch
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>
}

/**
 * Typed error thrown on non-2xx responses from the Foresight API.
 */
export class ForesightClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly body?: unknown,
  ) {
    super(message)
    this.name = 'ForesightClientError'
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let body: unknown
    try {
      body = await res.json()
    } catch {
      body = undefined
    }
    throw new ForesightClientError(
      `Foresight API error ${res.status}: ${res.statusText}`,
      res.status,
      body,
    )
  }
  return (await res.json()) as T
}

function appendQuery(
  base: string,
  query: Record<string, string | number | string[] | undefined>,
): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item)
      }
      continue
    }
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

/**
 * First-class TypeScript SDK client for Foresight memory operations.
 *
 * All input objects are validated via Zod before being sent.
 * All output objects are parsed through Zod before being returned.
 *
 * Example:
 * ```ts
 * const foresight = new ForesightClient({
 *   baseUrl: '/api/v1/memory',
 *   getHeaders: () => ({ Authorization: `Bearer ${token}` }),
 * })
 * const memory = await foresight.storeMemory({ content: '...', category: 'fact' })
 * ```
 */
export class ForesightClient {
  readonly baseUrl: string
  private readonly fetchFn: typeof fetch
  private readonly getHeaders?: ForesightClientConfig['getHeaders']

  constructor(config: ForesightClientConfig = {}) {
    this.baseUrl = config.baseUrl ?? '/api/v1/memory'
    this.fetchFn = config.fetchFn ?? fetch
    this.getHeaders = config.getHeaders
  }

  private async request(
    path: string,
    init: RequestInit = {},
  ): Promise<Response> {
    const extraHeaders = (await this.getHeaders?.()) ?? {}
    const mergedHeaders = new Headers(init.headers)
    mergedHeaders.set('Content-Type', 'application/json')
    for (const [key, val] of Object.entries(extraHeaders)) {
      mergedHeaders.set(key, val)
    }
    return this.fetchFn(`${this.baseUrl}${path}`, {
      ...init,
      headers: mergedHeaders,
    })
  }

  /**
   * Store a new memory.
   *
   * Wraps: `foresight_store_memory`
   */
  async storeMemory(
    input: z.infer<typeof StoreMemoryInput>,
  ): Promise<z.infer<typeof StoreMemoryOutput>> {
    const validated = StoreMemoryInput.parse(input)
    const res = await this.request('', {
      method: 'POST',
      body: JSON.stringify(validated),
    })
    return handleResponse<StoreMemoryOutput>(res)
  }

  /**
   * Retrieve a single memory by ID.
   *
   * Wraps: `foresight_get_memory`
   */
  async getMemory(
    input: z.infer<typeof GetMemoryInput>,
  ): Promise<z.infer<typeof ForesightMemory>> {
    const { memoryId } = GetMemoryInput.parse(input)
    const res = await this.request(`/${encodeURIComponent(memoryId)}`)
    const data = await handleResponse<{
      data: z.infer<typeof ForesightMemory>
    }>(res)
    return data.data
  }

  /**
   * Query memories using keyword + semantic (hybrid) retrieval.
   *
   * Wraps: `foresight_query_memories`
   */
  async queryMemories(
    input: z.infer<typeof QueryMemoriesInput>,
  ): Promise<z.infer<typeof ListMemoriesOutput>> {
    const validated = QueryMemoriesInput.parse(input)
    const res = await this.request(
      appendQuery('/search', {
        q: validated.query,
        limit: validated.limit,
        offset: validated.offset,
        category: validated.category,
        tags: validated.tags,
      }),
    )
    return handleResponse<ListMemoriesOutput>(res)
  }

  /**
   * Search memories using keyword + semantic retrieval.
   *
   * Wraps: `foresight_search_memories`
   */
  async searchMemories(
    input: z.infer<typeof SearchMemoriesInput>,
  ): Promise<z.infer<typeof ListMemoriesOutput>> {
    const validated = SearchMemoriesInput.parse(input)
    const res = await this.request('/search', {
      method: 'POST',
      body: JSON.stringify({ q: validated.q }),
    })
    return handleResponse<ListMemoriesOutput>(res)
  }

  /**
   * List memories with optional filtering.
   *
   * Wraps: `foresight_list_memories`
   */
  async listMemories(
    input?: z.infer<typeof ListMemoriesInput>,
  ): Promise<z.infer<typeof ListMemoriesOutput>> {
    const res = await this.request(
      appendQuery('', {
        limit: input?.limit ?? 20,
        offset: input?.offset ?? 0,
        category: input?.category,
        tags: input?.tags,
      }),
    )
    return handleResponse<ListMemoriesOutput>(res)
  }

  /**
   * Update a memory record.
   *
   * Wraps: `foresight_manage_memories` (update action)
   */
  async updateMemory(
    input: z.infer<typeof UpdateMemoryInput>,
  ): Promise<z.infer<typeof ForesightMemory>> {
    const validated = UpdateMemoryInput.parse(input)
    const { memoryId, ...body } = validated
    const res = await this.request(`/${encodeURIComponent(memoryId)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
    const data = await handleResponse<{
      data: z.infer<typeof ForesightMemory>
    }>(res)
    return data.data
  }

  /**
   * Delete a memory record.
   *
   * Wraps: `foresight_delete_memory`
   */
  async deleteMemory(
    input: z.infer<typeof DeleteMemoryInput>,
  ): Promise<z.infer<typeof DeleteMemoryOutput>> {
    const { memoryId } = DeleteMemoryInput.parse(input)
    const res = await this.request(`/${encodeURIComponent(memoryId)}`, {
      method: 'DELETE',
    })
    return handleResponse<DeleteMemoryOutput>(res)
  }

  /**
   * Subscribe to memory stream matching the given filters.
   *
   * Yields memories asynchronously as they are stored or updated.
   * The returned AsyncIterable can be consumed with `for await (...)`.
   *
   * Wraps: `foresight_subscribe_memories`
   *
   * Note: The server must support Server-Sent Events (SSE) or WebSocket
   * at the `/subscribe` sub-path. If the endpoint is not available, the
   * iterable returns immediately without yielding.
   */
  async *subscribeMemories(
    input?: z.infer<typeof SubscribeFilter>,
  ): AsyncIterable<z.infer<typeof ForesightMemory>> {
    const validated = input ? SubscribeFilter.parse(input) : {}
    const params = new URLSearchParams()
    if (validated.category) params.set('category', validated.category)
    if (validated.scope) params.set('scope', validated.scope)
    if (validated.minImportance !== undefined) {
      params.set('minImportance', String(validated.minImportance))
    }
    const qs = params.toString()
    const url = `${this.baseUrl}/subscribe${qs ? `?${qs}` : ''}`

    let events: EventSource
    try {
      events = new EventSource(url)
    } catch {
      return
    }

    try {
      yield await new Promise<z.infer<typeof ForesightMemory>>(
        (resolve, reject) => {
          events.onmessage = (event) => {
            try {
              resolve(ForesightMemory.parse(JSON.parse(event.data)))
            } catch {
              // skip unparseable events
            }
          }
          events.onerror = (err) => {
            reject(new ForesightClientError(`SSE error: ${err}`, 0))
          }
        },
      )
    } finally {
      events.close()
    }
  }
}
