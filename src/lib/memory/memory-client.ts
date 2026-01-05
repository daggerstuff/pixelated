// Minimal in-memory implementation of the memory client for local usage
// Provides types and a basic store to satisfy hooks and UI during development

export type MemoryMetadata = {
  category?: string
  tags?: string[]
  timestamp?: string
  role?: 'user' | 'assistant' | string
  userId?: string
  sessionId?: string
  [key: string]: unknown
}

export interface MemoryEntry {
  id: string
  content: string
  metadata?: MemoryMetadata
}

export interface SearchOptions {
  query: string
  userId?: string
  category?: string
  tags?: string[]
  limit?: number
}

export interface MemoryStats {
  totalMemories: number
  categoryCounts: Record<string, number>
  recentActivity: Array<{ id: string; timestamp: string; operation: string }>
}

export interface AddMemoryInput {
  content: string
  metadata?: MemoryMetadata
}

type Store = Map<string, MemoryEntry[]> // key: userId

const store: Store = new Map()
const history: Map<string, Array<{ id: string; timestamp: string; operation: string; memoryId: string }>> = new Map()

function nowISO() {
  return new Date().toISOString()
}

function ensureUser(userId: string): void {
  if (!store.has(userId)) {
    store.set(userId, [])
  }
  if (!history.has(userId)) {
    history.set(userId, [])
  }
}

function addHistory(userId: string, operation: string, memoryId: string): void {
  ensureUser(userId)
  history.get(userId)!.push({ id: `${Date.now()}-${Math.random()}`, timestamp: nowISO(), operation, memoryId })
}

export const memoryManager = {
  async addMemory(input: AddMemoryInput, userId = 'default'): Promise<string> {
    ensureUser(userId)
    const id = cryptoRandomId()
    const entry: MemoryEntry = {
      id,
      content: input.content,
      metadata: {
        timestamp: nowISO(),
        userId,
        category: 'general',
        ...input.metadata,
      },
    }
    store.get(userId)!.unshift(entry)
    addHistory(userId, 'add', id)
    return id
  },

  async updateMemory(memoryId: string, content: string, userId = 'default'): Promise<void> {
    ensureUser(userId)
    const list = store.get(userId)!
    const idx = list.findIndex((m) => m.id === memoryId)
    if (idx >= 0 && list[idx]) {
      const existingMemory = list[idx]
      list[idx] = {
        id: existingMemory.id,
        content,
        metadata: { ...existingMemory.metadata, timestamp: nowISO() },
      }
      addHistory(userId, 'update', memoryId)
    }
  },

  async deleteMemory(memoryId: string, userId = 'default'): Promise<void> {
    ensureUser(userId)
    const list = store.get(userId)!
    const idx = list.findIndex((m) => m.id === memoryId)
    if (idx >= 0) {
      list.splice(idx, 1)
      addHistory(userId, 'delete', memoryId)
    }
  },

  async getAllMemories(userId = 'default'): Promise<MemoryEntry[]> {
    ensureUser(userId)
    return [...store.get(userId)!]
  },

  async searchMemories(options: SearchOptions): Promise<MemoryEntry[]> {
    const { userId = 'default', query, category, tags = [], limit = 10 } = options
    ensureUser(userId)
    const q = query.toLowerCase()
    let results = store
      .get(userId)!
      .filter((m) => m.content.toLowerCase().includes(q))

    if (category) {
      results = results.filter((m) => (m.metadata?.category || 'general') === category)
    }

    if (tags.length) {
      results = results.filter((m) => tags.every((t) => m.metadata?.tags?.includes(t)))
    }

    return results.slice(0, limit)
  },

  async searchByCategory(category: string, userId = 'default'): Promise<MemoryEntry[]> {
    ensureUser(userId)
    return store.get(userId)!.filter((m) => (m.metadata?.category || 'general') === category)
  },

  async searchByTags(tags: string[], userId = 'default'): Promise<MemoryEntry[]> {
    ensureUser(userId)
    return store
      .get(userId)!
      .filter((m) => tags.every((t) => m.metadata?.tags?.includes(t)))
  },

  async getMemoryStats(userId = 'default'): Promise<MemoryStats> {
    ensureUser(userId)
    const list = store.get(userId)!
    const categoryCounts: Record<string, number> = {}
    for (const m of list) {
      const cat = m.metadata?.category || 'general'
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
    }
    return {
      totalMemories: list.length,
      categoryCounts,
      recentActivity: (history.get(userId) || []).slice(-10).reverse(),
    }
  },

  async addUserPreference(userId = 'default', key: string, value: unknown): Promise<void> {
    await this.addMemory(
      {
        content: `User preference: ${key} = ${JSON.stringify(value)}`,
        metadata: { category: 'preference', tags: ['preference', key] },
      },
      userId,
    )
  },

  async addConversationContext(userId = 'default', context: string, sessionId?: string): Promise<void> {
    await this.addMemory(
      {
        content: context,
        metadata: { category: 'conversation', tags: ['conversation'], sessionId },
      },
      userId,
    )
  },

  async addProjectInfo(userId = 'default', projectInfo: string, projectId?: string): Promise<void> {
    await this.addMemory(
      {
        content: projectInfo,
        metadata: { category: 'project', tags: ['project'], projectId },
      },
      userId,
    )
  },

  async getMemoryHistory(userId = 'default') {
    ensureUser(userId)
    return [...(history.get(userId) || [])]
  },
}

function cryptoRandomId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    try {
      return crypto.randomUUID()
    } catch {
      // Fallback if crypto.randomUUID is not available
    }
  }
  return Math.random().toString(36).slice(2)
}

export default memoryManager
