import { describe, expect, it, vi } from 'vitest'

import { Mem0PlatformClient, createMem0Client } from '../mem0-platform-client'

vi.mock('../mcp-memory-client', () => ({
  mcpMemoryManager: {
    addMemory: vi.fn(async () => 'mem-1'),
    searchMemories: vi.fn(async () => [
      { id: 'mem-1', content: 'project alpha', metadata: { category: 'project' } },
    ]),
    getAllMemories: vi.fn(async () => [
      { id: 'mem-1', content: 'project alpha', metadata: { category: 'project' } },
    ]),
    updateMemory: vi.fn(async () => undefined),
    deleteMemory: vi.fn(async () => undefined),
  },
}))

describe('Mem0PlatformClient compatibility wrapper', () => {
  it('creates a proxy-backed client without a mem0 api key', () => {
    expect(createMem0Client()).toBeInstanceOf(Mem0PlatformClient)
  })

  it('maps proxy search responses into legacy mem0 shape', async () => {
    const client = new Mem0PlatformClient({})

    const results = await client.searchMemories('project', { userId: 'vivi' })

    expect(results).toEqual([
      {
        id: 'mem-1',
        memory: 'project alpha',
        metadata: { category: 'project' },
      },
    ])
  })
})
