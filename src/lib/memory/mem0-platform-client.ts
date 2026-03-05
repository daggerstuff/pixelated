/**
 * @file mem0-platform-client.ts
 * @module lib/memory/mem0-platform-client
 * @description
 *   Production Mem0 Platform API client for frontend integration.
 *   Provides a typed interface to the Mem0 Platform API with support for:
 *   - Memory CRUD operations
 *   - Semantic search
 *   - User and session context
 *   - Category and metadata management
 *
 * Based on: https://docs.mem0.ai/platform/overview
 */

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
    /** Mem0 Platform API key */
    apiKey: string
    /** Base URL for the API (defaults to Mem0 Platform) */
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
    private readonly apiKey: string
    private readonly baseUrl: string
    private readonly fetchFn: typeof fetch

    constructor(config: Mem0ClientConfig) {
        this.apiKey = config.apiKey
        this.baseUrl = config.baseUrl || 'https://api.mem0.ai/v1'
        this.fetchFn = config.fetch || fetch.bind(globalThis)
    }

    /**
     * Make an authenticated request to the Mem0 API.
     */
    private async request<T>(
        endpoint: string,
        options: RequestInit = {},
    ): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`

        const headers = new Headers(options.headers)
        headers.set('Content-Type', 'application/json')
        headers.set('Authorization', `Token ${this.apiKey}`)

        const response = await this.fetchFn(url, {
            ...options,
            headers,
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Mem0 API error (${response.status}): ${errorText}`)
        }

        return response.json() as Promise<T>
    }

    /**
     * Add a memory to Mem0.
     *
     * @param content - The content to store as a memory
     * @param options - Options including userId, metadata, etc.
     * @returns The created memory ID
     */
    async addMemory(content: string, options: AddMemoryOptions): Promise<string> {
        const payload: Record<string, unknown> = {
            messages: [{ role: 'user', content }],
            user_id: options.userId,
        }

        if (options.agentId) payload.agent_id = options.agentId
        if (options.metadata) payload.metadata = options.metadata
        if (options.category) {
            const existingMetadata = (payload.metadata as Record<string, unknown>) || {}
            payload.metadata = { ...existingMetadata, category: options.category }
        }

        const response = await this.request<{ results: Array<{ id: string }> }>(
            '/memories/',
            {
                method: 'POST',
                body: JSON.stringify(payload),
            },
        )

        if (response.results && response.results.length > 0) {
            return response.results[0].id
        }
        return 'stored'
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
        const payload = {
            query,
            user_id: options.userId,
            limit: options.limit || 10,
        }

        const response = await this.request<{ results: Mem0Memory[] }>(
            '/memories/search/',
            {
                method: 'POST',
                body: JSON.stringify(payload),
            },
        )

        return response.results || []
    }

    /**
     * Get all memories for a user.
     *
     * @param userId - The user ID
     * @returns Array of all user memories
     */
    async getAllMemories(userId: string): Promise<Mem0Memory[]> {
        const response = await this.request<{ results: Mem0Memory[] }>(
            `/memories/?user_id=${encodeURIComponent(userId)}`,
        )

        return response.results || []
    }

    /**
     * Get a specific memory by ID.
     *
     * @param memoryId - The memory ID
     * @returns The memory object or null
     */
    async getMemory(memoryId: string): Promise<Mem0Memory | null> {
        try {
            return await this.request<Mem0Memory>(`/memories/${memoryId}/`)
        } catch {
            return null
        }
    }

    /**
     * Update an existing memory.
     *
     * @param memoryId - The memory ID to update
     * @param content - New content for the memory
     */
    async updateMemory(memoryId: string, content: string): Promise<void> {
        await this.request(`/memories/${memoryId}/`, {
            method: 'PATCH',
            body: JSON.stringify({ text: content }),
        })
    }

    /**
     * Delete a specific memory.
     *
     * @param memoryId - The memory ID to delete
     */
    async deleteMemory(memoryId: string): Promise<void> {
        await this.request(`/memories/${memoryId}/`, {
            method: 'DELETE',
        })
    }

    /**
     * Delete all memories for a user.
     *
     * @param userId - The user ID
     */
    async deleteAllMemories(userId: string): Promise<void> {
        await this.request(`/memories/?user_id=${encodeURIComponent(userId)}`, {
            method: 'DELETE',
        })
    }
}

/**
 * Create a Mem0 client with environment-based configuration.
 *
 * Uses PUBLIC_MEM0_API_KEY or MEM0_API_KEY from environment.
 */
export function createMem0Client(): Mem0PlatformClient | null {
    // Check for API key in various environment variable formats
    const apiKey =
        (typeof import.meta !== 'undefined' &&
            import.meta.env?.PUBLIC_MEM0_API_KEY) ||
        (typeof process !== 'undefined' && process.env?.MEM0_API_KEY)

    if (!apiKey) {
        console.warn('Mem0 API key not found in environment')
        return null
    }

    return new Mem0PlatformClient({ apiKey })
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
        const response = await this.request<{ success: boolean; memory_id: string }>(
            '/api/memory/add',
            {
                method: 'POST',
                body: JSON.stringify({
                    content,
                    user_id: userId,
                    session_id: options?.sessionId,
                    category: options?.category,
                }),
            },
        )
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
