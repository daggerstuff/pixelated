// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn(),
}))

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: vi.fn(),
}))

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

import { InternalMemoryServiceError } from './internal-memory-service-client'
import { McpMemoryTransport } from './mcp-memory-transport'

const mockUserId = 'test-user'
const mockLauncherPath = 'scripts/memory/foresight-server.sh'

function makeMockClient() {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    callTool: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockResolvedValue({
      tools: [
        { name: 'store_memory' },
        { name: 'list_memories' },
        { name: 'query_memories' },
        { name: 'get_memory' },
        { name: 'update_memory' },
        { name: 'delete_memory' },
        { name: 'memory_status' },
      ],
    }),
  }
}

describe('McpMemoryTransport', () => {
  let transport: McpMemoryTransport
  let clientInstance: ReturnType<typeof makeMockClient>

  beforeEach(() => {
    vi.clearAllMocks()
    clientInstance = makeMockClient()
    clientInstance.callTool.mockResolvedValue({
      content: [{ type: 'text', text: '{}' }],
    })
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

  it('returns the parsed payload from store_memory', async () => {
    clientInstance.callTool.mockResolvedValueOnce({
      content: [
        { type: 'text', text: JSON.stringify({ memory_id: 'mem-123' }) },
      ],
    })

    const result = await transport.addMemory({
      content: 'test',
      userId: mockUserId,
    })

    expect(result).toEqual({ memory_id: 'mem-123' })
    expect(clientInstance.callTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'store_memory',
        arguments: expect.objectContaining({
          content: 'test',
          user_id: mockUserId,
        }),
      }),
      undefined,
      expect.objectContaining({ signal: expect.any(Object) }),
    )
  })

  it('throws InternalMemoryServiceError when store_memory fails', async () => {
    clientInstance.callTool.mockRejectedValueOnce(
      new Error('Tool execution failed'),
    )

    await expect(
      transport.addMemory({ content: 'test', userId: mockUserId }),
    ).rejects.toBeInstanceOf(InternalMemoryServiceError)
  })

  it('returns the parsed payload from list_memories', async () => {
    clientInstance.callTool.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            memories: [{ id: 'mem-1', content: 'test' }],
            count: 1,
          }),
        },
      ],
    })

    const result = await transport.listMemories({
      userId: mockUserId,
      limit: 10,
    })

    expect(result).toEqual({
      memories: [{ id: 'mem-1', content: 'test' }],
      count: 1,
    })
  })

  it('returns the parsed payload from query_memories', async () => {
    clientInstance.callTool.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            memories: [{ id: 'mem-1', content: 'test' }],
            count: 1,
          }),
        },
      ],
    })

    const result = await transport.searchMemories({
      userId: mockUserId,
      query: 'hello',
      limit: 5,
    })

    expect(result).toEqual({
      memories: [{ id: 'mem-1', content: 'test' }],
      count: 1,
    })
  })

  it('returns the memory record from get_memory when found', async () => {
    clientInstance.callTool.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            id: 'mem-123',
            content: 'test content',
            metadata: { test: true },
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          }),
        },
      ],
    })

    const result = await transport.getMemory({
      userId: mockUserId,
      memoryId: 'mem-123',
    })

    expect(result).toEqual({
      id: 'mem-123',
      content: 'test content',
      metadata: { test: true },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
  })

  it('returns null when get_memory fails to find the record', async () => {
    clientInstance.callTool.mockRejectedValueOnce(new Error('Memory not found'))

    const result = await transport.getMemory({
      userId: mockUserId,
      memoryId: 'missing',
    })

    expect(result).toBeNull()
  })

  it('completes update_memory without throwing', async () => {
    clientInstance.callTool.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify({}) }],
    })

    await expect(
      transport.updateMemory({
        userId: mockUserId,
        memoryId: 'mem-123',
        content: 'updated',
        metadata: { updated: true },
      }),
    ).resolves.toBeUndefined()
  })

  it('completes delete_memory without throwing', async () => {
    clientInstance.callTool.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify({}) }],
    })

    await expect(
      transport.deleteMemory({ userId: mockUserId, memoryId: 'mem-123' }),
    ).resolves.toBeUndefined()
  })

  it('returns the parsed payload from memory_status', async () => {
    const mockStats = {
      totalMemories: 42,
      categoryCounts: { preference: 10, fact: 32 },
    }
    clientInstance.callTool.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(mockStats) }],
    })

    const result = await transport.getMemoryStats({
      userId: mockUserId,
      includeShared: true,
    })

    expect(result).toEqual(mockStats)
    expect(clientInstance.callTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'memory_status',
        arguments: expect.objectContaining({
          user_id: mockUserId,
          include_shared: true,
        }),
      }),
      undefined,
      expect.objectContaining({ signal: expect.any(Object) }),
    )
  })

  it('closes the client and clears state', async () => {
    await transport.addMemory({ content: 'test', userId: mockUserId })
    await transport.close()

    expect(clientInstance.close).toHaveBeenCalledTimes(1)
  })
})
