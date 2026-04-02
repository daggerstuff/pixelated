import type {
  AddMemoryInput,
  MemoryEntry,
  MemoryStats,
  SearchOptions,
} from './memory-client'

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_ORIGIN || ''

export const mcpMemoryManager = {
  async addMemory(
    input: AddMemoryInput,
    userId?: string,
  ): Promise<string> {
    const resolvedUserId = requireUserId(userId)
    const response = await fetch(`${BASE_URL}/api/memory/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: input.content,
        user_id: resolvedUserId,
        metadata: input.metadata,
        category: input.metadata?.category,
      }),
    })
    if (!response.ok) {
      throw new Error(`Failed to add memory: ${response.statusText}`)
    }

    const data = await response.json()
    const memoryId = data.memory_id
    if (!memoryId) {
      throw new Error('Memory add response did not include memory_id')
    }
    return memoryId
  },

  async updateMemory(
    memoryId: string,
    content: string,
    userId?: string,
  ): Promise<void> {
    const resolvedUserId = requireUserId(userId)
    const response = await fetch(`${BASE_URL}/api/memory/${encodeURIComponent(memoryId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, user_id: resolvedUserId }),
    })

    if (!response.ok) {
      throw new Error(`Failed to update memory: ${response.statusText}`)
    }
  },

  async deleteMemory(
    memoryId: string,
    userId?: string,
  ): Promise<void> {
    const resolvedUserId = requireUserId(userId)
    const params = new URLSearchParams()
    params.set('userId', resolvedUserId)
    const response = await fetch(`${BASE_URL}/api/memory/${encodeURIComponent(memoryId)}?${params.toString()}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`Failed to delete memory: ${response.statusText}`)
    }
  },

  async getAllMemories(userId?: string): Promise<MemoryEntry[]> {
    const resolvedUserId = requireUserId(userId)
    return fetchMappedMemories(buildMemoryListQuery({ userId: resolvedUserId }))
  },

  async searchMemories(options: SearchOptions): Promise<MemoryEntry[]> {
    const { userId, query, limit = 10 } = options
    const resolvedUserId = requireUserId(userId)
    const response = await fetch(`${BASE_URL}/api/memory/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        user_id: resolvedUserId,
        limit,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to search memories: ${response.statusText}`)
    }

    const data = await response.json()
    return mapMemoryEntries(data.memories)
  },

  async getMemoryStats(userId?: string): Promise<MemoryStats> {
    const resolvedUserId = requireUserId(userId)
    const response = await fetch(
      `${BASE_URL}/api/memory/stats/${encodeURIComponent(resolvedUserId)}`,
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch memory stats: ${response.statusText}`)
    }

    const data = await response.json()

    return {
      totalMemories: data.totalMemories || 0,
      categoryCounts: data.categoryCounts || {},
      recentActivity: [],
    }
  },

  async searchByCategory(
    category: string,
    userId?: string,
  ): Promise<MemoryEntry[]> {
    const resolvedUserId = requireUserId(userId)
    return fetchMappedMemories(
      buildMemoryListQuery({ userId: resolvedUserId, category }),
    )
  },

  async searchByTags(
    tags: string[],
    userId?: string,
  ): Promise<MemoryEntry[]> {
    const resolvedUserId = requireUserId(userId)
    return fetchMappedMemories(
      buildMemoryListQuery({ userId: resolvedUserId, tags }),
    )
  },

  async getMemoryHistory(userId?: string): Promise<any[]> {
    requireUserId(userId)
    return []
  },

  // Legacy support methods (if needed by UI)
  async addUserPreference(
    userId: string | undefined,
    key: string,
    value: unknown,
  ): Promise<void> {
    await this.addMemory(
      {
        content: `User preference: ${key} = ${JSON.stringify(value)}`,
        metadata: { category: 'preference', tags: ['preference', key] },
      },
      userId,
    )
  },

  async addConversationContext(
    userId: string | undefined,
    context: string,
    sessionId?: string,
  ): Promise<void> {
    await this.addMemory(
      {
        content: context,
        metadata: {
          category: 'conversation',
          tags: ['conversation'],
          sessionId,
        },
      },
      userId,
    )
  },

  async addProjectInfo(
    userId: string | undefined,
    projectInfo: string,
    projectId?: string,
  ): Promise<void> {
    await this.addMemory(
      {
        content: projectInfo,
        metadata: { category: 'project', tags: ['project'], projectId },
      },
      userId,
    )
  },
}

function requireUserId(userId?: string): string {
  if (!userId) {
    throw new Error('Memory operations require an authenticated user id')
  }
  return userId
}

function buildMemoryListQuery({
  userId,
  category,
  tags,
  limit = 100,
}: {
  userId: string
  category?: string
  tags?: string[]
  limit?: number
}): URLSearchParams {
  const params = new URLSearchParams()
  params.set('limit', String(limit))
  params.set('userId', userId)
  if (category) {
    params.set('category', category)
  }
  for (const tag of tags ?? []) {
    params.append('tag', tag)
  }
  return params
}

async function fetchMappedMemories(params: URLSearchParams): Promise<MemoryEntry[]> {
  const response = await fetch(`${BASE_URL}/api/memory/list?${params.toString()}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch memories: ${response.statusText}`)
  }
  const data = await response.json()
  return mapMemoryEntries(data.memories)
}

function mapMemoryEntries(memories: unknown): MemoryEntry[] {
  if (!Array.isArray(memories)) {
    return []
  }

  return memories.map((memory: any) => ({
    id: memory.id || 'unknown',
    content: memory.memory || memory.content || '',
    metadata: memory.metadata || {},
  }))
}
