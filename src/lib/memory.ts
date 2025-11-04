// src/lib/memory.ts
// Enhanced MemoryService with proper type safety and method signatures

export interface Memory {
  id: string
  userId: string
  content: string
  createdAt: Date
  updatedAt: Date
  tags?: string[]
  metadata?: Record<string, unknown>
}

export interface ListMemoriesOptions {
  limit?: number
  offset?: number
  sortBy?: keyof Memory
  sortOrder?: 'asc' | 'desc'
  tags?: string[]
  search?: string
}

export interface CreateMemoryOptions {
  userId: string
  tags?: string[]
  metadata?: Record<string, unknown>
}

export interface UpdateMemoryOptions {
  content?: string
  tags?: string[]
  metadata?: Record<string, unknown>
}

export class MemoryService {
  private memories: Memory[] = []

  async createMemory(
    content: string,
    options: CreateMemoryOptions,
  ): Promise<Memory> {
    const memory: Memory = {
      id: Math.random().toString(36).substr(2, 9),
      userId: options.userId,
      content,
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: options.tags || [],
      metadata: options.metadata || {},
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
    if (memoryIndex === -1) {
      return null
    }

    const memory = this.memories[memoryIndex]
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
    return this.memories.find((m) => m.id === id && m.userId === userId) || null
  }

  async listMemories(
    userId: string,
    options: ListMemoriesOptions = {},
  ): Promise<Memory[]> {
    let filtered = this.memories.filter((m) => m.userId === userId)

    // Apply tag filtering
    if (options.tags && options.tags.length > 0) {
      filtered = filtered.filter((m) =>
        options.tags!.some((tag) => m.tags?.includes(tag)),
      )
    }

    // Apply search filtering
    if (options.search) {
      const searchLower = options.search.toLowerCase()
      filtered = filtered.filter((m) =>
        m.content.toLowerCase().includes(searchLower),
      )
    }

    // Apply sorting
    if (options.sortBy) {
      filtered.sort((a, b) => {
        const aVal = a[options.sortBy!]
        const bVal = b[options.sortBy!]

        if (aVal < bVal) {
          return options.sortOrder === 'desc' ? 1 : -1
        }
        if (aVal > bVal) {
          return options.sortOrder === 'desc' ? -1 : 1
        }
        return 0
      })
    }

    // Apply pagination
    const offset = options.offset || 0
    const limit = options.limit || 10
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
