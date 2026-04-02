import {
  InternalMemoryServiceClient,
  InternalMemoryServiceError,
  type InternalMemoryMetadata,
  type InternalMemoryRecord,
} from '@/lib/server/internal-memory-service-client'
import { assertOwnedMemoryAccessible } from '@/lib/services/product-memory-ownership'
import { resolveInternalMemoryServiceConfig } from '@/lib/server/internal-memory-service-auth'

export interface ProductMemoryRecord {
  id: string
  content: string
  metadata: Record<string, unknown>
  createdAt?: string
  updatedAt?: string
}

export interface ProductMemoryScope {
  userId: string
  orgId?: string
  projectId?: string
  sessionId?: string
  agentId?: string
  runId?: string
  includeShared?: boolean
}

export interface ProductMemoryListOptions extends ProductMemoryScope {
  limit?: number
  offset?: number
  category?: string
  tags?: string[]
}

export interface ProductMemorySearchOptions extends ProductMemoryListOptions {
  query: string
}

export interface ProductMemoryCreateInput extends ProductMemoryScope {
  content: string
  metadata?: Record<string, unknown>
}

export interface ProductMemoryUpdateInput extends ProductMemoryScope {
  memoryId: string
  content: string
  metadata?: Record<string, unknown>
}

export interface ProductMemoryDeleteInput extends ProductMemoryScope {
  memoryId: string
}

export interface ProductMemoryGetInput extends ProductMemoryScope {
  memoryId: string
}

export interface ProductMemoryStats {
  totalMemories: number
  categoryCounts: Record<string, number>
}

export class ProductMemoryGatewayError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ProductMemoryGatewayError'
  }
}

export class ProductMemoryGateway {
  constructor(private readonly client: InternalMemoryServiceClient) {}

  async createMemory(
    input: ProductMemoryCreateInput,
  ): Promise<ProductMemoryRecord> {
    const metadata = normalizeMetadata(input.metadata)
    const response = await this.withGatewayError(() =>
      this.client.addMemory({
        userId: input.userId,
        orgId: input.orgId,
        projectId: input.projectId,
        sessionId: input.sessionId,
        agentId: input.agentId,
        runId: input.runId,
        includeShared: input.includeShared,
        content: input.content,
        category: typeof metadata.category === 'string' ? metadata.category : undefined,
        metadata,
      }),
    )

    return {
      id: response.memory_id,
      content: input.content,
      metadata,
    }
  }

  async listMemories(
    options: ProductMemoryListOptions,
  ): Promise<{ memories: ProductMemoryRecord[]; total: number }> {
    const pagination = normalizePagination(options)

    const response = await this.withGatewayError(() =>
      this.client.listMemories({
        ...toInternalScope(options),
        limit: pagination.limit,
        offset: pagination.offset,
        category: options.category,
        tags: options.tags,
      }),
    )

    const memories = response.memories.map(mapProductMemoryRecord)
    return {
      memories,
      total: response.count,
    }
  }

  async searchMemories(
    options: ProductMemorySearchOptions,
  ): Promise<{ memories: ProductMemoryRecord[]; total: number }> {
    const pagination = normalizePagination(options)

    const response = await this.withGatewayError(() =>
      this.client.searchMemories({
        ...toInternalScope(options),
        query: options.query,
        limit: pagination.limit,
      }),
    )

    const memories = response.memories.map(mapProductMemoryRecord)
    return {
      memories,
      total: response.count,
    }
  }

  async updateMemory(input: ProductMemoryUpdateInput): Promise<ProductMemoryRecord> {
    const metadata = normalizeMetadata(input.metadata)
    await assertOwnedMemoryAccessible(this.client, input)
    await this.withGatewayError(() =>
      this.client.updateMemory({
        memoryId: input.memoryId,
        ...toInternalScope(input),
        content: input.content,
        metadata,
      }),
    )

    return {
      id: input.memoryId,
      content: input.content,
      metadata,
    }
  }

  async getMemory(input: ProductMemoryGetInput): Promise<ProductMemoryRecord | null> {
    const memory = await this.withGatewayError(() =>
      this.client.getMemory({
        memoryId: input.memoryId,
        ...toInternalScope(input),
      }),
    )

    return memory ? mapProductMemoryRecord(memory) : null
  }

  async deleteMemory(input: ProductMemoryDeleteInput): Promise<void> {
    await assertOwnedMemoryAccessible(this.client, input)
    await this.withGatewayError(() =>
      this.client.deleteMemory({
        memoryId: input.memoryId,
        ...toInternalScope(input),
      }),
    )
  }

  async getMemoryStats(scope: ProductMemoryListOptions): Promise<ProductMemoryStats> {
    return this.withGatewayError(() => this.client.getMemoryStats(toInternalScope(scope)))
  }

  private async withGatewayError<T>(callback: () => Promise<T>): Promise<T> {
    try {
      return await callback()
    } catch (error) {
      if (error instanceof InternalMemoryServiceError) {
        throw new ProductMemoryGatewayError(
          error.message,
          error.status,
          error.details,
        )
      }
      throw error
    }
  }

}

function normalizeMetadata(
  metadata?: Record<string, unknown>,
): InternalMemoryMetadata {
  return (metadata ?? {}) as InternalMemoryMetadata
}

function mapProductMemoryRecord(memory: InternalMemoryRecord): ProductMemoryRecord {
  return {
    id: memory.id,
    content: memory.content ?? memory.memory ?? '',
    metadata: memory.metadata ?? {},
    createdAt: memory.createdAt ?? memory.created_at,
    updatedAt: memory.updatedAt ?? memory.updated_at,
  }
}

let gatewaySingleton: ProductMemoryGateway | null = null

export function getProductMemoryGateway(): ProductMemoryGateway {
  if (!gatewaySingleton) {
    gatewaySingleton = new ProductMemoryGateway(
      new InternalMemoryServiceClient(resolveInternalMemoryServiceConfig()),
    )
  }
  return gatewaySingleton
}

function toInternalScope(scope: ProductMemoryScope) {
  return {
    userId: scope.userId,
    orgId: scope.orgId,
    projectId: scope.projectId,
    sessionId: scope.sessionId,
    agentId: scope.agentId,
    runId: scope.runId,
    includeShared: scope.includeShared,
  }
}

function normalizePagination(options: ProductMemoryListOptions) {
  const offset = options.offset ?? 0
  const limit = options.limit ?? 10
  return {
    offset,
    limit,
  }
}
