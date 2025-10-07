declare module '@/lib/memory/memory-client' {
  export type MemoryEntry = {
    id: string
    content: string
    metadata?: Record<string, any>
  }

  export type SearchOptions = {
    query?: string
    userId?: string
    category?: string
    limit?: number
    [key: string]: any
  }

  export type MemoryStats = {
    total: number
    byCategory?: Record<string, number>
    [key: string]: any
  }

  export const memoryManager: {
    getAllMemories: (userId: string) => Promise<MemoryEntry[]>
    searchByCategory: (category: string, userId?: string) => Promise<MemoryEntry[]>
    getMemoryStats: (userId: string) => Promise<MemoryStats>
    addMemory: (entry: { content: string; metadata?: Record<string, any> }, userId?: string) => Promise<string>
    searchMemories: (opts: SearchOptions) => Promise<MemoryEntry[]>
    updateMemory: (memoryId: string, content: string, userId?: string) => Promise<void>
    deleteMemory: (memoryId: string, userId?: string) => Promise<void>
    addUserPreference: (userId: string | undefined, preference: string, value: unknown) => Promise<void>
    addConversationContext: (userId: string | undefined, context: string, sessionId?: string) => Promise<void>
    addProjectInfo: (userId: string | undefined, projectInfo: string, projectId?: string) => Promise<void>
    searchByTags: (tags: string[], userId?: string) => Promise<MemoryEntry[]>
    getMemoryHistory: (userId?: string) => Promise<Array<{ id: string; timestamp: string; operation?: string; memoryId?: string }>>
  }

  export {}
}

// types module

// types module (standardized)
