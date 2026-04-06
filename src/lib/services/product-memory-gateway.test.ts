// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  InternalMemoryServiceError,
  type InternalMemoryServiceClient,
} from '@/lib/server/internal-memory-service-client'
import {
  ProductMemoryGateway,
  ProductMemoryGatewayError,
} from '@/lib/services/product-memory-gateway'

function createClientMock() {
  return {
    addMemory: vi.fn(),
    listMemories: vi.fn(),
    searchMemories: vi.fn(),
    updateMemory: vi.fn(),
    getMemory: vi.fn(),
    deleteMemory: vi.fn(),
    getMemoryStats: vi.fn(),
  } satisfies Partial<InternalMemoryServiceClient>
}

describe('ProductMemoryGateway', () => {
  const scope = {
    userId: 'vivi',
    orgId: 'pixelated',
    projectId: 'memory',
    includeShared: true,
  }

  let client: ReturnType<typeof createClientMock>
  let gateway: ProductMemoryGateway

  beforeEach(() => {
    client = createClientMock()
    gateway = new ProductMemoryGateway(client as unknown as InternalMemoryServiceClient)
  })

  it('creates a memory and preserves metadata on the product boundary', async () => {
    client.addMemory.mockResolvedValue({ memory_id: 'mem-1' })

    await expect(
      gateway.createMemory({
        ...scope,
        content: 'Vivi prefers direct summaries',
        metadata: { category: 'preference', source: 'product' },
      }),
    ).resolves.toEqual({
      id: 'mem-1',
      content: 'Vivi prefers direct summaries',
      metadata: { category: 'preference', source: 'product' },
    })

    expect(client.addMemory).toHaveBeenCalledWith({
      ...scope,
      content: 'Vivi prefers direct summaries',
      category: 'preference',
      metadata: { category: 'preference', source: 'product' },
    })
  })

  it('maps shared-service records into product records', async () => {
    client.listMemories.mockResolvedValue({
      count: 1,
      memories: [
        {
          id: 'mem-2',
          memory: 'Shared-service content',
          metadata: { visibility: 'private' },
          created_at: '2026-04-06T00:00:00.000Z',
          updatedAt: '2026-04-06T01:00:00.000Z',
        },
      ],
    })

    await expect(
      gateway.listMemories({
        ...scope,
        limit: 25,
        offset: 5,
      }),
    ).resolves.toEqual({
      total: 1,
      memories: [
        {
          id: 'mem-2',
          content: 'Shared-service content',
          metadata: { visibility: 'private' },
          createdAt: '2026-04-06T00:00:00.000Z',
          updatedAt: '2026-04-06T01:00:00.000Z',
        },
      ],
    })
  })

  it('checks ownership before updating a memory', async () => {
    client.getMemory.mockResolvedValue({
      id: 'mem-3',
      content: 'existing',
      metadata: {},
    })
    client.updateMemory.mockResolvedValue(undefined)

    await gateway.updateMemory({
      ...scope,
      memoryId: 'mem-3',
      content: 'updated',
      metadata: { source: 'product' },
    })

    expect(client.getMemory).toHaveBeenCalledWith({
      ...scope,
      memoryId: 'mem-3',
    })
    expect(client.updateMemory).toHaveBeenCalledWith({
      ...scope,
      memoryId: 'mem-3',
      content: 'updated',
      metadata: { source: 'product' },
    })
  })

  it('surfaces a 404 when updating a memory outside the caller scope', async () => {
    client.getMemory.mockResolvedValue(null)

    await expect(
      gateway.updateMemory({
        ...scope,
        memoryId: 'missing',
        content: 'updated',
      }),
    ).rejects.toMatchObject({
      name: 'ProductMemoryGatewayError',
      status: 404,
      message: 'Memory not found',
    } satisfies Partial<ProductMemoryGatewayError>)
  })

  it('wraps shared-service failures in a ProductMemoryGatewayError', async () => {
    client.searchMemories.mockRejectedValue(
      new InternalMemoryServiceError('upstream failed', 502, {
        error: 'bad gateway',
      }),
    )

    await expect(
      gateway.searchMemories({
        ...scope,
        query: 'hello',
        limit: 10,
      }),
    ).rejects.toMatchObject({
      name: 'ProductMemoryGatewayError',
      status: 502,
      message: 'upstream failed',
      details: { error: 'bad gateway' },
    } satisfies Partial<ProductMemoryGatewayError>)
  })
})
