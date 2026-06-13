import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { UnifiedMemory } from '@pixelated/memory-schema'

import {
  InternalMemoryServiceError,
  type InternalMemoryMetadata,
} from './internal-memory-service-client'

export type McpMemoryTransportLike = Pick<
  McpMemoryTransport,
  | 'addMemory'
  | 'listMemories'
  | 'searchMemories'
  | 'updateMemory'
  | 'getMemory'
  | 'deleteMemory'
  | 'getMemoryStats'
>

export class McpMemoryTransport implements McpMemoryTransportLike {
  private client: Client | null = null
  private transport: StdioClientTransport | null = null
  private tools: Record<string, any> | null = null
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
      const tools: Record<string, unknown> = {}
      for (const tool of toolsResult.tools) {
        tools[tool.name] = tool
      }

      this.client = client
      this.transport = transport
      this.tools = tools
    } catch (err) {
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

  private filteredProcessEnv(): Record<string, string> {
    const out: Record<string, string> = {}
    for (const [key, value] of Object.entries(process.env)) {
      if (typeof value === 'string') {
        out[key] = value
      }
    }
    return out
  }

  private async callTool<T>(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<T> {
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

    if (!tools[toolName]) {
      throw new InternalMemoryServiceError(
        `MCP tool ${toolName} not available`,
        500,
      )
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs)

      const result = await client.callTool(
        { name: toolName, arguments: args },
        undefined,
        {
          signal: controller.signal,
        },
      )

      clearTimeout(timeoutId)

      const content = result.content as Array<{ type: string; text?: string }>
      if (content.length === 0) {
        throw new InternalMemoryServiceError(
          'Empty response from MCP tool',
          500,
        )
      }

      const textContent = content[0]
      if (
        textContent?.type !== 'text' ||
        typeof textContent?.text !== 'string'
      ) {
        throw new InternalMemoryServiceError(
          'Unexpected MCP response format',
          500,
        )
      }

      return JSON.parse(textContent.text) as T
    } catch (err: unknown) {
      if (err instanceof InternalMemoryServiceError) {
        throw err
      }

      if (err instanceof Error && err.name === 'AbortError') {
        throw new InternalMemoryServiceError('MCP tool call timeout', 504)
      }

      // Parse error message from MCP
      let message = 'Unknown MCP error'
      let details: unknown = undefined
      if (err instanceof Error) {
        message = err.message
      }

      throw new InternalMemoryServiceError(message, 500, details)
    }
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
    const result = await this.callTool<{ memory_id: string }>('store_memory', {
      content: input.content,
      category: input.category,
      metadata: input.metadata,
      user_id: input.userId,
      account_id: input.accountId,
      workspace_id: input.workspaceId,
      org_id: input.orgId,
      project_id: input.projectId,
      session_id: input.sessionId,
      agent_id: input.agentId,
      run_id: input.runId,
      importance: input.metadata?.['importance'] ?? 0.5,
      tags: input.metadata?.['tags'] ?? [],
      scope: input.metadata?.['scope'] ?? 'session',
      retention: input.metadata?.['retention'] ?? 'short_term',
      emotional_context: input.metadata?.['emotional_context'],
      metrics: input.metadata?.['metrics'],
      source_service: 'astro-frontend',
    })

    return { memory_id: result.memory_id }
  }

  async listMemories(input: {
    limit: number
    offset?: number
    category?: string
    tags?: string[]
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
    const result = await this.callTool<{
      memories: UnifiedMemory[]
      count: number
    }>('list_memories', {
      limit: input.limit,
      offset: input.offset ?? 0,
      category: input.category,
      tags: input.tags ?? [],
      user_id: input.userId,
      account_id: input.accountId,
      workspace_id: input.workspaceId,
      org_id: input.orgId,
      project_id: input.projectId,
      session_id: input.sessionId,
      agent_id: input.agentId,
      run_id: input.runId,
      include_shared: input.includeShared ?? true,
    })

    return {
      memories: result.memories,
      count: result.count,
    }
  }

  async searchMemories(input: {
    query: string
    limit: number
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
    const result = await this.callTool<{
      memories: UnifiedMemory[]
      count: number
    }>('query_memories', {
      query: input.query,
      limit: input.limit,
      user_id: input.userId,
      account_id: input.accountId,
      workspace_id: input.workspaceId,
      org_id: input.orgId,
      project_id: input.projectId,
      session_id: input.sessionId,
      agent_id: input.agentId,
      run_id: input.runId,
      include_shared: input.includeShared ?? true,
      min_importance: input.min_importance ?? 0.1,
    })

    return {
      memories: result.memories,
      count: result.count,
    }
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
    try {
      const result = await this.callTool<UnifiedMemory>('get_memory', {
        memory_id: input.memoryId,
        user_id: input.userId,
        account_id: input.accountId,
        workspace_id: input.workspaceId,
        org_id: input.orgId,
        project_id: input.projectId,
        session_id: input.sessionId,
        agent_id: input.agentId,
        run_id: input.runId,
        include_shared: input.includeShared ?? true,
        min_importance: input.min_importance ?? 0.1,
      })

      return result
    } catch (err: unknown) {
      if (
        err instanceof InternalMemoryServiceError &&
        err.message.includes('not found')
      ) {
        return null
      }
      throw err
    }
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
    await this.callTool<void>('update_memory', {
      memory_id: input.memoryId,
      content: input.content,
      category: input.category,
      metadata: input.metadata,
      user_id: input.userId,
      account_id: input.accountId,
      workspace_id: input.workspaceId,
      org_id: input.orgId,
      project_id: input.projectId,
      session_id: input.sessionId,
      agent_id: input.agentId,
      run_id: input.runId,
      importance: input.metadata?.['importance'] ?? 0.5,
      tags: input.metadata?.['tags'] ?? [],
      scope: input.metadata?.['scope'] ?? 'session',
      retention: input.metadata?.['retention'] ?? 'short_term',
      emotional_context: input.metadata?.['emotional_context'],
      metrics: input.metadata?.['metrics'],
    })
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
    await this.callTool<void>('delete_memory', {
      memory_id: input.memoryId,
      user_id: input.userId,
      account_id: input.accountId,
      workspace_id: input.workspaceId,
      org_id: input.orgId,
      project_id: input.projectId,
      session_id: input.sessionId,
      agent_id: input.agentId,
      run_id: input.runId,
    })
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
    const result = await this.callTool<{
      totalMemories: number
      categoryCounts: Record<string, number>
    }>('memory_status', {
      user_id: input.userId,
      account_id: input.accountId,
      workspace_id: input.workspaceId,
      org_id: input.orgId,
      project_id: input.projectId,
      session_id: input.sessionId,
      agent_id: input.agentId,
      run_id: input.runId,
      include_shared: input.includeShared ?? true,
    })

    return {
      totalMemories: result.totalMemories,
      categoryCounts: result.categoryCounts,
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close()
      this.client = null
    }
    if (this.transport) {
      // The transport will be closed when the client closes
      this.transport = null
    }
    this.tools = null
  }
}
