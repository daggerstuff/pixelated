/**
 * @file mem0-platform-client.ts
 * @module lib/memory/mem0-platform-client
 * @description
 *   Backward-compatible browser memory client.
 *   Legacy imports keep working, but the implementation now routes through the
 *   local/shared MCP memory API instead of talking to Mem0 directly.
 */

import { mcpMemoryManager } from './mcp-memory-client'

export interface Mem0Memory {
  id: string
  memory: string
  user_id?: string
  agent_id?: string
  metadata?: Record<string, unknown>
  created_at?: string
  updated_at?: string
}

export interface AddMemoryOptions {
  userId: string
  sessionId?: string
  agentId?: string
  category?: string
  metadata?: Record<string, unknown>
}

export interface SearchMemoryOptions {
  userId: string
  limit?: number
}

export interface Mem0ClientConfig {
  /** Optional compatibility field; no longer used for proxy-backed requests. */
  apiKey?: string
  /** Base URL for the proxy API (defaults to the MCP memory server). */
  baseUrl?: string
  /** Optional custom fetch implementation */
  fetch?: typeof fetch
}

/**
 * Mem0 Platform API client for browser/frontend use.
 *
 * @example
 * ```ts
 * const client = new Mem0PlatformClient({
 *   apiKey: import.meta.env.PUBLIC_MEM0_API_KEY
 * })
 *
 * await client.addMemory("User prefers morning meetings", {
 *   userId: "user123",
 *   category: "preference"
 * })
 *
 * const memories = await client.searchMemories("meeting preferences", {
 *   userId: "user123"
 * })
 * ```
 */
export class Mem0PlatformClient {
  private readonly baseUrl: string

  constructor(config: Mem0ClientConfig) {
    this.baseUrl =
      config.baseUrl ||
      process.env.NEXT_PUBLIC_MEMORY_API_URL ||
      'http://localhost:5003'
  }

  /**
   * Add a memory to Mem0.
   *
   * @param content - The content to store as a memory
   * @param options - Options including userId, metadata, etc.
   * @returns The created memory ID
   */
  async addMemory(content: string, options: AddMemoryOptions): Promise<string> {
    return mcpMemoryManager.addMemory(content, options.userId, {
      sessionId: options.sessionId,
      category: options.category,
    })
  }

  /**
   * Search for relevant memories.
   *
   * @param query - The search query
   * @param options - Search options including userId and limit
   * @returns Array of matching memories
   */
  async searchMemories(
    query: string,
    options: SearchMemoryOptions,
  ): Promise<Mem0Memory[]> {
    const memories = await mcpMemoryManager.searchMemories(
      query,
      options.userId,
      options.limit || 10,
    )
    return memories.map((memory) => ({
      id: memory.id,
      memory: memory.content,
      metadata: memory.metadata,
    }))
  }

  /**
   * Get all memories for a user.
   *
   * @param userId - The user ID
   * @returns Array of all user memories
   */
  async getAllMemories(userId: string): Promise<Mem0Memory[]> {
    const memories = await mcpMemoryManager.getAllMemories(userId)
    return memories.map((memory) => ({
      id: memory.id,
      memory: memory.content,
      metadata: memory.metadata,
    }))
  }

  /**
   * Get a specific memory by ID.
   *
   * @param memoryId - The memory ID
   * @returns The memory object or null
   */
  async getMemory(memoryId: string): Promise<Mem0Memory | null> {
    const memories = await mcpMemoryManager.getAllMemories('default_user')
    const match = memories.find((memory) => memory.id === memoryId)
    return match
      ? { id: match.id, memory: match.content, metadata: match.metadata }
      : null
  }

  /**
   * Update an existing memory.
   *
   * @param memoryId - The memory ID to update
   * @param content - New content for the memory
   */
  async updateMemory(memoryId: string, content: string): Promise<void> {
    await mcpMemoryManager.updateMemory(memoryId, content)
  }

  /**
   * Delete a specific memory.
   *
   * @param memoryId - The memory ID to delete
   */
  async deleteMemory(memoryId: string): Promise<void> {
    await mcpMemoryManager.deleteMemory(memoryId)
  }

  /**
   * Delete all memories for a user.
   *
   * @param userId - The user ID
   */
  async deleteAllMemories(userId: string): Promise<void> {
    const memories = await mcpMemoryManager.getAllMemories(userId)
    await Promise.all(memories.map((memory) => this.deleteMemory(memory.id)))
  }
}

/**
 * Create a compatibility client backed by the MCP memory server.
 */
export function createMem0Client(): Mem0PlatformClient | null {
  return new Mem0PlatformClient({})
}

/**
 * MCP Server client for proxied Mem0 operations.
 *
 * Use this when connecting to the local MCP memory server instead of
 * directly to Mem0 Platform API.
 */
export class MCPMemoryClient {
  private readonly baseUrl: string
  private readonly fetchFn: typeof fetch

  constructor(baseUrl = 'http://localhost:5003') {
    this.baseUrl = baseUrl
    this.fetchFn = fetch.bind(globalThis)
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const headers = new Headers(options.headers)
    headers.set('Content-Type', 'application/json')
    const response = await this.fetchFn(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`MCP API error (${response.status}): ${errorText}`)
    }

    return response.json() as Promise<T>
  }

  async addMemory(
    content: string,
    userId: string,
    options?: { sessionId?: string; category?: string },
  ): Promise<string> {
    const response = await this.request<{
      success: boolean
      memory_id: string
    }>('/api/memory/add', {
      method: 'POST',
      body: JSON.stringify({
        content,
        user_id: userId,
        session_id: options?.sessionId,
        category: options?.category,
      }),
    })
    return response.memory_id
  }

  async searchMemories(
    query: string,
    userId: string,
    limit = 10,
  ): Promise<Mem0Memory[]> {
    const response = await this.request<{
      success: boolean
      memories: Mem0Memory[]
    }>('/api/memory/search', {
      method: 'POST',
      body: JSON.stringify({ query, user_id: userId, limit }),
    })
    return response.memories
  }

  async getAllMemories(userId: string): Promise<Mem0Memory[]> {
    const response = await this.request<{
      success: boolean
      memories: Mem0Memory[]
    }>(`/api/memory/all/${encodeURIComponent(userId)}`)
    return response.memories
  }

  async deleteMemory(memoryId: string): Promise<void> {
    await this.request(`/api/memory/${memoryId}`, { method: 'DELETE' })
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.request('/health')
      return true
    } catch {
      return false
    }
  }
}
