import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import {
  isMemoryScope,
  isRetentionPolicy,
  type MemoryScope,
  type RetentionPolicy,
  type UnifiedMemory,
} from '@pixelated/memory-schema'

import {
  InternalMemoryServiceError,
  type InternalMemoryMetadata,
} from './internal-memory-service-client'

export const FORESIGHT_MCP_TOOLS = {
  manageMemories: 'manage_memories',
  searchMemories: 'search_memories',
  getSystemStatus: 'get_system_status',
} as const

export type ForesightMcpToolName =
  (typeof FORESIGHT_MCP_TOOLS)[keyof typeof FORESIGHT_MCP_TOOLS]

export const REQUIRED_FORESIGHT_MCP_TOOLS: readonly ForesightMcpToolName[] = [
  FORESIGHT_MCP_TOOLS.manageMemories,
  FORESIGHT_MCP_TOOLS.searchMemories,
  FORESIGHT_MCP_TOOLS.getSystemStatus,
]

type McpMemoryTransportLike = Pick<
  McpMemoryTransport,
  | 'addMemory'
  | 'listMemories'
  | 'searchMemories'
  | 'updateMemory'
  | 'getMemory'
  | 'deleteMemory'
  | 'getMemoryStats'
>

type ToolContract = {
  takesParams: boolean
}

type ParsedMemoryDetail = {
  id: string
  scope: MemoryScope
  retention: RetentionPolicy
  content: string
  tags: string[]
  isGhost: boolean
}

type ForesightSystemStatus = {
  memory_count?: unknown
  by_category?: unknown
}

const STORED_MEMORY_PATTERN = /^Stored memory (\S+?)\./
const DUPLICATE_MEMORY_PATTERN =
  /^Duplicate detected - bumped activation for existing memory (\S+)$/
const UPDATED_MEMORY_PATTERN = /^Updated memory (\S+)$/
const DELETED_MEMORY_PATTERN = /^Deleted memory (\S+)$/
const MEMORY_NOT_FOUND_PATTERN = /^Memory (\S+) not found\.$/
const MEMORY_SUMMARY_ENTRY_PATTERN = /^- \[([^\]\n]+)\] /gm
const MEMORY_DETAIL_HEADER_PATTERN =
  /^\[([^\]\n]+)\] \(([^/\n]+)\/([^)\n]+)\)\nContent: /
const GHOST_MARKER = '\n[GHOST NODE - Content archived]'
const TAGS_SEPARATOR = '\nTags: '
const EMPTY_TAGS = 'none'

const HYDRATION_CONCURRENCY = 8

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  const workerCount = Math.max(1, Math.min(limit, items.length))
  const workers = Array.from({ length: workerCount }, async () => {
    for (;;) {
      const index = cursor
      cursor += 1
      if (index >= items.length) {
        return
      }
      results[index] = await mapper(items[index])
    }
  })
  await Promise.all(workers)
  return results
}

function compact(entries: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(entries)) {
    if (value !== undefined) {
      out[key] = value
    }
  }
  return out
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined
  }
  return value as Record<string, unknown>
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }
  return value.filter((item): item is string => typeof item === 'string')
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function asScope(value: unknown, fallback: MemoryScope): MemoryScope {
  return isMemoryScope(value) ? value : fallback
}

function asRetention(
  value: unknown,
  fallback: RetentionPolicy,
): RetentionPolicy {
  return isRetentionPolicy(value) ? value : fallback
}

function parseStoredMemoryId(text: string): string | null {
  const stored = STORED_MEMORY_PATTERN.exec(text)
  if (stored?.[1]) {
    return stored[1]
  }
  const duplicate = DUPLICATE_MEMORY_PATTERN.exec(text)
  return duplicate?.[1] ?? null
}

function parseUpdatedMemoryId(text: string): string | null {
  return UPDATED_MEMORY_PATTERN.exec(text)?.[1] ?? null
}

function parseDeletedMemoryId(text: string): string | null {
  return DELETED_MEMORY_PATTERN.exec(text)?.[1] ?? null
}

function isMemoryNotFound(text: string): boolean {
  return MEMORY_NOT_FOUND_PATTERN.test(text)
}

function parseListedMemoryIds(text: string): string[] {
  const ids: string[] = []
  for (const match of text.matchAll(MEMORY_SUMMARY_ENTRY_PATTERN)) {
    const id = match[1]
    if (id) {
      ids.push(id)
    }
  }
  return ids
}

function parseMemoryDetail(text: string): ParsedMemoryDetail | null {
  const isGhost = text.endsWith(GHOST_MARKER)
  const body = isGhost ? text.slice(0, -GHOST_MARKER.length) : text
  const header = MEMORY_DETAIL_HEADER_PATTERN.exec(body)
  if (!header) {
    return null
  }
  const id = header[1]
  const scope = header[2]
  const retention = header[3]
  if (!id || !scope || !retention) {
    return null
  }

  const remainder = body.slice(header[0].length)
  const tagsIndex = remainder.lastIndexOf(TAGS_SEPARATOR)
  const content = tagsIndex === -1 ? remainder : remainder.slice(0, tagsIndex)
  const tagsText = (
    tagsIndex === -1 ? '' : remainder.slice(tagsIndex + TAGS_SEPARATOR.length)
  ).trim()

  return {
    id,
    scope: asScope(scope, 'session'),
    retention: asRetention(retention, 'short_term'),
    content,
    tags:
      tagsText === EMPTY_TAGS || tagsText.length === 0
        ? []
        : tagsText
            .split(', ')
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0),
    isGhost,
  }
}

export class McpMemoryTransport implements McpMemoryTransportLike {
  private client: Client | null = null
  private transport: StdioClientTransport | null = null
  private tools: Record<string, ToolContract> | null = null
  private readonly launcherPath: string
  private readonly timeoutMs: number
  private readonly env: Record<string, string>

  constructor(config: {
    launcherPath: string
    timeoutMs?: number
    env?: Record<string, string>
  }) {
    this.launcherPath = config.launcherPath
    this.timeoutMs = config.timeoutMs ?? 5000
    this.env = config.env ?? {}
  }

  private async initialize(): Promise<void> {
    if (this.client && this.tools) {
      return
    }

    try {
      const transport = new StdioClientTransport({
        command: this.launcherPath,
        args: [],
        env: { ...this.env, ...this.filteredProcessEnv() },
      })

      const client = new Client(
        { name: 'pixelated-gateway', version: '1.0.0' },
        { capabilities: {} },
      )

      await client.connect(transport)

      const toolsResult = await client.listTools()
      const tools: Record<string, ToolContract> = {}
      for (const tool of toolsResult.tools) {
        const properties = tool.inputSchema?.properties
        tools[tool.name] = {
          takesParams: Boolean(
            properties && Object.hasOwn(properties, 'params'),
          ),
        }
      }

      try {
        this.assertToolContract(tools)
      } catch (contractError) {
        await client.close()
        throw contractError
      }

      this.client = client
      this.transport = transport
      this.tools = tools
    } catch (err) {
      if (err instanceof InternalMemoryServiceError) {
        throw err
      }
      throw new InternalMemoryServiceError(
        'MCP transport connection failed',
        503,
        {
          launcherPath: this.launcherPath,
          error: String(err),
        },
      )
    }
  }

  private assertToolContract(tools: Record<string, ToolContract>): void {
    const missing = REQUIRED_FORESIGHT_MCP_TOOLS.filter((name) => !tools[name])
    if (missing.length > 0) {
      throw new InternalMemoryServiceError(
        `Foresight MCP server at ${this.launcherPath} does not expose required tool(s): ${missing.join(', ')}. ` +
          'The transport targets the registered foresight MCP tools ' +
          `(${REQUIRED_FORESIGHT_MCP_TOOLS.join(', ')}); the undecorated Python helpers ` +
          '(store_memory, update_memory, query_memories, memory_status, list_memories, ' +
          'get_memory, delete_memory) are not MCP tools. Point FORESIGHT_LAUNCHER at a ' +
          'foresight server that registers the MCP surface.',
        503,
        {
          launcherPath: this.launcherPath,
          missingTools: missing,
          availableTools: Object.keys(tools).sort(),
        },
      )
    }

    const unNested = REQUIRED_FORESIGHT_MCP_TOOLS.filter(
      (name) => !tools[name]?.takesParams,
    )
    if (unNested.length > 0) {
      throw new InternalMemoryServiceError(
        `Foresight MCP tool(s) ${unNested.join(', ')} do not declare the required top-level ` +
          `'params' argument. The transport sends {"params": {...}}; a tool that accepts flat ` +
          'arguments would reject that envelope. Update the transport mapping for the installed ' +
          'foresight version.',
        503,
        { launcherPath: this.launcherPath, toolsWithoutParams: unNested },
      )
    }
  }

  private filteredProcessEnv(): Record<string, string> {
    const out: Record<string, string> = {}
    for (const [key, value] of Object.entries(process.env)) {
      if (typeof value === 'string') {
        out[key] = value
      }
    }
    return out
  }

  private async callToolText(
    toolName: ForesightMcpToolName,
    args: Record<string, unknown>,
  ): Promise<string> {
    if (!this.client || !this.tools) {
      await this.initialize()
    }

    const client = this.client
    const tools = this.tools
    if (!client || !tools) {
      throw new InternalMemoryServiceError(
        'MCP transport failed to initialize',
        500,
      )
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const result = await client.callTool(
        { name: toolName, arguments: args },
        undefined,
        { signal: controller.signal },
      )

      const content = result.content
      if (!Array.isArray(content) || content.length === 0) {
        throw new InternalMemoryServiceError(
          `Empty response from MCP tool ${toolName}`,
          500,
          { toolName },
        )
      }

      const textContent = content[0] as { type?: string; text?: string }
      if (
        textContent?.type !== 'text' ||
        typeof textContent.text !== 'string'
      ) {
        throw new InternalMemoryServiceError(
          `Unexpected MCP response format from tool ${toolName}`,
          500,
          { toolName },
        )
      }

      return textContent.text
    } catch (err: unknown) {
      if (err instanceof InternalMemoryServiceError) {
        throw err
      }

      if (err instanceof Error && err.name === 'AbortError') {
        throw new InternalMemoryServiceError(
          `MCP tool ${toolName} call timeout`,
          504,
          { toolName },
        )
      }

      const message = err instanceof Error ? err.message : String(err)
      throw new InternalMemoryServiceError(message, 500, { toolName })
    } finally {
      clearTimeout(timeoutId)
    }
  }

  private async callToolJson<T>(
    toolName: ForesightMcpToolName,
    args: Record<string, unknown>,
  ): Promise<T> {
    const text = await this.callToolText(toolName, args)
    try {
      return JSON.parse(text) as T
    } catch {
      throw new InternalMemoryServiceError(
        `MCP tool ${toolName} returned a non-JSON payload`,
        500,
        { toolName, payloadPreview: text.slice(0, 500) },
      )
    }
  }

  private async fetchMemoryDetail(
    memoryId: string,
    userId: string,
    agentId?: string,
    projectId?: string,
  ): Promise<ParsedMemoryDetail | null> {
    const text = await this.callToolText(FORESIGHT_MCP_TOOLS.searchMemories, {
      params: compact({
        user_id: userId,
        options: compact({
          query_type: 'id',
          memory_id: memoryId,
          agent_id: agentId,
          project: projectId,
        }),
      }),
    })

    if (isMemoryNotFound(text)) {
      return null
    }

    const detail = parseMemoryDetail(text)
    if (!detail) {
      throw new InternalMemoryServiceError(
        `Unable to parse memory detail returned by foresight for ${memoryId}`,
        500,
        { memoryId, payloadPreview: text.slice(0, 500) },
      )
    }

    return detail
  }

  private toUnifiedMemory(
    detail: ParsedMemoryDetail,
    userId: string,
  ): UnifiedMemory {
    return {
      id: detail.id,
      tenantId: 'default',
      userId,
      bankId: 'default',
      content: detail.content,
      scope: detail.scope,
      retention: detail.retention,
      category: 'general',
      tags: detail.tags,
      version: 1,
      schemaVersion: '1.0.0',
      sourceService: 'foresight',
      importance: 0.5,
      decayRate: 0.01,
      strengthTrend: 'stable',
      activationCount: 0,
      retrievalCount: 0,
      isGhost: detail.isGhost,
      gist: null,
      synthesizedFrom: [],
      vectorId: null,
      emotionalContext: null,
      empathyMetrics: null,
      createdAt: new Date().toISOString(),
      updatedAt: null,
      accessedAt: null,
      lastRetrievedAt: null,
    }
  }

  private async hydrateMemories(
    ids: readonly string[],
    userId: string,
    agentId?: string,
    projectId?: string,
  ): Promise<UnifiedMemory[]> {
    const details = await mapWithConcurrency(ids, HYDRATION_CONCURRENCY, (id) =>
      this.fetchMemoryDetail(id, userId, agentId, projectId),
    )

    return details
      .filter((detail): detail is ParsedMemoryDetail => detail !== null)
      .map((detail) => this.toUnifiedMemory(detail, userId))
  }

  async addMemory(input: {
    content: string
    category?: string
    metadata?: InternalMemoryMetadata
    userId: string
    accountId?: string
    workspaceId?: string
    orgId?: string
    projectId?: string
    sessionId?: string
    agentId?: string
    runId?: string
    includeShared?: boolean
  }): Promise<{ memory_id: string }> {
    const metadata = input.metadata ?? {}

    const text = await this.callToolText(FORESIGHT_MCP_TOOLS.manageMemories, {
      params: compact({
        action: 'store',
        content: input.content,
        user_id: input.userId,
        store_options: compact({
          category: input.category,
          scope: asScope(metadata['scope'], 'session'),
          retention: asRetention(metadata['retention'], 'short_term'),
          importance: asNumber(metadata['importance']) ?? 0.5,
          tags: asStringArray(metadata['tags']) ?? [],
          emotional_context: asRecord(metadata['emotional_context']),
          metrics: asRecord(metadata['metrics']),
          agent_id: input.agentId,
          project: input.projectId,
        }),
      }),
    })

    const memoryId = parseStoredMemoryId(text)
    if (!memoryId) {
      throw new InternalMemoryServiceError(
        `Foresight rejected the store request: ${text}`,
        500,
        { payloadPreview: text.slice(0, 500) },
      )
    }

    return { memory_id: memoryId }
  }

  async listMemories(input: {
    limit: number
    offset?: number
    category?: string
    tags?: string[]
    scope?: string
    retention?: string
    userId: string
    accountId?: string
    workspaceId?: string
    orgId?: string
    projectId?: string
    sessionId?: string
    agentId?: string
    runId?: string
    includeShared?: boolean
  }): Promise<{ memories: UnifiedMemory[]; count: number }> {
    const text = await this.callToolText(FORESIGHT_MCP_TOOLS.searchMemories, {
      params: compact({
        user_id: input.userId,
        options: compact({
          query_type: 'list',
          limit: input.limit,
          offset: input.offset ?? 0,
          category: input.category,
          tags: input.tags,
          scope: input.scope,
          retention: input.retention,
          agent_id: input.agentId,
          project: input.projectId,
        }),
      }),
    })

    const ids = parseListedMemoryIds(text)
    const memories = await this.hydrateMemories(
      ids,
      input.userId,
      input.agentId,
      input.projectId,
    )

    return { memories, count: memories.length }
  }

  async searchMemories(input: {
    query: string
    limit: number
    offset?: number
    category?: string
    tags?: string[]
    scope?: string
    retention?: string
    userId: string
    accountId?: string
    workspaceId?: string
    orgId?: string
    projectId?: string
    sessionId?: string
    agentId?: string
    runId?: string
    includeShared?: boolean
    min_importance?: number
  }): Promise<{ memories: UnifiedMemory[]; count: number }> {
    const text = await this.callToolText(FORESIGHT_MCP_TOOLS.searchMemories, {
      params: compact({
        user_id: input.userId,
        options: compact({
          query_type: 'keyword',
          query: input.query,
          limit: input.limit,
          offset: input.offset,
          category: input.category,
          tags: input.tags,
          scope: input.scope,
          retention: input.retention,
          min_importance: input.min_importance ?? 0.1,
          agent_id: input.agentId,
          project: input.projectId,
        }),
      }),
    })

    const ids = parseListedMemoryIds(text)
    const memories = await this.hydrateMemories(
      ids,
      input.userId,
      input.agentId,
      input.projectId,
    )

    return { memories, count: memories.length }
  }

  async getMemory(input: {
    memoryId: string
    userId: string
    accountId?: string
    workspaceId?: string
    orgId?: string
    projectId?: string
    sessionId?: string
    agentId?: string
    runId?: string
    includeShared?: boolean
    min_importance?: number
  }): Promise<UnifiedMemory | null> {
    const detail = await this.fetchMemoryDetail(
      input.memoryId,
      input.userId,
      input.agentId,
      input.projectId,
    )

    return detail ? this.toUnifiedMemory(detail, input.userId) : null
  }

  async updateMemory(input: {
    memoryId: string
    content: string
    category?: string
    metadata?: InternalMemoryMetadata
    userId: string
    accountId?: string
    workspaceId?: string
    orgId?: string
    projectId?: string
    sessionId?: string
    agentId?: string
    runId?: string
  }): Promise<void> {
    const metadata = input.metadata ?? {}

    const text = await this.callToolText(FORESIGHT_MCP_TOOLS.manageMemories, {
      params: compact({
        action: 'update',
        memory_id: input.memoryId,
        user_id: input.userId,
        updates: compact({
          content: input.content,
          category: input.category,
          scope: metadata['scope'],
          retention: metadata['retention'],
          tags: asStringArray(metadata['tags']),
        }),
      }),
    })

    if (isMemoryNotFound(text)) {
      throw new InternalMemoryServiceError(text, 404, {
        memoryId: input.memoryId,
      })
    }

    if (!parseUpdatedMemoryId(text)) {
      throw new InternalMemoryServiceError(
        `Foresight rejected the update request: ${text}`,
        500,
        { memoryId: input.memoryId, payloadPreview: text.slice(0, 500) },
      )
    }
  }

  async deleteMemory(input: {
    memoryId: string
    userId: string
    accountId?: string
    workspaceId?: string
    orgId?: string
    projectId?: string
    sessionId?: string
    agentId?: string
    runId?: string
  }): Promise<void> {
    const text = await this.callToolText(FORESIGHT_MCP_TOOLS.manageMemories, {
      params: compact({
        action: 'delete',
        memory_id: input.memoryId,
        user_id: input.userId,
      }),
    })

    if (isMemoryNotFound(text)) {
      throw new InternalMemoryServiceError(text, 404, {
        memoryId: input.memoryId,
      })
    }

    if (!parseDeletedMemoryId(text)) {
      throw new InternalMemoryServiceError(
        `Foresight rejected the delete request: ${text}`,
        500,
        { memoryId: input.memoryId, payloadPreview: text.slice(0, 500) },
      )
    }
  }

  async getMemoryStats(input: {
    userId: string
    accountId?: string
    workspaceId?: string
    orgId?: string
    projectId?: string
    sessionId?: string
    agentId?: string
    runId?: string
    includeShared?: boolean
  }): Promise<{
    totalMemories: number
    categoryCounts: Record<string, number>
  }> {
    const payload = await this.callToolJson<ForesightSystemStatus>(
      FORESIGHT_MCP_TOOLS.getSystemStatus,
      { params: compact({ user_id: input.userId }) },
    )

    const totalMemories = asNumber(payload.memory_count) ?? 0
    const byCategory = asRecord(payload.by_category)
    const categoryCounts: Record<string, number> = {}
    if (byCategory) {
      for (const [category, count] of Object.entries(byCategory)) {
        const numeric = asNumber(count)
        if (numeric !== undefined) {
          categoryCounts[category] = numeric
        }
      }
    }

    return { totalMemories, categoryCounts }
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close()
      this.client = null
    }
    if (this.transport) {
      this.transport = null
    }
    this.tools = null
  }
}
