import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn(),
}))

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: vi.fn(),
}))

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

import foresightTools from './__fixtures__/foresight-tools.json'
import { InternalMemoryServiceError } from './internal-memory-service-client'
import {
  FORESIGHT_MCP_TOOLS,
  McpMemoryTransport,
  REQUIRED_FORESIGHT_MCP_TOOLS,
} from './mcp-memory-transport'

type ForesightFixture = {
  foresightCommit: string
  foresightRepository: string
  toolCount: number
  tools: Record<string, { takesParams: boolean }>
}

type ToolRequest = {
  name: string
  arguments: Record<string, unknown>
}

type ToolCatalogueEntry = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

const fixture = foresightTools as ForesightFixture

const LEGACY_HELPER_NAMES = [
  'store_memory',
  'update_memory',
  'query_memories',
  'memory_status',
  'list_memories',
  'get_memory',
  'delete_memory',
]

const mockUserId = 'test-user'
const mockLauncherPath = 'scripts/memory/foresight-server.sh'
const storedMemoryId = '1b5d42ca4a2b8776'
const secondMemoryId = '9f3c1e7a5b2d4c60'

const STORE_CONFIRMATION = `Stored memory ${storedMemoryId}. Gate: auto. Reason: Normal information flow.`
const DUPLICATE_CONFIRMATION = `Duplicate detected - bumped activation for existing memory ${storedMemoryId}`
const UPDATE_CONFIRMATION = `Updated memory ${storedMemoryId}`
const DELETE_CONFIRMATION = `Deleted memory ${storedMemoryId}`
const NOT_FOUND = 'Memory deadbeef not found.'

const LIST_SUMMARY = `Memories (2 found):\n- [${storedMemoryId}] (session/short_term) probe alpha...\n- [${secondMemoryId}] (arc/long_term) probe beta...`
const SEARCH_SUMMARY = `Found 1 memories (hybrid search):\n- [${storedMemoryId}] probe alpha... (score=0.712, signals=keyword, tfidf_cosine)`

const DETAILS: Record<string, string> = {
  [storedMemoryId]: `[${storedMemoryId}] (session/short_term)\nContent: probe alpha\nTags: RISK_NONE, fact\n`,
  [secondMemoryId]: `[${secondMemoryId}] (arc/long_term)\nContent: probe beta\nTags: none\n`,
}

const STATUS_PAYLOAD = JSON.stringify({
  status: 'healthy',
  memory_count: 42,
  by_scope: { session: 1 },
  stale_count: 0,
  by_category: { preference: 10, fact: 32 },
  tenant_id: 'default',
})

function textResponse(text: string) {
  return { content: [{ type: 'text', text }] }
}

function catalogueFromFixture(
  source: ForesightFixture,
  override?: { name: string; takesParams: boolean },
): ToolCatalogueEntry[] {
  return Object.entries(source.tools).map(([name, meta]) => {
    const takesParams =
      override?.name === name ? override.takesParams : meta.takesParams
    return {
      name,
      description: '',
      inputSchema: takesParams
        ? {
            type: 'object',
            properties: { params: { type: 'object' } },
            required: ['params'],
          }
        : { type: 'object', properties: {} },
    }
  })
}

function withoutTool(name: string): ToolCatalogueEntry[] {
  return catalogueFromFixture(fixture).filter((tool) => tool.name !== name)
}

function makeMockClient(tools: ToolCatalogueEntry[]) {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    callTool: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockResolvedValue({ tools }),
  }
}

function routeResponses(client: ReturnType<typeof makeMockClient>): void {
  client.callTool.mockImplementation(async (request: ToolRequest) => {
    const params = request.arguments?.['params'] as
      | Record<string, unknown>
      | undefined
    const options = params?.['options'] as Record<string, unknown> | undefined
    const action = params?.['action']
    const queryType = options?.['query_type']

    if (request.name === FORESIGHT_MCP_TOOLS.getSystemStatus) {
      return textResponse(STATUS_PAYLOAD)
    }

    if (request.name === FORESIGHT_MCP_TOOLS.manageMemories) {
      if (action === 'store') {
        return textResponse(STORE_CONFIRMATION)
      }
      if (action === 'update') {
        return textResponse(UPDATE_CONFIRMATION)
      }
      if (action === 'delete') {
        return textResponse(DELETE_CONFIRMATION)
      }
    }

    if (request.name === FORESIGHT_MCP_TOOLS.searchMemories) {
      if (queryType === 'id') {
        const memoryId = String(options?.['memory_id'])
        return textResponse(
          DETAILS[memoryId] ?? `Memory ${memoryId} not found.`,
        )
      }
      if (queryType === 'list') {
        return textResponse(LIST_SUMMARY)
      }
      if (queryType === 'keyword') {
        return textResponse(SEARCH_SUMMARY)
      }
    }

    throw new Error(
      `unexpected MCP call ${request.name} ${JSON.stringify(request.arguments)}`,
    )
  })
}

function recordedRequests(
  client: ReturnType<typeof makeMockClient>,
): ToolRequest[] {
  return client.callTool.mock.calls.map(
    (call) => call[0] as unknown as ToolRequest,
  )
}

describe('foresight tool catalogue fixture', () => {
  it('records the registered MCP surface at a named foresight commit', () => {
    expect(fixture.foresightCommit).toMatch(/^[0-9a-f]{40}$/)
    expect(fixture.foresightRepository).toBe('daggerstuff/foresight')
    expect(fixture.toolCount).toBe(Object.keys(fixture.tools).length)
    expect(fixture.toolCount).toBe(22)

    const nested = Object.values(fixture.tools).filter(
      (tool) => tool.takesParams,
    )
    expect(nested).toHaveLength(17)
  })

  it('does not record any of the seven undecorated helper names as tools', () => {
    for (const name of LEGACY_HELPER_NAMES) {
      expect(fixture.tools).not.toHaveProperty(name)
    }
  })

  it('records every tool the transport targets, nested under params', () => {
    for (const toolName of REQUIRED_FORESIGHT_MCP_TOOLS) {
      expect(fixture.tools).toHaveProperty(toolName)
      expect(fixture.tools[toolName]?.takesParams).toBe(true)
    }
  })
})

describe('McpMemoryTransport', () => {
  let transport: McpMemoryTransport
  let clientInstance: ReturnType<typeof makeMockClient>

  beforeEach(() => {
    vi.clearAllMocks()
    clientInstance = makeMockClient(catalogueFromFixture(fixture))
    routeResponses(clientInstance)
    vi.mocked(Client).mockImplementation(function () {
      return clientInstance as unknown as Client
    })
    vi.mocked(StdioClientTransport).mockImplementation(function () {
      return {} as unknown as StdioClientTransport
    })
    transport = new McpMemoryTransport({ launcherPath: mockLauncherPath })
  })

  it('initializes the MCP client and transport lazily on first call', async () => {
    await transport.addMemory({ content: 'test', userId: mockUserId })

    expect(StdioClientTransport).toHaveBeenCalledWith(
      expect.objectContaining({ command: mockLauncherPath, args: [] }),
    )
    expect(Client).toHaveBeenCalledWith(
      { name: 'pixelated-gateway', version: '1.0.0' },
      { capabilities: {} },
    )
    expect(clientInstance.connect).toHaveBeenCalledTimes(1)
  })

  it('sends addMemory as manage_memories with an action=store params envelope', async () => {
    const result = await transport.addMemory({
      content: 'probe alpha',
      category: 'fact',
      userId: mockUserId,
      agentId: 'agent-1',
      projectId: 'project-1',
      metadata: { importance: 0.8, tags: ['clinical'], scope: 'arc' },
    })

    expect(result).toEqual({ memory_id: storedMemoryId })

    const [request] = recordedRequests(clientInstance)
    expect(request?.name).toBe(FORESIGHT_MCP_TOOLS.manageMemories)
    expect(request?.arguments).toEqual({
      params: {
        action: 'store',
        content: 'probe alpha',
        user_id: mockUserId,
        store_options: {
          category: 'fact',
          scope: 'arc',
          retention: 'short_term',
          importance: 0.8,
          tags: ['clinical'],
          agent_id: 'agent-1',
          project: 'project-1',
        },
      },
    })
  })

  it('treats a duplicate-store confirmation as a successful store', async () => {
    clientInstance.callTool.mockResolvedValueOnce(
      textResponse(DUPLICATE_CONFIRMATION),
    )

    await expect(
      transport.addMemory({ content: 'probe alpha', userId: mockUserId }),
    ).resolves.toEqual({ memory_id: storedMemoryId })
  })

  it('raises the server rejection text when a store is refused', async () => {
    clientInstance.callTool.mockResolvedValueOnce(
      textResponse("Error: Content is required for 'store' action"),
    )

    await expect(
      transport.addMemory({ content: 'probe alpha', userId: mockUserId }),
    ).rejects.toThrow(/Content is required/)
  })

  it('sends listMemories as search_memories with query_type=list', async () => {
    const result = await transport.listMemories({
      userId: mockUserId,
      limit: 10,
      category: 'fact',
      tags: ['clinical'],
      scope: 'arc',
      retention: 'long_term',
      agentId: 'agent-1',
    })

    const [request] = recordedRequests(clientInstance)
    expect(request?.name).toBe(FORESIGHT_MCP_TOOLS.searchMemories)
    expect(request?.arguments).toEqual({
      params: {
        user_id: mockUserId,
        options: {
          query_type: 'list',
          limit: 10,
          offset: 0,
          category: 'fact',
          tags: ['clinical'],
          scope: 'arc',
          retention: 'long_term',
          agent_id: 'agent-1',
        },
      },
    })

    expect(result.count).toBe(2)
    expect(result.memories.map((memory) => memory.id)).toEqual([
      storedMemoryId,
      secondMemoryId,
    ])
  })

  it('hydrates listed memories through the id lookup so content is not truncated', async () => {
    const result = await transport.listMemories({
      userId: mockUserId,
      limit: 10,
    })

    expect(result.memories[0]?.content).toBe('probe alpha')
    expect(result.memories[1]?.content).toBe('probe beta')
    expect(result.memories[0]?.scope).toBe('session')
    expect(result.memories[0]?.retention).toBe('short_term')
    expect(result.memories[1]?.scope).toBe('arc')
    expect(result.memories[0]?.tags).toEqual(['RISK_NONE', 'fact'])
    expect(result.memories[1]?.tags).toEqual([])
  })

  it('sends searchMemories as search_memories with a keyword query', async () => {
    const result = await transport.searchMemories({
      userId: mockUserId,
      query: 'probe',
      limit: 5,
      offset: 20,
      scope: 'session',
      min_importance: 0.25,
      projectId: 'project-1',
    })

    const [request] = recordedRequests(clientInstance)
    expect(request?.name).toBe(FORESIGHT_MCP_TOOLS.searchMemories)
    expect(request?.arguments).toEqual({
      params: {
        user_id: mockUserId,
        options: {
          query_type: 'keyword',
          query: 'probe',
          limit: 5,
          offset: 20,
          scope: 'session',
          min_importance: 0.25,
          project: 'project-1',
        },
      },
    })

    expect(result.count).toBe(1)
    expect(result.memories[0]?.id).toBe(storedMemoryId)
  })

  it('sends getMemory as an id lookup and returns the full record', async () => {
    const result = await transport.getMemory({
      userId: mockUserId,
      memoryId: storedMemoryId,
    })

    const [request] = recordedRequests(clientInstance)
    expect(request?.name).toBe(FORESIGHT_MCP_TOOLS.searchMemories)
    expect(request?.arguments).toEqual({
      params: {
        user_id: mockUserId,
        options: { query_type: 'id', memory_id: storedMemoryId },
      },
    })

    expect(result).toEqual(
      expect.objectContaining({
        id: storedMemoryId,
        content: 'probe alpha',
        scope: 'session',
        retention: 'short_term',
        tags: ['RISK_NONE', 'fact'],
        sourceService: 'foresight',
        isGhost: false,
      }),
    )
  })

  it('returns null when the id lookup reports the memory is missing', async () => {
    const result = await transport.getMemory({
      userId: mockUserId,
      memoryId: 'deadbeef',
    })

    expect(result).toBeNull()
  })

  it('sends updateMemory as manage_memories with an updates payload', async () => {
    await transport.updateMemory({
      userId: mockUserId,
      memoryId: storedMemoryId,
      content: 'probe alpha v2',
      category: 'preference',
      metadata: { tags: ['revised'] },
    })

    const [request] = recordedRequests(clientInstance)
    expect(request?.name).toBe(FORESIGHT_MCP_TOOLS.manageMemories)
    expect(request?.arguments).toEqual({
      params: {
        action: 'update',
        memory_id: storedMemoryId,
        user_id: mockUserId,
        updates: {
          content: 'probe alpha v2',
          category: 'preference',
          tags: ['revised'],
        },
      },
    })
  })

  it('raises a not-found error when update targets a missing memory', async () => {
    clientInstance.callTool.mockResolvedValueOnce(textResponse(NOT_FOUND))

    await expect(
      transport.updateMemory({
        userId: mockUserId,
        memoryId: 'deadbeef',
        content: 'probe',
      }),
    ).rejects.toMatchObject({ status: 404 })
  })

  it('sends deleteMemory as manage_memories with action=delete', async () => {
    await transport.deleteMemory({
      userId: mockUserId,
      memoryId: storedMemoryId,
    })

    const [request] = recordedRequests(clientInstance)
    expect(request?.name).toBe(FORESIGHT_MCP_TOOLS.manageMemories)
    expect(request?.arguments).toEqual({
      params: {
        action: 'delete',
        memory_id: storedMemoryId,
        user_id: mockUserId,
      },
    })
  })

  it('raises a not-found error when delete targets a missing memory', async () => {
    clientInstance.callTool.mockResolvedValueOnce(textResponse(NOT_FOUND))

    await expect(
      transport.deleteMemory({ userId: mockUserId, memoryId: 'deadbeef' }),
    ).rejects.toMatchObject({ status: 404 })
  })

  it('maps get_system_status onto the transport stats shape', async () => {
    const result = await transport.getMemoryStats({ userId: mockUserId })

    const [request] = recordedRequests(clientInstance)
    expect(request?.name).toBe(FORESIGHT_MCP_TOOLS.getSystemStatus)
    expect(request?.arguments).toEqual({ params: { user_id: mockUserId } })

    expect(result).toEqual({
      totalMemories: 42,
      categoryCounts: { preference: 10, fact: 32 },
    })
  })

  it('never calls one of the seven undecorated helper names', async () => {
    await transport.addMemory({ content: 'probe alpha', userId: mockUserId })
    await transport.listMemories({ userId: mockUserId, limit: 5 })
    await transport.searchMemories({
      userId: mockUserId,
      query: 'probe',
      limit: 5,
    })
    await transport.getMemory({ userId: mockUserId, memoryId: storedMemoryId })
    await transport.updateMemory({
      userId: mockUserId,
      memoryId: storedMemoryId,
      content: 'probe',
    })
    await transport.deleteMemory({
      userId: mockUserId,
      memoryId: storedMemoryId,
    })
    await transport.getMemoryStats({ userId: mockUserId })

    const names = recordedRequests(clientInstance).map(
      (request) => request.name,
    )
    expect(names.length).toBeGreaterThan(0)
    for (const name of names) {
      expect(LEGACY_HELPER_NAMES).not.toContain(name)
      expect(Object.values(FORESIGHT_MCP_TOOLS)).toContain(name)
    }
  })

  it('fails with an actionable error when a target tool is absent from listTools', async () => {
    const missingTransport = new McpMemoryTransport({
      launcherPath: mockLauncherPath,
    })
    clientInstance = makeMockClient(withoutTool('search_memories'))
    routeResponses(clientInstance)
    vi.mocked(Client).mockImplementation(function () {
      return clientInstance as unknown as Client
    })

    await expect(
      missingTransport.addMemory({ content: 'probe', userId: mockUserId }),
    ).rejects.toThrow(/does not expose required tool\(s\): search_memories/)
  })

  it('fails with an actionable error when a target tool does not declare params', async () => {
    const flatTransport = new McpMemoryTransport({
      launcherPath: mockLauncherPath,
    })
    clientInstance = makeMockClient(
      catalogueFromFixture(fixture, {
        name: 'manage_memories',
        takesParams: false,
      }),
    )
    routeResponses(clientInstance)
    vi.mocked(Client).mockImplementation(function () {
      return clientInstance as unknown as Client
    })

    await expect(
      flatTransport.addMemory({ content: 'probe', userId: mockUserId }),
    ).rejects.toThrow(/do not declare the required top-level 'params' argument/)
  })

  it('reports transport failures as InternalMemoryServiceError', async () => {
    clientInstance.callTool.mockRejectedValueOnce(
      new Error('Tool execution failed'),
    )

    await expect(
      transport.addMemory({ content: 'test', userId: mockUserId }),
    ).rejects.toBeInstanceOf(InternalMemoryServiceError)
  })

  it('closes the client and clears state', async () => {
    await transport.addMemory({ content: 'test', userId: mockUserId })
    await transport.close()

    expect(clientInstance.close).toHaveBeenCalledTimes(1)
  })

  it('reuses the initialised client across successive calls', async () => {
    await transport.addMemory({ content: 'probe', userId: mockUserId })
    await transport.getMemoryStats({ userId: mockUserId })

    expect(clientInstance.connect).toHaveBeenCalledTimes(1)
    expect(clientInstance.listTools).toHaveBeenCalledTimes(1)
  })

  it('closes safely when the client was never initialised', async () => {
    await expect(transport.close()).resolves.toBeUndefined()

    expect(clientInstance.close).not.toHaveBeenCalled()
  })

  it('hydrates summary ids concurrently while preserving result order', async () => {
    let inFlight = 0
    let peak = 0
    clientInstance.callTool.mockImplementation(async (request: ToolRequest) => {
      const params = request.arguments?.['params'] as
        | Record<string, unknown>
        | undefined
      const options = params?.['options'] as Record<string, unknown> | undefined

      if (
        request.name === FORESIGHT_MCP_TOOLS.searchMemories &&
        options?.['query_type'] === 'list'
      ) {
        return textResponse(LIST_SUMMARY)
      }

      if (
        request.name === FORESIGHT_MCP_TOOLS.searchMemories &&
        options?.['query_type'] === 'id'
      ) {
        inFlight += 1
        peak = Math.max(peak, inFlight)
        await new Promise((resolve) => setTimeout(resolve, 5))
        inFlight -= 1
        const memoryId = String(options?.['memory_id'])
        return textResponse(
          DETAILS[memoryId] ?? `Memory ${memoryId} not found.`,
        )
      }

      throw new Error(`unexpected MCP call ${request.name}`)
    })

    const result = await transport.listMemories({
      userId: mockUserId,
      limit: 10,
    })

    expect(peak).toBeGreaterThan(1)
    expect(result.memories.map((memory) => memory.id)).toEqual([
      storedMemoryId,
      secondMemoryId,
    ])
  })

  it('skips a memory that disappears between the summary and the hydration', async () => {
    const summary = `Memories (2 found):\n- [${storedMemoryId}] (session/short_term) probe alpha...\n- [gone] (session/short_term) vanished...`
    clientInstance.callTool.mockImplementation(async (request: ToolRequest) => {
      const params = request.arguments?.['params'] as
        | Record<string, unknown>
        | undefined
      const options = params?.['options'] as Record<string, unknown> | undefined

      if (options?.['query_type'] === 'list') {
        return textResponse(summary)
      }
      const memoryId = String(options?.['memory_id'])
      return textResponse(DETAILS[memoryId] ?? `Memory ${memoryId} not found.`)
    })

    const result = await transport.listMemories({
      userId: mockUserId,
      limit: 10,
    })

    expect(result.memories.map((memory) => memory.id)).toEqual([storedMemoryId])
    expect(result.count).toBe(1)
  })

  it('marks ghost nodes and strips the archive marker from the content', async () => {
    clientInstance.callTool.mockResolvedValueOnce(
      textResponse(
        `[${storedMemoryId}] (fact/permanent)\nContent: compressed gist\nTags: none\n[GHOST NODE - Content archived]`,
      ),
    )

    const result = await transport.getMemory({
      userId: mockUserId,
      memoryId: storedMemoryId,
    })

    expect(result?.isGhost).toBe(true)
    expect(result?.content).toBe('compressed gist')
    expect(result?.scope).toBe('fact')
    expect(result?.retention).toBe('permanent')
    expect(result?.tags).toEqual([])
  })

  it('keeps multi-line content that itself contains a Tags line', async () => {
    const content = 'line one\nTags: not-the-real-line\nline three'
    clientInstance.callTool.mockResolvedValueOnce(
      textResponse(
        `[${storedMemoryId}] (session/short_term)\nContent: ${content}\nTags: real, tag\n`,
      ),
    )

    const result = await transport.getMemory({
      userId: mockUserId,
      memoryId: storedMemoryId,
    })

    expect(result?.content).toBe(content)
    expect(result?.tags).toEqual(['real', 'tag'])
  })

  it('falls back to default scope and retention for unrecognised values', async () => {
    clientInstance.callTool.mockResolvedValueOnce(
      textResponse(
        `[${storedMemoryId}] (weird/forever)\nContent: probe\nTags: none\n`,
      ),
    )

    const result = await transport.getMemory({
      userId: mockUserId,
      memoryId: storedMemoryId,
    })

    expect(result?.scope).toBe('session')
    expect(result?.retention).toBe('short_term')
  })

  it('raises when the id lookup returns an unparseable payload', async () => {
    clientInstance.callTool.mockResolvedValueOnce(
      textResponse('something entirely unexpected'),
    )

    await expect(
      transport.getMemory({ userId: mockUserId, memoryId: storedMemoryId }),
    ).rejects.toThrow(/Unable to parse memory detail/)
  })

  it('raises when a store confirmation carries no memory id', async () => {
    clientInstance.callTool.mockResolvedValueOnce(textResponse('Stored'))

    await expect(
      transport.addMemory({ content: 'probe', userId: mockUserId }),
    ).rejects.toThrow(/rejected the store request/)
  })

  it('raises when a tool returns no content blocks', async () => {
    clientInstance.callTool.mockResolvedValueOnce({ content: [] })

    await expect(
      transport.addMemory({ content: 'probe', userId: mockUserId }),
    ).rejects.toThrow(/Empty response from MCP tool manage_memories/)
  })

  it('raises when a tool returns a non-text block', async () => {
    clientInstance.callTool.mockResolvedValueOnce({
      content: [{ type: 'image', data: 'binary' }],
    })

    await expect(
      transport.addMemory({ content: 'probe', userId: mockUserId }),
    ).rejects.toThrow(
      /Unexpected MCP response format from tool manage_memories/,
    )
  })

  it('maps an aborted call to a 504 timeout error', async () => {
    const aborted = new Error('aborted')
    aborted.name = 'AbortError'
    clientInstance.callTool.mockRejectedValueOnce(aborted)

    await expect(
      transport.addMemory({ content: 'probe', userId: mockUserId }),
    ).rejects.toMatchObject({ status: 504 })
  })

  it('raises when get_system_status returns a non-JSON payload', async () => {
    clientInstance.callTool.mockResolvedValueOnce(textResponse('not json'))

    await expect(
      transport.getMemoryStats({ userId: mockUserId }),
    ).rejects.toThrow(/returned a non-JSON payload/)
  })

  it('defaults missing statistics fields instead of inventing counts', async () => {
    clientInstance.callTool.mockResolvedValueOnce(
      textResponse(JSON.stringify({ status: 'healthy' })),
    )

    const result = await transport.getMemoryStats({ userId: mockUserId })

    expect(result).toEqual({ totalMemories: 0, categoryCounts: {} })
  })

  it('ignores non-numeric category counts', async () => {
    clientInstance.callTool.mockResolvedValueOnce(
      textResponse(
        JSON.stringify({
          memory_count: 3,
          by_category: { fact: 2, broken: 'x' },
        }),
      ),
    )

    const result = await transport.getMemoryStats({ userId: mockUserId })

    expect(result).toEqual({ totalMemories: 3, categoryCounts: { fact: 2 } })
  })

  it('raises when an update is refused with an unrecognised response', async () => {
    clientInstance.callTool.mockResolvedValueOnce(
      textResponse('No updates provided.'),
    )

    await expect(
      transport.updateMemory({
        userId: mockUserId,
        memoryId: storedMemoryId,
        content: 'probe',
      }),
    ).rejects.toThrow(/rejected the update request/)
  })

  it('raises when a delete is refused with an unrecognised response', async () => {
    clientInstance.callTool.mockResolvedValueOnce(
      textResponse('Cannot delete this memory.'),
    )

    await expect(
      transport.deleteMemory({ userId: mockUserId, memoryId: storedMemoryId }),
    ).rejects.toThrow(/rejected the delete request/)
  })

  it('does not send update fields that the update action cannot persist', async () => {
    await transport.updateMemory({
      userId: mockUserId,
      memoryId: storedMemoryId,
      content: 'probe alpha v2',
      metadata: {
        importance: 0.9,
        emotional_context: { valence: 1 },
        metrics: { reciprocity: 1 },
        tags: ['x'],
      },
    })

    const [request] = recordedRequests(clientInstance)
    const params = request?.arguments['params'] as
      | Record<string, unknown>
      | undefined
    const updates = params?.['updates'] as Record<string, unknown> | undefined

    expect(updates).toEqual({ content: 'probe alpha v2', tags: ['x'] })
    expect(updates).not.toHaveProperty('importance')
    expect(updates).not.toHaveProperty('emotional_context')
    expect(updates).not.toHaveProperty('metrics')
  })
})
