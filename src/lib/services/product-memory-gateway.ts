import { resolveInternalMemoryServiceConfig } from '@/lib/server/internal-memory-service-auth'
import {
  InternalMemoryServiceClient,
  InternalMemoryServiceError,
  type InternalMemoryMetadata,
  type InternalMemoryRecord,
  type InternalMemoryScopeInput,
} from '@/lib/server/internal-memory-service-client'
import { assertOwnedMemoryAccessible } from '@/lib/services/product-memory-ownership'

export interface ProductMemoryRecord {
  id: string
  content: string
  metadata: Record<string, unknown>
  createdAt?: string
  updatedAt?: string
}

export interface ProductMemoryScope {
  userId: string
  accountId?: string
  workspaceId?: string
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

type InternalMemoryServiceClientLike = Pick<
  InternalMemoryServiceClient,
  | 'addMemory'
  | 'listMemories'
  | 'searchMemories'
  | 'updateMemory'
  | 'getMemory'
  | 'deleteMemory'
  | 'getMemoryStats'
>

export class ProductMemoryGateway {
  constructor(private readonly client: InternalMemoryServiceClientLike) {}

  async createMemory(
    input: ProductMemoryCreateInput,
  ): Promise<ProductMemoryRecord> {
    const metadata = normalizeMetadata(input.metadata)
    const response = await this.withGatewayError(async () =>
      this.client.addMemory({
        ...toInternalScope(input),
        content: input.content,
        category:
          typeof metadata.category === 'string' ? metadata.category : undefined,
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

    const response = await this.withGatewayError(async () =>
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

    const response = await this.withGatewayError(async () =>
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

  async updateMemory(
    input: ProductMemoryUpdateInput,
  ): Promise<ProductMemoryRecord> {
    const metadata = normalizeMetadata(input.metadata)
    await assertOwnedMemoryAccessible(this.client, input)
    await this.withGatewayError(async () =>
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

  async getMemory(
    input: ProductMemoryGetInput,
  ): Promise<ProductMemoryRecord | null> {
    const memory = await this.withGatewayError(async () =>
      this.client.getMemory({
        memoryId: input.memoryId,
        ...toInternalScope(input),
      }),
    )

    return memory ? mapProductMemoryRecord(memory) : null
  }

  async deleteMemory(input: ProductMemoryDeleteInput): Promise<void> {
    await assertOwnedMemoryAccessible(this.client, input)
    await this.withGatewayError(async () =>
      this.client.deleteMemory({
        memoryId: input.memoryId,
        ...toInternalScope(input),
      }),
    )
  }

  async getMemoryStats(
    scope: ProductMemoryListOptions,
  ): Promise<ProductMemoryStats> {
    return this.withGatewayError(async () =>
      this.client.getMemoryStats(toInternalScope(scope)),
    )
  }

  private async withGatewayError<T>(callback: () => Promise<T>): Promise<T> {
    try {
      return await callback()
    } catch (error: unknown) {
      if (error instanceof InternalMemoryServiceError) {
        throw new ProductMemoryGatewayError(
          error instanceof Error ? error.message : 'Unknown error',
          error.status,
          error.details,
        )
      }
      throw error
    }
  }
}

type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

function normalizeMetadata(
  metadata?: Record<string, unknown>,
): InternalMemoryMetadata {
  const result: InternalMemoryMetadata = {}
  for (const [key, value] of Object.entries(metadata ?? {})) {
    const normalized = toJsonValue(value)
    if (normalized !== undefined) {
      result[key] = normalized
    }
  }
  return result
}

function toJsonValue(value: unknown): JsonValue | undefined {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null
  ) {
    return value
  }

  if (Array.isArray(value)) {
    const mapped = value
      .map((entry) => toJsonValue(entry))
      .filter((entry): entry is JsonValue => entry !== undefined)
    return mapped
  }

  if (typeof value === 'object') {
    const output: { [key: string]: JsonValue } = {}
    for (const [entryKey, entryValue] of Object.entries(value)) {
      const normalized = toJsonValue(entryValue)
      if (normalized !== undefined) {
        output[entryKey] = normalized
      }
    }
    return output
  }

  return undefined
}

function mapProductMemoryRecord(
  memory: InternalMemoryRecord,
): ProductMemoryRecord {
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
  gatewaySingleton ??= new ProductMemoryGateway(
    new InternalMemoryServiceClient(resolveInternalMemoryServiceConfig()),
  )
  return gatewaySingleton
}

/**
 * Projects the public ProductMemoryScope into InternalMemoryScopeInput.
 * Destructures out non-scope keys so that callers can pass extended inputs
 * (e.g. ProductMemoryUpdateInput which carries memoryId/content/metadata)
 * without leaking those fields into the scope object sent to the internal service.
 */
export function toInternalScope(
  input: ProductMemoryScope,
): InternalMemoryScopeInput {
  const {
    userId,
    accountId,
    workspaceId,
    orgId,
    projectId,
    sessionId,
    agentId,
    runId,
    includeShared,
  } = input
  return {
    userId,
    accountId,
    workspaceId,
    orgId,
    projectId,
    sessionId,
    agentId,
    runId,
    includeShared,
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
