import type {
  EmotionalContext,
  EmpathyMetrics,
  UnifiedMemory,
} from '@pixelated/memory-schema'
import {
  EmotionalContextSchema,
  EmpathyMetricsSchema,
} from '@pixelated/memory-schema'

import { resolveInternalMemoryServiceConfig } from './internal-memory-service-auth'
import {
  InternalMemoryServiceClient,
  type CreateInput,
  type DeleteInput,
  type GetInput,
  type InternalMemoryMetadata,
  type InternalMemoryRecord,
  type InternalMemoryScopeInput,
  type ListInput,
  type SearchInput,
  type UpdateInput,
} from './internal-memory-service-client'
import { McpMemoryTransport } from './mcp-memory-transport'

type InternalMemoryServiceClientLike = {
  addMemory: (input: CreateInput) => Promise<{ memory_id: string }>
  listMemories: (
    input: ListInput,
  ) => Promise<{ memories: UnifiedMemory[]; count: number }>
  searchMemories: (
    input: SearchInput,
  ) => Promise<{ memories: UnifiedMemory[]; count: number }>
  updateMemory: (input: UpdateInput) => Promise<void>
  getMemory: (input: GetInput) => Promise<UnifiedMemory | null>
  deleteMemory: (input: DeleteInput) => Promise<void>
  getMemoryStats: (input: InternalMemoryScopeInput) => Promise<{
    totalMemories: number
    categoryCounts: Record<string, number>
  }>
}

type MetadataValue = InternalMemoryMetadata[string]

const DEFAULT_CATEGORY = 'general'
const DEFAULT_IMPORTANCE = 0.5

function readString(value: MetadataValue, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

function readNumber(value: MetadataValue, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function readStringArray(value: MetadataValue): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function readEmotionalContext(value: MetadataValue): EmotionalContext | null {
  const parsed = EmotionalContextSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

function readEmpathyMetrics(value: MetadataValue): EmpathyMetrics | null {
  const parsed = EmpathyMetricsSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

function toUnifiedMemory(
  record: InternalMemoryRecord,
  userId: string,
): UnifiedMemory {
  const metadata = record.metadata
  return {
    id: record.id,
    tenantId: 'default',
    userId,
    bankId: 'default',
    content: record.content ?? record.memory ?? '',
    scope: 'session',
    retention: 'short_term',
    category: readString(metadata?.['category'], DEFAULT_CATEGORY),
    tags: readStringArray(metadata?.['tags']),
    version: 1,
    schemaVersion: '1.0.0',
    sourceService: 'foresight',
    importance: readNumber(metadata?.['importance'], DEFAULT_IMPORTANCE),
    decayRate: 0.01,
    strengthTrend: 'stable',
    activationCount: 0,
    retrievalCount: 0,
    isGhost: false,
    gist: null,
    synthesizedFrom: [],
    vectorId: null,
    emotionalContext: readEmotionalContext(metadata?.['emotional_context']),
    empathyMetrics: readEmpathyMetrics(metadata?.['metrics']),
    createdAt:
      record.createdAt ?? record.created_at ?? new Date().toISOString(),
    updatedAt: record.updatedAt ?? record.updated_at ?? null,
    accessedAt: null,
    lastRetrievedAt: null,
  }
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
      const legacyClient = new InternalMemoryServiceClient(
        resolveInternalMemoryServiceConfig(),
      )

      return {
        addMemory: legacyClient.addMemory.bind(legacyClient),
        listMemories: async (input: ListInput) => {
          const result = await legacyClient.listMemories(input)
          return {
            memories: result.memories.map((record) =>
              toUnifiedMemory(record, input.userId),
            ),
            count: result.count,
          }
        },
        searchMemories: async (input: SearchInput) => {
          const result = await legacyClient.searchMemories(input)
          return {
            memories: result.memories.map((record) =>
              toUnifiedMemory(record, input.userId),
            ),
            count: result.count,
          }
        },
        updateMemory: legacyClient.updateMemory.bind(legacyClient),
        getMemory: async (input: GetInput): Promise<UnifiedMemory | null> => {
          const record = await legacyClient.getMemory(input)
          if (!record) return null
          return toUnifiedMemory(record, input.userId)
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
