/**
 * src/lib/memory/__tests__/in-process-memory-service.ts
 *
 * Test/dev-only in-process memory backend.
 *
 * This module is the legacy `MemoryService` implementation that lived in
 * `src/lib/memory.ts`. It is preserved here for:
 *   - unit tests and integration test harnesses that need a local memory store
 *   - local dev / Storybook scenarios where the shared memory service is
 *     not available
 *
 * It is NOT a production memory backend. Production memory flows go through
 * `getProductMemoryGateway()` in `src/lib/services/product-memory-gateway.ts`,
 * which wraps the shared internal memory service.
 *
 * See `src/lib/services/product-memory-gateway.ts` (PIX-228) and
 * `src/pages/api/memory/_shared.ts` (PIX-328) for the production path.
 *
 * Migration: if you need an in-process memory store in tests, import from
 * this file directly. Do NOT add new production callers.
 */

export interface InProcessMemory {
  id: string
  userId: string
  content: string
  createdAt: Date
  updatedAt: Date
  isLatest: boolean
  validFrom: Date
  validUntil?: Date
  tags?: string[]
  metadata?: Record<string, unknown>
}

export interface InProcessListMemoriesOptions {
  limit?: number
  offset?: number
  sortBy?: keyof InProcessMemory
  sortOrder?: 'asc' | 'desc'
  tags?: string[]
  search?: string
  includeHistory?: boolean
}

export interface InProcessCreateMemoryOptions {
  userId: string
  tags?: string[]
  metadata?: Record<string, unknown>
}

export interface InProcessUpdateMemoryOptions {
  content?: string
  tags?: string[]
  metadata?: Record<string, unknown>
}

/**
 * In-process, non-durable memory store for tests and local dev.
 *
 * Use `getProductMemoryGateway()` for production code paths.
 */
export class InProcessMemoryService {
  private memories: InProcessMemory[] = []

  async createMemory(
    content: string,
    options: InProcessCreateMemoryOptions,
  ): Promise<InProcessMemory> {
    const now = new Date()
    const memory: InProcessMemory = {
      id: crypto.randomUUID(),
      userId: options.userId,
      content,
      createdAt: now,
      updatedAt: now,
      isLatest: true,
      validFrom: now,
      tags: options.tags ?? [],
      metadata: options.metadata ?? {},
    }
    this.memories.push(memory)
    return memory
  }

  async updateMemory(
    id: string,
    userId: string,
    options: InProcessUpdateMemoryOptions,
  ): Promise<InProcessMemory | null> {
    const memoryIndex = this.memories.findIndex(
      (m) => m.id === id && m.userId === userId && m.isLatest,
    )
    if (memoryIndex === -1) return null

    const memory = this.memories[memoryIndex]
    const updateTime = new Date()

    // Archive the current latest version
    this.memories[memoryIndex] = {
      ...memory,
      isLatest: false,
      validUntil: updateTime,
      updatedAt: updateTime,
    }

    // Insert new version as latest
    const updatedMemory: InProcessMemory = {
      ...memory,
      content: options.content ?? memory.content,
      tags: options.tags ?? memory.tags,
      metadata: { ...memory.metadata, ...options.metadata },
      updatedAt: updateTime,
      isLatest: true,
      validFrom: updateTime,
      validUntil: undefined,
    }
    this.memories.push(updatedMemory)
    return updatedMemory
  }

  async deleteMemory(id: string, userId: string): Promise<boolean> {
    const initialLength = this.memories.length
    this.memories = this.memories.filter(
      (m) => !(m.id === id && m.userId === userId),
    )
    return this.memories.length < initialLength
  }

  async getMemory(id: string, userId: string): Promise<InProcessMemory | null> {
    return (
      this.memories.find(
        (m) => m.id === id && m.userId === userId && m.isLatest,
      ) ?? null
    )
  }

  async listMemories(
    userId: string,
    options: InProcessListMemoriesOptions = {},
  ): Promise<InProcessMemory[]> {
    let filtered = this.memories.filter(
      (m) => m.userId === userId && (options.includeHistory ?? m.isLatest),
    )

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
    options: Omit<InProcessListMemoriesOptions, 'search'> = {},
  ): Promise<InProcessMemory[]> {
    return this.listMemories(userId, { ...options, search: query })
  }

  async getMemoryCount(userId: string): Promise<number> {
    return this.memories.filter((m) => m.userId === userId && m.isLatest).length
  }
}

/**
 * Back-compat alias for the original class name. New code should use
 * `InProcessMemoryService` to make the test-only nature obvious at the
 * call site.
 *
 * @deprecated Import `InProcessMemoryService` instead.
 */
export const MemoryService = InProcessMemoryService
