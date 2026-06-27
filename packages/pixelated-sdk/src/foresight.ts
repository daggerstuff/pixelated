/**
 * @pixelated-empathy/sdk — ForesightClient
 *
 * First-class TypeScript SDK for Foresight memory operations with
 * full Zod runtime validation.
 *
 * Usage:
 *   const foresight = new ForesightClient({ baseUrl: '/api/v1/memory' })
 *   const memory = await foresight.storeMemory({ content: '...' })
 */

import type { UnifiedMemory } from '@pixelated/memory-schema'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Reusable field schemas
// ---------------------------------------------------------------------------

const Importance = z.number().min(0).max(1)
const Category = z.string().min(1).max(64)
const Tag = z.string().min(1).max(64)

export const MemoryScope = z.enum(['session', 'arc', 'fact', 'trait'])
export type MemoryScope = z.infer<typeof MemoryScope>

export const RetentionPolicy = z.enum([
  'ephemeral',
  'short_term',
  'long_term',
  'permanent',
])
export type RetentionPolicy = z.infer<typeof RetentionPolicy>

// ---------------------------------------------------------------------------
// Core resource — validated memory record (consumer-facing subset of
// UnifiedMemory).
// ---------------------------------------------------------------------------

export const ForesightMemory = z.object({
  id: z.string(),
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
      primaryEmotion: z.string().optional(),
      intensity: z.number().min(0).max(1).optional(),
    })
    .optional(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
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
        primaryEmotion: z.string().optional(),
        intensity: z.number().min(0).max(1).optional(),
      })
      .optional(),
  })
  .strict()
export type StoreMemoryInput = z.infer<typeof StoreMemoryInput>

export const StoreMemoryOutput = z
  .object({
    id: z.string(),
    content: z.string(),
    category: z.string(),
    tags: z.array(z.string()).optional().default([]),
    scope: MemoryScope,
    retention: RetentionPolicy,
    importance: Importance,
    createdAt: z.string(),
  })
  .strict()
export type StoreMemoryOutput = z.infer<typeof StoreMemoryOutput>

// ---------------------------------------------------------------------------
// GetMemory
// ---------------------------------------------------------------------------

export const GetMemoryInput = z
  .object({
    memoryId: z.string().min(1),
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
  })
  .strict()
export type QueryMemoriesInput = z.infer<typeof QueryMemoriesInput>

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
    memoryId: z.string().min(1),
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
    memoryId: z.string().min(1),
  })
  .strict()
export type DeleteMemoryInput = z.infer<typeof DeleteMemoryInput>

export const DeleteMemoryOutput = z
  .object({
    id: z.string(),
  })
  .strict()
export type DeleteMemoryOutput = z.infer<typeof DeleteMemoryOutput>

// ---------------------------------------------------------------------------
// ForesightClient
// ---------------------------------------------------------------------------

export interface ForesightClientConfig {
  baseUrl?: string
  fetchFn?: typeof fetch
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>
  timeout?: number
  maxRetries?: number
  retryDelay?: number
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
 * @example
 * ```ts
 * const foresight = new ForesightClient({
 *   baseUrl: '/api/v1/memory',
 *   getHeaders: () => ({ Authorization: `Bearer ${token}` }),
 * })
 * const memory = await foresight.storeMemory({ content: '...' })
 * ```
 */
export class ForesightClient {
  readonly baseUrl: string
  private readonly fetchFn: typeof fetch
  private readonly getHeaders?: ForesightClientConfig['getHeaders']
  private readonly timeout: number
  private readonly maxRetries: number
  private readonly retryDelay: number

  constructor(config: ForesightClientConfig = {}) {
    this.baseUrl = config.baseUrl ?? '/api/v1/memory'
    this.fetchFn = config.fetchFn ?? fetch
    this.getHeaders = config.getHeaders
    this.timeout = config.timeout ?? 30000
    this.maxRetries = config.maxRetries ?? 3
    this.retryDelay = config.retryDelay ?? 1000
  }

  private async request(
    path: string,
    init: RequestInit = {},
    attempt = 0,
  ): Promise<Response> {
    const extraHeaders = (await this.getHeaders?.()) ?? {}
    const mergedHeaders = new Headers(init.headers)
    mergedHeaders.set('Content-Type', 'application/json')
    for (const [key, val] of Object.entries(extraHeaders)) {
      mergedHeaders.set(key, val)
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await this.fetchFn(`${this.baseUrl}${path}`, {
        ...init,
        headers: mergedHeaders,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // Retry on rate limit or server errors
      if (
        (response.status === 429 || response.status >= 500) &&
        attempt < this.maxRetries
      ) {
        const delay =
          this.retryDelay * Math.pow(2, attempt) + Math.random() * 100
        await new Promise((resolve) => setTimeout(resolve, delay))
        return this.request(path, init, attempt + 1)
      }

      return response
    } catch (error) {
      clearTimeout(timeoutId)
      // Retry on network errors
      if (error instanceof TypeError && attempt < this.maxRetries) {
        const delay =
          this.retryDelay * Math.pow(2, attempt) + Math.random() * 100
        await new Promise((resolve) => setTimeout(resolve, delay))
        return this.request(path, init, attempt + 1)
      }
      throw error
    }
  }

  // -----------------------------------------------------------------------
  // Memory operations
  // -----------------------------------------------------------------------

  /**
   * Store a new memory.
   *
   * POST /api/v1/memory
   */
  async storeMemory(
    input: z.infer<typeof StoreMemoryInput>,
  ): Promise<z.infer<typeof StoreMemoryOutput>> {
    const validated = StoreMemoryInput.parse(input)
    const res = await this.request('', {
      method: 'POST',
      body: JSON.stringify(validated),
    })
    return handleResponse(res) as Promise<z.infer<typeof StoreMemoryOutput>>
  }

  /**
   * Retrieve a single memory by ID.
   *
   * GET /api/v1/memory/:memoryId
   */
  async getMemory(
    input: z.infer<typeof GetMemoryInput>,
  ): Promise<z.infer<typeof ForesightMemory>> {
    const { memoryId } = GetMemoryInput.parse(input)
    const res = await this.request(`/${encodeURIComponent(memoryId)}`)
    return handleResponse<{ data: z.infer<typeof ForesightMemory> }>(res).then(
      (r) => r.data,
    )
  }

  /**
   * Query memories using keyword + semantic (hybrid) retrieval.
   *
   * GET /api/v1/memory/search?q=...
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
   * List memories with optional filtering.
   *
   * GET /api/v1/memory?limit=...&offset=...
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
   * PATCH /api/v1/memory/:memoryId
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
    return handleResponse<{ data: z.infer<typeof ForesightMemory> }>(res).then(
      (r) => r.data,
    )
  }

  /**
   * Delete a memory record.
   *
   * DELETE /api/v1/memory/:memoryId
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
}

// Re-export UnifiedMemory for consumer convenience
export type { UnifiedMemory }
