import type { AuthRequestConfig } from '../auth/auth0-protected-fetch'
import { fetchWithAuthToken } from '../auth/auth0-protected-fetch'
import type {
  AddMemoryInput,
  MemoryEntry,
  MemoryMetadata,
  MemoryStats,
  SearchOptions,
} from './memory-client'

type MemoryAuthConfig = Omit<AuthRequestConfig, 'getAccessTokenSilently'> & {
  getAccessTokenSilently?: AuthRequestConfig['getAccessTokenSilently']
}

/**
 * ProductMemoryClient targets the app-owned /api/memory/* gateway routes
 * using relative paths to ensure it works across different environments.
 * It provides a standardized interface for memory operations in the frontend.
 */
export class ProductMemoryClient {
  private readonly defaultAuthConfig?: MemoryAuthConfig

  constructor(defaultAuthConfig?: MemoryAuthConfig) {
    this.defaultAuthConfig = defaultAuthConfig
  }

  private async request(
    input: RequestInfo | URL,
    init: RequestInit = {},
    authConfig?: MemoryAuthConfig,
  ): Promise<Response> {
    const activeConfig = authConfig ?? this.defaultAuthConfig
    return activeConfig?.getAccessTokenSilently
      ? fetchWithAuthToken(input, init, {
          getAccessTokenSilently: activeConfig.getAccessTokenSilently,
          ...(activeConfig.audience ? { audience: activeConfig.audience } : {}),
          ...(activeConfig.scope ? { scope: activeConfig.scope } : {}),
        })
      : fetch(input, init)
  }

  async addMemory(input: AddMemoryInput, userId?: string): Promise<string> {
    const resolvedUserId = requireUserId(userId)
    const response = await this.request('/api/memory/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: input.content,
        userId: resolvedUserId,
        metadata: input.metadata,
      }),
    })

    if (!response.ok) {
      const rawError = (await response.json().catch(() => ({}))) as unknown
      const error = isRecord(rawError) ? rawError : {}
      const errorMessage = typeof error['message'] === 'string' ? error['message'] : undefined
      throw new Error(
        errorMessage ?? `Failed to add memory: ${response.statusText}`,
      )
    }

    const rawData = (await response.json()) as unknown
    const data = isRecord(rawData) ? rawData : {}
    // Support both legacy memory_id and new id format
    const memoryId = typeof data['id'] === 'string' ? data['id'] : (typeof data['memory_id'] === 'string' ? data['memory_id'] : undefined)
    if (!memoryId) {
      throw new Error('Memory add response did not include an ID')
    }
    return memoryId
  }

  async listMemories(
    userId?: string,
    options: {
      limit?: number
      offset?: number
      category?: string
      tags?: string[]
    } = {},
  ): Promise<MemoryEntry[]> {
    const resolvedUserId = requireUserId(userId)
    const params = new URLSearchParams()
    params.set('userId', resolvedUserId)
    if (options.limit) params.set('limit', String(options.limit))
    if (options.offset) params.set('offset', String(options.offset))
    if (options.category) params.set('category', options.category)
    if (options.tags) {
      options.tags.forEach((tag) => params.append('tag', tag))
    }

    const response = await this.request(`/api/memory/list?${params.toString()}`)
    if (!response.ok) {
      throw new Error(`Failed to list memories: ${response.statusText}`)
    }

    const rawData = (await response.json()) as unknown
    const data = isRecord(rawData) ? rawData : {}
    return mapMemoryEntries(data['memories'])
  }

  async searchMemories(options: SearchOptions): Promise<MemoryEntry[]> {
    const resolvedUserId = requireUserId(options.userId)
    const response = await this.request('/api/memory/search', {
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

    const rawData = (await response.json()) as unknown
    const data = isRecord(rawData) ? rawData : {}
    return mapMemoryEntries(data['memories'])
  }

  async updateMemory(
    memoryId: string,
    content: string,
    userId?: string,
  ): Promise<void> {
    const resolvedUserId = requireUserId(userId)
    const response = await this.request('/api/memory/update', {
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
    const response = await this.request('/api/memory/delete', {
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
    const response = await this.request(
      `/api/memory/stats?userId=${encodeURIComponent(resolvedUserId)}`,
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch memory stats: ${response.statusText}`)
    }

    const rawData = (await response.json()) as unknown
    const data = isRecord(rawData) ? rawData : {}
    const totalMemories = typeof data['totalMemories'] === 'number' ? data['totalMemories'] : 0
    
    let categoryCounts: Record<string, number> = {}
    if (isRecord(data['categoryCounts'])) {
      categoryCounts = {}
      for (const [key, value] of Object.entries(data['categoryCounts'])) {
        if (typeof value === 'number') {
          categoryCounts[key] = value
        }
      }
    }

    let recentActivity: MemoryStats['recentActivity'] = []
    if (Array.isArray(data['recentActivity'])) {
      recentActivity = data['recentActivity'].map((item: unknown) => {
        const act = isRecord(item) ? item : {}
        return {
          id: typeof act['id'] === 'string' ? act['id'] : 'unknown',
          timestamp: typeof act['timestamp'] === 'string' ? act['timestamp'] : new Date().toISOString(),
          operation: typeof act['operation'] === 'string' ? act['operation'] : 'unknown',
          memoryId: typeof act['memoryId'] === 'string' ? act['memoryId'] : undefined,
        }
      })
    }

    return {
      totalMemories,
      categoryCounts,
      recentActivity,
    }
  }

  // Compatibility methods
  async getAllMemories(userId?: string): Promise<MemoryEntry[]> {
    return this.listMemories(userId)
  }

  async getMemoryStats(userId?: string): Promise<MemoryStats> {
    return this.getStats(userId)
  }

  async searchByCategory(
    category: string,
    userId?: string,
  ): Promise<MemoryEntry[]> {
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

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null
}

function isMetadata(val: unknown): val is MemoryMetadata {
  return typeof val === 'object' && val !== null
}

function mapMemoryEntries(memories: unknown): MemoryEntry[] {
  if (!Array.isArray(memories)) {
    return []
  }

  return memories.map((item: unknown) => {
    const memory = isRecord(item) ? item : {}
    return {
      id: typeof memory['id'] === 'string' ? memory['id'] : 'unknown',
      content: typeof memory['content'] === 'string' ? memory['content'] : (typeof memory['memory'] === 'string' ? memory['memory'] : ''),
      metadata: isMetadata(memory['metadata']) ? memory['metadata'] : {},
      createdAt: typeof memory['createdAt'] === 'string' ? memory['createdAt'] : (typeof memory['created_at'] === 'string' ? memory['created_at'] : undefined),
      updatedAt: typeof memory['updatedAt'] === 'string' ? memory['updatedAt'] : (typeof memory['updated_at'] === 'string' ? memory['updated_at'] : undefined),
    }
  })
}
