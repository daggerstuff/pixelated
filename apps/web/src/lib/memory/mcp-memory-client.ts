import type { PublicMemory } from '@/lib/memory/contract/v1'

import {
  DEFAULT_INGESTION_GATE_BASE_URL,
  IngestionGateClient,
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

/**
 * Memory client for the browser.
 *
 * All operations use relative URLs (/api/v1/memory/*) resolved against the
 * browser's current origin. The Astro gateway handles auth, scope validation,
 * and proxies to the internal memory service.
 *
 * Do NOT use absolute URLs or NEXT_PUBLIC_* env vars here.
 */

const api = new MemoryApiClient({ baseUrl: DEFAULT_MEMORY_API_BASE_URL })
const ingestionGate = new IngestionGateClient({
  baseUrl: DEFAULT_INGESTION_GATE_BASE_URL,
})

export const mcpMemoryManager = {
  async addMemory(input: AddMemoryInput, userId?: string): Promise<string> {
    requireUserId(userId)

    const gateResult = await ingestionGate.ingest({
      content: input.content,
      source_id: crypto.randomUUID(),
      user_id: userId,
    })

    if (!gateResult.accepted) {
      throw new Error(getGateRejectionReason(gateResult.report))
    }

    const response = await api.create({
      content: input.content,
      ...(input.metadata?.category
        ? { category: input.metadata.category }
        : {}),
      ...(input.metadata?.tags ? { tags: input.metadata.tags } : {}),
    })
    return response.data.id
  },

  async updateMemory(
    memoryId: string,
    content: string,
    userId?: string,
  ): Promise<void> {
    requireUserId(userId)
    await api.update(memoryId, { content })
  },

  async deleteMemory(memoryId: string, userId?: string): Promise<void> {
    requireUserId(userId)
    await api.delete(memoryId)
  },

  async getAllMemories(userId?: string): Promise<MemoryEntry[]> {
    requireUserId(userId)
    const response = await api.list({ limit: 100, offset: 0, tags: undefined })
    return response.data.map(toMemoryEntry)
  },

  async searchMemories(options: SearchOptions): Promise<MemoryEntry[]> {
    requireUserId(options.userId)
    const response = await api.search({
      q: options.query,
      limit: options.limit,
    })
    return response.data.map(toMemoryEntry)
  },

  async getMemoryStats(userId?: string): Promise<MemoryStats> {
    requireUserId(userId)
    const response = await api.list({ limit: 100, offset: 0, tags: undefined })
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
  },

  async searchByCategory(
    category: string,
    userId?: string,
  ): Promise<MemoryEntry[]> {
    requireUserId(userId)
    const response = await api.list({
      category,
      limit: 100,
      offset: 0,
      tags: undefined,
    })
    return response.data.map(toMemoryEntry)
  },

  async searchByTags(tags: string[], userId?: string): Promise<MemoryEntry[]> {
    requireUserId(userId)
    const response = await api.list({ tags, limit: 100, offset: 0 })
    return response.data.map(toMemoryEntry)
  },

  async getMemoryHistory(userId?: string): Promise<unknown[]> {
    requireUserId(userId)
    return []
  },

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

function getGateRejectionReason(report: Record<string, unknown>): string {
  const gateMap = report['gates']
  const gates =
    typeof gateMap === 'object' && gateMap !== null
      ? Object.values(gateMap as Record<string, unknown>)
      : []

  for (const gate of gates) {
    if (
      typeof gate === 'object' &&
      gate !== null &&
      'decision' in gate &&
      (gate as { decision?: unknown }).decision === 'block' &&
      'reason' in gate &&
      typeof (gate as { reason?: unknown }).reason === 'string'
    ) {
      return (gate as { reason: string }).reason
    }
  }

  return 'Memory ingestion was blocked by the safety gate.'
}

function requireUserId(userId?: string): string {
  if (!userId) {
    throw new Error('Memory operations require an authenticated user id')
  }
  return userId
}

function toMemoryEntry(memory: PublicMemory): MemoryEntry {
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
