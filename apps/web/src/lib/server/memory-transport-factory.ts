import type { UnifiedMemory } from '@pixelated/memory-schema'

import { resolveInternalMemoryServiceConfig } from './internal-memory-service-auth'
import { InternalMemoryServiceClient } from './internal-memory-service-client'
import { McpMemoryTransport } from './mcp-memory-transport'

export type InternalMemoryServiceClientLike = {
  addMemory: (input: any) => Promise<{ memory_id: string }>
  listMemories: (
    input: any,
  ) => Promise<{ memories: UnifiedMemory[]; count: number }>
  searchMemories: (
    input: any,
  ) => Promise<{ memories: UnifiedMemory[]; count: number }>
  updateMemory: (input: any) => Promise<void>
  getMemory: (input: any) => Promise<UnifiedMemory | null>
  deleteMemory: (input: any) => Promise<void>
  getMemoryStats: (input: any) => Promise<{
    totalMemories: number
    categoryCounts: Record<string, number>
  }>
}

/**
 * Factory function to create the appropriate memory service transport
 * based on the MEMORY_SERVICE_TRANSPORT environment variable.
 *
 * Valid values:
 * - 'mcp': Use MCP transport to foresight-server
 * - 'http-loopback': Use HTTP self-loopback (default)
 */
export function createMemoryTransport(): InternalMemoryServiceClientLike {
  const transportType =
    process.env['MEMORY_SERVICE_TRANSPORT'] ?? 'http-loopback'

  switch (transportType) {
    case 'mcp': {
      const launcherPath =
        process.env['FORESIGHT_LAUNCHER'] ??
        'scripts/memory/foresight-server.sh'
      const timeoutMs = Number(process.env['MEMORY_SERVICE_TIMEOUT_MS'] ?? 5000)
      return new McpMemoryTransport({ launcherPath, timeoutMs })
    }
    case 'http-loopback': {
      // Legacy HTTP client - wrap to return UnifiedMemory format
      const legacyClient = new InternalMemoryServiceClient(
        resolveInternalMemoryServiceConfig(),
      )

      // Adapter to convert InternalMemoryRecord to UnifiedMemory
      return {
        addMemory: legacyClient.addMemory.bind(legacyClient),
        listMemories: async (input: any) => {
          const result = await legacyClient.listMemories(input)
          return {
            memories: result.memories.map((m: any) => ({
              id: m.id,
              tenantId: 'default',
              userId: input.userId,
              bankId: 'default',
              content: m.content ?? m.memory ?? '',
              scope: 'session',
              retention: 'short_term',
              category: m.metadata?.['category'] ?? 'general',
              tags: m.metadata?.['tags'] ?? [],
              version: 1,
              schemaVersion: '1.0.0',
              sourceService: 'foresight',
              importance: m.metadata?.['importance'] ?? 0.5,
              decayRate: 0.01,
              strengthTrend: 'stable',
              activationCount: 0,
              retrievalCount: 0,
              isGhost: false,
              gist: null,
              synthesizedFrom: [],
              vectorId: null,
              emotionalContext: m.metadata?.['emotional_context'] ?? null,
              empathyMetrics: m.metadata?.['metrics'] ?? null,
              createdAt:
                m.createdAt ?? m.created_at ?? new Date().toISOString(),
              updatedAt: m.updatedAt ?? m.updated_at ?? null,
              accessedAt: null,
              lastRetrievedAt: null,
            })),
            count: result.count,
          }
        },
        searchMemories: async (input: any) => {
          const result = await legacyClient.searchMemories(input)
          return {
            memories: result.memories.map((m: any) => ({
              id: m.id,
              tenantId: 'default',
              userId: input.userId,
              bankId: 'default',
              content: m.content ?? m.memory ?? '',
              scope: 'session',
              retention: 'short_term',
              category: m.metadata?.['category'] ?? 'general',
              tags: m.metadata?.['tags'] ?? [],
              version: 1,
              schemaVersion: '1.0.0',
              sourceService: 'foresight',
              importance: m.metadata?.['importance'] ?? 0.5,
              decayRate: 0.01,
              strengthTrend: 'stable',
              activationCount: 0,
              retrievalCount: 0,
              isGhost: false,
              gist: null,
              synthesizedFrom: [],
              vectorId: null,
              emotionalContext: m.metadata?.['emotional_context'] ?? null,
              empathyMetrics: m.metadata?.['metrics'] ?? null,
              createdAt:
                m.createdAt ?? m.created_at ?? new Date().toISOString(),
              updatedAt: m.updatedAt ?? m.updated_at ?? null,
              accessedAt: null,
              lastRetrievedAt: null,
            })),
            count: result.count,
          }
        },
        updateMemory: legacyClient.updateMemory.bind(legacyClient),
        getMemory: async (input: any): Promise<UnifiedMemory | null> => {
          const memory = await legacyClient.getMemory(input)
          if (!memory) return null
          return {
            id: memory.id,
            tenantId: 'default',
            userId: input.userId,
            bankId: 'default',
            content: memory.content ?? memory.memory ?? '',
            scope: 'session',
            retention: 'short_term',
            category: memory.metadata?.['category'] ?? 'general',
            tags: memory.metadata?.['tags'] ?? [],
            version: 1,
            schemaVersion: '1.0.0',
            sourceService: 'foresight',
            importance: memory.metadata?.['importance'] ?? 0.5,
            decayRate: 0.01,
            strengthTrend: 'stable',
            activationCount: 0,
            retrievalCount: 0,
            isGhost: false,
            gist: null,
            synthesizedFrom: [],
            vectorId: null,
            emotionalContext: memory.metadata?.['emotional_context'] ?? null,
            empathyMetrics: memory.metadata?.['metrics'] ?? null,
            createdAt:
              memory.createdAt ?? memory.created_at ?? new Date().toISOString(),
            updatedAt: memory.updatedAt ?? memory.updated_at ?? null,
            accessedAt: null,
            lastRetrievedAt: null,
          } as UnifiedMemory
        },
        deleteMemory: legacyClient.deleteMemory.bind(legacyClient),
        getMemoryStats: legacyClient.getMemoryStats.bind(legacyClient),
      }
    }
    default: {
      throw new Error(
        `Unknown memory service transport: ${transportType}. ` +
          "Valid values are 'mcp' or 'http-loopback'.",
      )
    }
  }
}
