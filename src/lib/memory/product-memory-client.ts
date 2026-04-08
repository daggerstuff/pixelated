import type {
  AddMemoryInput,
  MemoryEntry,
  MemoryStats,
  SearchOptions,
} from './memory-client'

/**
 * ProductMemoryClient targets the app-owned /api/memory/* gateway routes
 * using relative paths to ensure it works across different environments.
 * It provides a standardized interface for memory operations in the frontend.
 */
export class ProductMemoryClient {
  async addMemory(input: AddMemoryInput, userId?: string): Promise<string> {
    const resolvedUserId = requireUserId(userId)
    const response = await fetch('/api/memory/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: input.content,
        userId: resolvedUserId,
        metadata: input.metadata,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error((error instanceof Error ? error.message : "Unknown error") || `Failed to add memory: ${response.statusText}`)
    }

    const data = await response.json()
    // Support both legacy memory_id and new id format
    const memoryId = data.id || data.memory_id
    if (!memoryId) {
      throw new Error('Memory add response did not include an ID')
    }
    return memoryId
  }

  async listMemories(userId?: string, options: { limit?: number; offset?: number; category?: string; tags?: string[] } = {}): Promise<MemoryEntry[]> {
    const resolvedUserId = requireUserId(userId)
    const params = new URLSearchParams()
    params.set('userId', resolvedUserId)
    if (options.limit) params.set('limit', String(options.limit))
    if (options.offset) params.set('offset', String(options.offset))
    if (options.category) params.set('category', options.category)
    if (options.tags) {
      options.tags.forEach(tag => params.append('tag', tag))
    }

    const response = await fetch(`/api/memory/list?${params.toString()}`)
    if (!response.ok) {
      throw new Error(`Failed to list memories: ${response.statusText}`)
    }

    const data = await response.json()
    return mapMemoryEntries(data.memories)
  }

  async searchMemories(options: SearchOptions): Promise<MemoryEntry[]> {
    const resolvedUserId = requireUserId(options.userId)
    const response = await fetch('/api/memory/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: options.query,
        userId: resolvedUserId,
        category: options.category,
        tags: options.tags,
        limit: options.limit,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to search memories: ${response.statusText}`)
    }

    const data = await response.json()
    return mapMemoryEntries(data.memories)
  }

  async updateMemory(memoryId: string, content: string, userId?: string): Promise<void> {
    const resolvedUserId = requireUserId(userId)
    const response = await fetch('/api/memory/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memoryId,
        content,
        userId: resolvedUserId,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to update memory: ${response.statusText}`)
    }
  }

  async deleteMemory(memoryId: string, userId?: string): Promise<void> {
    const resolvedUserId = requireUserId(userId)
    const response = await fetch('/api/memory/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memoryId,
        userId: resolvedUserId,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to delete memory: ${response.statusText}`)
    }
  }

  async getStats(userId?: string): Promise<MemoryStats> {
    const resolvedUserId = requireUserId(userId)
    const response = await fetch(`/api/memory/stats?userId=${encodeURIComponent(resolvedUserId)}`)

    if (!response.ok) {
      throw new Error(`Failed to fetch memory stats: ${response.statusText}`)
    }

    const data = await response.json()
    return {
      totalMemories: data.totalMemories || 0,
      categoryCounts: data.categoryCounts || {},
      recentActivity: data.recentActivity || [],
    }
  }

  // Compatibility methods
  async getAllMemories(userId?: string): Promise<MemoryEntry[]> {
    return this.listMemories(userId)
  }

  async getMemoryStats(userId?: string): Promise<MemoryStats> {
    return this.getStats(userId)
  }

  async searchByCategory(category: string, userId?: string): Promise<MemoryEntry[]> {
    return this.listMemories(userId, { category })
  }

  async searchByTags(tags: string[], userId?: string): Promise<MemoryEntry[]> {
    return this.listMemories(userId, { tags })
  }
}

export const productMemoryClient = new ProductMemoryClient()

function requireUserId(userId?: string): string {
  if (!userId) {
    throw new Error('Memory operations require an authenticated user id')
  }
  return userId
}

function mapMemoryEntries(memories: any[]): MemoryEntry[] {
  if (!Array.isArray(memories)) {
    return []
  }

  return memories.map((memory: any) => ({
    id: memory.id || 'unknown',
    content: memory.content || memory.memory || '',
    metadata: memory.metadata || {},
    createdAt: memory.createdAt || memory.created_at,
    updatedAt: memory.updatedAt || memory.updated_at,
  }))
}
