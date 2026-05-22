/**
 * src/lib/memory.ts — Pixelated Empathy Memory Layer
 *
 * Unified entry-point for all memory operations in the Astro frontend.
 * Types are shared with the Foresight MCP server via the unified schema.
 *
 * Sprint 1 — ADHD-319: Update Astro/Frontend Memory Integration
 * Epic: ADHD-3 Foresight Memory Architecture
 *
 * Architecture:
 *   - All types re-exported from @pixelated/memory-schema (source of truth)
 *   - ForesightMemoryClient delegates to the Foresight MCP REST bridge
 *   - MemoryService preserved as backward-compat wrapper (in-memory for tests)
 */

// Re-export the canonical types so all Astro code can import from one place
export type {
  UnifiedMemory,
  CreateMemoryInput,
  UpdateMemoryInput,
  MemoryQueryOptions,
  EmotionalContext,
  EmpathyMetrics,
  GateResult,
  MemoryScope,
  RetentionPolicy,
  StrengthTrend,
  GateDecision,
  SourceService,
} from '../../packages/memory-schema/src/index'

export { MEMORY_SCHEMA_VERSION } from '../../packages/memory-schema/src/index'

import type {
  UnifiedMemory,
  CreateMemoryInput,
  UpdateMemoryInput,
  MemoryQueryOptions,
} from '../../packages/memory-schema/src/index'

// ---------------------------------------------------------------------------
// Legacy interface — kept for backward compat with existing consumers
// Backed by UnifiedMemory fields under the hood.
// ---------------------------------------------------------------------------

/** @deprecated Use UnifiedMemory from @pixelated/memory-schema */
export interface Memory {
  id: string
  userId: string
  content: string
  createdAt: Date
  updatedAt: Date
  tags?: string[]
  metadata?: Record<string, unknown>
}

/** @deprecated Use MemoryQueryOptions */
export interface ListMemoriesOptions {
  limit?: number
  offset?: number
  sortBy?: keyof Memory
  sortOrder?: 'asc' | 'desc'
  tags?: string[]
  search?: string
}

/** @deprecated Use CreateMemoryInput */
export interface CreateMemoryOptions {
  userId: string
  tags?: string[]
  metadata?: Record<string, unknown>
}

/** @deprecated Use UpdateMemoryInput */
export interface UpdateMemoryOptions {
  content?: string
  tags?: string[]
  metadata?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// ForesightMemoryClient — production memory client backed by Foresight server
// ---------------------------------------------------------------------------

/**
 * Client for the Foresight memory server REST bridge.
 * Used by server-side Astro routes and API handlers.
 *
 * The Foresight server exposes MCP tools; this client wraps the HTTP bridge
 * at FORESIGHT_BRIDGE_URL (set in .env).
 */
export class ForesightMemoryClient {
  private readonly bridgeUrl: string
  private readonly userId: string
  private readonly tenantId: string

  constructor(options: {
    userId: string
    tenantId?: string
    bridgeUrl?: string
  }) {
    this.userId = options.userId
    this.tenantId = options.tenantId ?? 'default'
    this.bridgeUrl =
      options.bridgeUrl ??
      (typeof process !== 'undefined'
        ? (process.env['FORESIGHT_BRIDGE_URL'] ?? 'http://localhost:8765')
        : 'http://localhost:8765')
  }

  /** Store a new memory in the Foresight memory bank. */
  async store(input: CreateMemoryInput): Promise<UnifiedMemory> {
    const res = await fetch(`${this.bridgeUrl}/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...input,
        userId: this.userId,
        tenantId: this.tenantId,
      }),
    })
    if (!res.ok) {
      throw new Error(`Foresight store failed: ${res.status} ${res.statusText}`)
    }
    return (await res.json()) as UnifiedMemory
  }

  /** Retrieve a memory by ID. */
  async get(memoryId: string): Promise<UnifiedMemory | null> {
    const res = await fetch(
      `${this.bridgeUrl}/memory/${encodeURIComponent(memoryId)}?userId=${this.userId}&tenantId=${this.tenantId}`,
    )
    if (res.status === 404) return null
    if (!res.ok) {
      throw new Error(`Foresight get failed: ${res.status} ${res.statusText}`)
    }
    return (await res.json()) as UnifiedMemory
  }

  /** Search/list memories. */
  async list(
    options: MemoryQueryOptions = { userId: this.userId },
  ): Promise<UnifiedMemory[]> {
    const params = new URLSearchParams({
      userId: options.userId,
      tenantId: options.tenantId ?? this.tenantId,
      ...(options.limit !== undefined && { limit: String(options.limit) }),
      ...(options.offset !== undefined && { offset: String(options.offset) }),
      ...(options.search && { search: options.search }),
      ...(options.scope && { scope: options.scope }),
      ...(options.category && { category: options.category }),
    })
    const res = await fetch(`${this.bridgeUrl}/memories?${params}`)
    if (!res.ok) {
      throw new Error(`Foresight list failed: ${res.status} ${res.statusText}`)
    }
    return (await res.json()) as UnifiedMemory[]
  }

  /** Update a memory. */
  async update(
    memoryId: string,
    updates: UpdateMemoryInput,
  ): Promise<UnifiedMemory | null> {
    const res = await fetch(
      `${this.bridgeUrl}/memory/${encodeURIComponent(memoryId)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...updates,
          userId: this.userId,
          tenantId: this.tenantId,
        }),
      },
    )
    if (res.status === 404) return null
    if (!res.ok) {
      throw new Error(
        `Foresight update failed: ${res.status} ${res.statusText}`,
      )
    }
    return (await res.json()) as UnifiedMemory
  }

  /** Delete a memory. */
  async delete(memoryId: string): Promise<boolean> {
    const res = await fetch(
      `${this.bridgeUrl}/memory/${encodeURIComponent(memoryId)}?userId=${this.userId}&tenantId=${this.tenantId}`,
      { method: 'DELETE' },
    )
    return res.ok
  }
}

// ---------------------------------------------------------------------------
// MemoryService — backward-compat in-memory implementation
// Use ForesightMemoryClient for production. MemoryService is suitable for
// unit tests, Storybook, and local dev without Foresight running.
// ---------------------------------------------------------------------------

export class MemoryService {
  private memories: Memory[] = []

  async createMemory(
    content: string,
    options: CreateMemoryOptions,
  ): Promise<Memory> {
    const memory: Memory = {
      id: crypto.randomUUID(),
      userId: options.userId,
      content,
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: options.tags ?? [],
      metadata: options.metadata ?? {},
    }
    this.memories.push(memory)
    return memory
  }

  async updateMemory(
    id: string,
    userId: string,
    options: UpdateMemoryOptions,
  ): Promise<Memory | null> {
    const memoryIndex = this.memories.findIndex(
      (m) => m.id === id && m.userId === userId,
    )
    if (memoryIndex === -1) return null

    const memory = this.memories[memoryIndex]!
    this.memories[memoryIndex] = {
      ...memory,
      content: options.content ?? memory.content,
      tags: options.tags ?? memory.tags,
      metadata: { ...memory.metadata, ...options.metadata },
      updatedAt: new Date(),
    }
    return this.memories[memoryIndex]
  }

  async deleteMemory(id: string, userId: string): Promise<boolean> {
    const initialLength = this.memories.length
    this.memories = this.memories.filter(
      (m) => !(m.id === id && m.userId === userId),
    )
    return this.memories.length < initialLength
  }

  async getMemory(id: string, userId: string): Promise<Memory | null> {
    return this.memories.find((m) => m.id === id && m.userId === userId) ?? null
  }

  async listMemories(
    userId: string,
    options: ListMemoriesOptions = {},
  ): Promise<Memory[]> {
    let filtered = this.memories.filter((m) => m.userId === userId)

    if (options.tags && options.tags.length > 0) {
      filtered = filtered.filter((m) =>
        options.tags!.some((tag) => m.tags?.includes(tag)),
      )
    }

    if (options.search) {
      const searchLower = options.search.toLowerCase()
      filtered = filtered.filter((m) =>
        m.content.toLowerCase().includes(searchLower),
      )
    }

    if (options.sortBy) {
      filtered.sort((a, b) => {
        const aVal = a[options.sortBy!]
        const bVal = b[options.sortBy!]
        if (aVal !== undefined && bVal !== undefined && aVal < bVal) {
          return options.sortOrder === 'desc' ? 1 : -1
        }
        if (aVal !== undefined && bVal !== undefined && aVal > bVal) {
          return options.sortOrder === 'desc' ? -1 : 1
        }
        return 0
      })
    }

    const offset = options.offset ?? 0
    const limit = options.limit ?? 10
    return filtered.slice(offset, offset + limit)
  }

  async searchMemories(
    userId: string,
    query: string,
    options: Omit<ListMemoriesOptions, 'search'> = {},
  ): Promise<Memory[]> {
    return this.listMemories(userId, { ...options, search: query })
  }

  async getMemoryCount(userId: string): Promise<number> {
    return this.memories.filter((m) => m.userId === userId).length
  }
}
