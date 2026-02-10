import type {
    AddMemoryInput,
    MemoryEntry,
    MemoryStats,
    SearchOptions,
} from './memory-client'

const BASE_URL = process.env.NEXT_PUBLIC_MEMORY_API_URL || 'http://localhost:5003'

export const mcpMemoryManager = {
    async addMemory(input: AddMemoryInput, userId = 'default_user'): Promise<string> {
        const response = await fetch(`${BASE_URL}/api/memory/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: input.content,
                user_id: userId,
                metadata: input.metadata,
                category: input.metadata?.category,
            }),
        })

        if (!response.ok) {
            throw new Error(`Failed to add memory: ${response.statusText}`)
        }

        const data = await response.json()
        return data.memory_id
    },

    async updateMemory(
        memoryId: string,
        content: string,
        _userId = 'default_user'
    ): Promise<void> {
        const response = await fetch(`${BASE_URL}/api/memory/${memoryId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: content }),
        })

        if (!response.ok) {
            throw new Error(`Failed to update memory: ${response.statusText}`)
        }
    },

    async deleteMemory(memoryId: string, _userId = 'default_user'): Promise<void> {
        const response = await fetch(`${BASE_URL}/api/memory/${memoryId}`, {
            method: 'DELETE',
        })

        if (!response.ok) {
            throw new Error(`Failed to delete memory: ${response.statusText}`)
        }
    },

    async getAllMemories(userId = 'default_user'): Promise<MemoryEntry[]> {
        const response = await fetch(`${BASE_URL}/api/memory/all/${userId}?limit=100`)

        if (!response.ok) {
            throw new Error(`Failed to fetch memories: ${response.statusText}`)
        }

        const data = await response.json()
        // Map backend format to frontend format if needed
        // Backend returns dicts. Frontend expects MemoryEntry.
        // Backend: { id, memory, ... } or { id, content, ... } ?
        // Let's check Mem0 response format or my server implementation.
        // Server returns whatever manager returns.
        // Manager uses Mem0.search which users "memory" or "content".

        return (data.memories || []).map((m: any) => ({
            id: m.id || 'unknown',
            content: m.memory || m.content || '',
            metadata: m.metadata || {},
        }))
    },

    async searchMemories(options: SearchOptions): Promise<MemoryEntry[]> {
        const { userId = 'default_user', query, limit = 10 } = options

        const response = await fetch(`${BASE_URL}/api/memory/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query,
                user_id: userId,
                limit,
            }),
        })

        if (!response.ok) {
            throw new Error(`Failed to search memories: ${response.statusText}`)
        }

        const data = await response.json()
        return (data.memories || []).map((m: any) => ({
            id: m.id || 'unknown',
            content: m.memory || m.content || '',
            metadata: m.metadata || {},
        }))
    },

    async getMemoryStats(userId = 'default_user'): Promise<MemoryStats> {
        // Since backend has no stats endpoint, fetch all and calculate
        const memories = await this.getAllMemories(userId)

        const categoryCounts: Record<string, number> = {}
        for (const m of memories) {
            const cat = (m.metadata?.category as string) || 'general'
            categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
        }

        return {
            totalMemories: memories.length,
            categoryCounts,
            recentActivity: [], // Backend doesn't track operation history in a way we can easily query yet
        }
    },

    async searchByCategory(category: string, userId = 'default_user'): Promise<MemoryEntry[]> {
        // Client-side filtering until backend supports it
        const memories = await this.getAllMemories(userId)
        return memories.filter(m => m.metadata?.category === category)
    },

    async searchByTags(tags: string[], userId = 'default_user'): Promise<MemoryEntry[]> {
        // Client-side filtering until backend supports it
        const memories = await this.getAllMemories(userId)
        return memories.filter(m => tags.every(t => (m.metadata?.tags as string[])?.includes(t)))
    },

    async getMemoryHistory(_userId = 'default_user'): Promise<any[]> {
        return []
    },

    // Legacy support methods (if needed by UI)
    async addUserPreference(userId = 'default_user', key: string, value: unknown): Promise<void> {
        await this.addMemory({
            content: `User preference: ${key} = ${JSON.stringify(value)}`,
            metadata: { category: 'preference', tags: ['preference', key] }
        }, userId)
    },

    async addConversationContext(userId = 'default_user', context: string, sessionId?: string): Promise<void> {
        await this.addMemory({
            content: context,
            metadata: { category: 'conversation', tags: ['conversation'], sessionId }
        }, userId)
    },

    async addProjectInfo(userId = 'default_user', projectInfo: string, projectId?: string): Promise<void> {
        await this.addMemory({
            content: projectInfo,
            metadata: { category: 'project', tags: ['project'], projectId }
        }, userId)
    }
}
