import {
  buildMemorySkeleton,
  isUnifiedMemory,
  memoryInputDefaults,
  type CreateMemoryInput,
  type UnifiedMemory,
} from '@pixelated/memory-schema'

import type { ConsolidationPipeline } from '../memory/consolidation/consolidation-pipeline'
import {
  InternalMemoryServiceError,
  type InternalMemoryMetadata,
  type InternalMemoryRecord,
  type InternalMemoryScopeInput,
} from '../server/internal-memory-service-client'
import { createMemoryTransport } from '../server/memory-transport-factory'
import { AuditLogger, NoOpAuditLogger } from './product-memory-audit'
import { assertOwnedMemoryAccessible } from './product-memory-ownership'

export type ProductMemoryRecord = UnifiedMemory

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
  scope?: string
  retention?: string
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

type Caller = { userId: string; tenantId?: string }

type InternalMemoryServiceClientLike = {
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

type CallContext = {
  correlationId: string
  operation: string
  userId: string
  startTime: number
}

export class ProductMemoryGateway {
  constructor(
    private readonly client: InternalMemoryServiceClientLike,
    private readonly caller: Caller | null = null,
    private readonly audit: AuditLogger = new NoOpAuditLogger(),
    private readonly consolidationPipeline: ConsolidationPipeline | null = null,
  ) {}

  async createMemory(
    input: ProductMemoryCreateInput,
  ): Promise<ProductMemoryRecord> {
    const ctx = this.beginCall('createMemory', input.userId)
    const metadata = normalizeMetadata(input.metadata)
    const response = await this.runCall(ctx, () =>
      this.client.addMemory({
        ...toInternalScope(input),
        content: input.content,
        category:
          typeof metadata['category'] === 'string'
            ? metadata['category']
            : undefined,
        metadata,
      }),
    )
    const record = buildProductMemoryRecord({
      memoryId: response.memory_id,
      content: input.content,
      userId: input.userId,
      tenantId: this.caller?.tenantId,
      metadata,
    })

    // Best-effort post-store dedup — fires async, never blocks the response.
    // In serverless environments the dedup may not complete; use
    // POST /api/v1/memory/consolidate for guaranteed execution.
    if (this.consolidationPipeline && record.userId) {
      this.scheduleDedup(record.userId)
    }

    return record
  }

  async listMemories(
    options: ProductMemoryListOptions,
  ): Promise<{ memories: ProductMemoryRecord[]; total: number }> {
    const ctx = this.beginCall('listMemories', options.userId)
    const pagination = normalizePagination(options)
    const response = await this.runCall(ctx, () =>
      this.client.listMemories({
        ...toInternalScope(options),
        limit: pagination.limit,
        offset: pagination.offset,
        category: options.category,
        tags: options.tags,
        scope: options.scope,
        retention: options.retention,
      }),
    )
    return {
      memories: response.memories.map((memory) =>
        mapProductMemoryRecord(memory, options.userId),
      ),
      total: response.count,
    }
  }

  async searchMemories(
    options: ProductMemorySearchOptions,
  ): Promise<{ memories: ProductMemoryRecord[]; total: number }> {
    const ctx = this.beginCall('searchMemories', options.userId)
    const pagination = normalizePagination(options)
    const response = await this.runCall(ctx, () =>
      this.client.searchMemories({
        ...toInternalScope(options),
        query: options.query,
        limit: pagination.limit,
        offset: pagination.offset,
        category: options.category,
        tags: options.tags,
        scope: options.scope,
        retention: options.retention,
      }),
    )
    return {
      memories: response.memories.map((memory) =>
        mapProductMemoryRecord(memory, options.userId),
      ),
      total: response.count,
    }
  }

  async updateMemory(
    input: ProductMemoryUpdateInput,
  ): Promise<ProductMemoryRecord> {
    const ctx = this.beginCall('updateMemory', input.userId)
    const metadata = normalizeMetadata(input.metadata)
    await assertOwnedMemoryAccessible(this.client, input)
    await this.runCall(ctx, () =>
      this.client.updateMemory({
        memoryId: input.memoryId,
        ...toInternalScope(input),
        content: input.content,
        metadata,
      }),
    )
    return buildProductMemoryRecord({
      memoryId: input.memoryId,
      content: input.content,
      userId: input.userId,
      tenantId: this.caller?.tenantId,
      metadata,
      updatedAt: new Date().toISOString(),
    })
  }

  async getMemory(
    input: ProductMemoryGetInput,
  ): Promise<ProductMemoryRecord | null> {
    const ctx = this.beginCall('getMemory', input.userId)
    try {
      const memory = await this.runCall(ctx, () =>
        this.client.getMemory({
          memoryId: input.memoryId,
          ...toInternalScope(input),
        }),
      )
      return memory ? mapProductMemoryRecord(memory, input.userId) : null
    } catch (err) {
      if (
        err instanceof ProductMemoryGatewayError &&
        (err.status === 404 || err.message.toLowerCase().includes('not found'))
      ) {
        return null
      }
      throw err
    }
  }

  async deleteMemory(input: ProductMemoryDeleteInput): Promise<void> {
    const ctx = this.beginCall('deleteMemory', input.userId)
    await assertOwnedMemoryAccessible(this.client, input)
    await this.runCall(ctx, () =>
      this.client.deleteMemory({
        memoryId: input.memoryId,
        ...toInternalScope(input),
      }),
    )
  }

  async getMemoryStats(
    scope: ProductMemoryListOptions,
  ): Promise<ProductMemoryStats> {
    const ctx = this.beginCall('getMemoryStats', scope.userId)
    return this.runCall(ctx, () =>
      this.client.getMemoryStats(toInternalScope(scope)),
    )
  }

  private beginCall(operation: string, userId: string): CallContext {
    const correlationId = `${operation}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
    const startTime = Date.now()
    const actorId = this.caller?.userId ?? 'system'

    this.audit.log({
      type: 'auth.success',
      actorId,
      userId,
      operation,
      correlationId,
      timestamp: Date.now(),
    })

    if (this.caller && userId !== this.caller.userId) {
      this.audit.log({
        type: 'scope.rejected',
        actorId: this.caller.userId,
        userId,
        operation,
        correlationId,
        details: { reason: 'User scope mismatch' },
        timestamp: Date.now(),
      })
      throw new ProductMemoryGatewayError(
        'User scope mismatch: cannot act on another user',
        403,
      )
    }

    if (this.caller) {
      this.audit.log({
        type: 'scope.validated',
        actorId: this.caller.userId,
        userId,
        operation,
        correlationId,
        timestamp: Date.now(),
      })
    }

    return { correlationId, operation, userId, startTime }
  }

  private async runCall<T>(
    _ctx: CallContext,
    call: () => Promise<T>,
  ): Promise<T> {
    try {
      return await call()
    } catch (err) {
      if (err instanceof InternalMemoryServiceError) {
        throw new ProductMemoryGatewayError(
          err.message || 'Unknown error',
          err.status,
          err.details,
        )
      }
      throw err
    }
  }

  /**
   * Fire `runDedupOnly()` as a best-effort background task.
   *
   * Uses a 5-second timeout so the promise never lingers. In serverless
   * environments the process may terminate before the dedup completes —
   * that's accepted. Use POST /api/v1/memory/consolidate for guaranteed
   * execution.
   */
  private scheduleDedup(userId: string): void {
    const pipeline = this.consolidationPipeline
    if (!pipeline) return

    const timeoutMs = 5_000
    Promise.race([
      pipeline.runDedupOnly(this, userId),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('dedup timed out')), timeoutMs),
      ),
    ]).catch((err) => {
      this.audit.log({
        type: 'downstream.failure',
        actorId: this.caller?.userId ?? 'system',
        userId,
        operation: 'scheduleDedup',
        correlationId: `dedup-${Date.now()}`,
        details: { error: String(err) },
        timestamp: Date.now(),
      })
    })
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

function metadataCategory(
  metadata: InternalMemoryMetadata,
): string | undefined {
  return typeof metadata['category'] === 'string'
    ? metadata['category']
    : undefined
}

function metadataTags(metadata: InternalMemoryMetadata): string[] | undefined {
  if (!Array.isArray(metadata['tags'])) {
    return undefined
  }
  const tags = metadata['tags'].filter(
    (tag): tag is string => typeof tag === 'string',
  )
  return tags.length > 0 ? tags : undefined
}

function metadataImportance(
  metadata: InternalMemoryMetadata,
): number | undefined {
  return typeof metadata['importance'] === 'number'
    ? metadata['importance']
    : undefined
}

function createMemoryInputFromMetadata(
  base: { content: string; userId: string; tenantId?: string },
  metadata: InternalMemoryMetadata,
): CreateMemoryInput {
  const input: CreateMemoryInput = {
    content: base.content,
    userId: base.userId,
  }
  if (base.tenantId) {
    input.tenantId = base.tenantId
  }
  const category = metadataCategory(metadata)
  if (category) {
    input.category = category
  }
  const tags = metadataTags(metadata)
  if (tags) {
    input.tags = tags
  }
  const importance = metadataImportance(metadata)
  if (importance !== undefined) {
    input.importance = importance
  }
  return input
}

function buildProductMemoryRecord(input: {
  memoryId: string
  content: string
  userId: string
  tenantId?: string
  metadata?: InternalMemoryMetadata
  updatedAt?: string
}): ProductMemoryRecord {
  const metadata = input.metadata ?? {}
  return buildMemorySkeleton(
    memoryInputDefaults(
      createMemoryInputFromMetadata(
        {
          content: input.content,
          userId: input.userId,
          tenantId: input.tenantId,
        },
        metadata,
      ),
    ),
    {
      id: input.memoryId,
      sourceService: 'astro-frontend',
      updatedAt: input.updatedAt ?? null,
    },
  )
}

function legacyInternalRecordToUnifiedMemory(
  memory: InternalMemoryRecord,
  userId: string,
): UnifiedMemory {
  const metadata = memory.metadata ?? {}
  return buildMemorySkeleton(
    memoryInputDefaults(
      createMemoryInputFromMetadata(
        {
          content: memory.content ?? memory.memory ?? '',
          userId,
        },
        metadata,
      ),
    ),
    {
      id: memory.id,
      sourceService: 'foresight',
      createdAt:
        memory.createdAt ?? memory.created_at ?? new Date().toISOString(),
      updatedAt: memory.updatedAt ?? memory.updated_at ?? null,
    },
  )
}

function mapProductMemoryRecord(
  memory: InternalMemoryRecord | UnifiedMemory,
  userId: string,
): ProductMemoryRecord {
  if (isUnifiedMemory(memory)) {
    return memory
  }
  return legacyInternalRecordToUnifiedMemory(memory, userId)
}

let gatewaySingleton: ProductMemoryGateway | null = null

/**
 * Backward-compatible singleton accessor.
 *
 * Production code should prefer getProductMemoryGatewayFor() so the gateway
 * has a caller context for tenant isolation and audit logging.
 */
export function getProductMemoryGateway(): ProductMemoryGateway {
  gatewaySingleton ??= new ProductMemoryGateway(createMemoryTransport())
  return gatewaySingleton
}

/**
 * Build a per-request gateway bound to the authenticated caller.
 *
 * The transport is selected at call time via MEMORY_SERVICE_TRANSPORT so
 * operators can switch from the HTTP self-loopback to the foresight-server
 * transport without code changes.
 */
export function getProductMemoryGatewayFor(
  caller: Caller,
  audit?: AuditLogger,
): ProductMemoryGateway {
  return new ProductMemoryGateway(
    createMemoryTransport(),
    caller,
    audit ?? new NoOpAuditLogger(),
  )
}

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
  return { offset, limit }
}
