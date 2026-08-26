import type { PublicMemory } from '@/lib/memory/contract/v1'

import type { AuthRequestConfig } from '../auth/auth0-protected-fetch'
import { fetchWithAuthToken } from '../auth/auth0-protected-fetch'
import {
  DEFAULT_MEMORY_API_BASE_URL,
  MemoryApiClient,
} from './memory-api-client'
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
 * ProductMemoryClient targets the canonical /api/v1/memory/* routes.
 * Identity is derived from the authenticated session — userId is only
 * used locally to assert the caller is authenticated.
 */
export class ProductMemoryClient {
  private readonly api: MemoryApiClient

  constructor(defaultAuthConfig?: MemoryAuthConfig) {
    this.api = new MemoryApiClient({
      baseUrl: DEFAULT_MEMORY_API_BASE_URL,
      fetchFn: (input: RequestInfo | URL, init?: RequestInit) =>
        this.request(input, init, defaultAuthConfig),
    })
  }

  private async request(
    input: RequestInfo | URL,
    init: RequestInit = {},
    authConfig?: MemoryAuthConfig,
  ): Promise<Response> {
    const activeConfig = authConfig
    return activeConfig?.getAccessTokenSilently
      ? fetchWithAuthToken(input, init, {
          getAccessTokenSilently: activeConfig.getAccessTokenSilently,
          ...(activeConfig.audience ? { audience: activeConfig.audience } : {}),
          ...(activeConfig.scope ? { scope: activeConfig.scope } : {}),
        })
      : fetch(input, init)
  }

  async addMemory(input: AddMemoryInput, userId?: string): Promise<string> {
    requireUserId(userId)
    const response = await this.api.create({
      content: input.content,
      ...(input.metadata?.category
        ? { category: input.metadata.category }
        : {}),
      ...(input.metadata?.tags ? { tags: input.metadata.tags } : {}),
    })
    return response.data.id
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
    requireUserId(userId)
    const response = await this.api.list({
      limit: options.limit,
      offset: options.offset,
      category: options.category,
      tags: options.tags,
    })
    return response.data.map(toMemoryEntry)
  }

  async searchMemories(options: SearchOptions): Promise<MemoryEntry[]> {
    requireUserId(options.userId)
    const response = await this.api.search({
      q: options.query,
      limit: options.limit,
    })
    let results = response.data.map(toMemoryEntry)
    if (options.category) {
      results = results.filter(
        (entry) => (entry.metadata.category ?? 'general') === options.category,
      )
    }
    if (options.tags?.length) {
      results = results.filter((entry) =>
        options.tags!.every((tag) => entry.metadata.tags?.includes(tag)),
      )
    }
    return results
  }

  async updateMemory(
    memoryId: string,
    content: string,
    userId?: string,
  ): Promise<void> {
    requireUserId(userId)
    await this.api.update(memoryId, { content })
  }

  async deleteMemory(memoryId: string, userId?: string): Promise<void> {
    requireUserId(userId)
    await this.api.delete(memoryId)
  }

  async getStats(userId?: string): Promise<MemoryStats> {
    requireUserId(userId)
    const response = await this.api.list({
      limit: 100,
      offset: 0,
      tags: undefined,
    })
    const categoryCounts: Record<string, number> = {}
    for (const memory of response.data) {
      const cat = memory.category || 'general'
      categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1
    }
    return {
      totalMemories: response.pagination.total,
      categoryCounts,
      recentActivity: [],
    }
  }

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

function toMemoryEntry(memory: PublicMemory): MemoryEntry {
  // Map MemoryScope values to MemoryMetadata scope values
  const scopeMap: Record<
    string,
    'shared' | 'private' | 'user' | 'global' | undefined
  > = {
    session: 'private', // Session-scoped memories are private to the session
    arc: 'user', // Arc-scoped memories belong to the user
    trait: 'global', // Trait-scoped memories are globally accessible
    fact: 'global', // Fact-scoped memories are globally accessible
  }

  const metadata: MemoryMetadata = {
    category: memory.category,
    tags: memory.tags,
    scope: scopeMap[memory.scope],
  }
  return {
    id: memory.id,
    content: memory.content,
    metadata,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt ?? undefined,
  }
}
