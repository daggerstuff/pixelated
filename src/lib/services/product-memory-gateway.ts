import { resolveInternalMemoryServiceConfig } from "../server/internal-memory-service-auth";
import {
  InternalMemoryServiceClient,
  InternalMemoryServiceError,
  type InternalMemoryMetadata,
  type InternalMemoryRecord,
  type InternalMemoryScopeInput,
} from "../server/internal-memory-service-client";
import { createMemoryTransport } from "../server/memory-transport-factory";
import { AuditLogger, NoOpAuditLogger } from "./product-memory-audit";
import { assertOwnedMemoryAccessible } from "./product-memory-ownership";
import type { UnifiedMemory } from "@pixelated/memory-schema";

export interface ProductMemoryRecord {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  // UnifiedMemory fields
  tenantId?: string;
  userId?: string;
  bankId?: string;
  scope?: "session" | "arc" | "trait" | "fact";
  retention?: "ephemeral" | "short_term" | "long_term" | "permanent";
  category?: string;
  tags?: string[];
  version?: number;
  schemaVersion?: string;
  sourceService?: "foresight" | "ai-services" | "astro-frontend" | "unknown";
  importance?: number;
  decayRate?: number;
  strengthTrend?: "stable" | "strengthening" | "weakening" | "stale";
  activationCount?: number;
  retrievalCount?: number;
  isGhost?: boolean;
  gist?: string | null;
  synthesizedFrom?: string[];
  vectorId?: string | null;
  emotionalContext?: {
    valence: number;
    arousal: number;
    dominance: number;
    primaryEmotion: string;
    intensity: number;
  } | null;
  empathyMetrics?: {
    reciprocity: number;
    validationAccuracy: number;
    resistanceLevel: number;
  } | null;
  accessedAt?: string | null;
  lastRetrievedAt?: string | null;
}

export interface ProductMemoryScope {
  userId: string;
  accountId?: string;
  workspaceId?: string;
  orgId?: string;
  projectId?: string;
  sessionId?: string;
  agentId?: string;
  runId?: string;
  includeShared?: boolean;
}

export interface ProductMemoryListOptions extends ProductMemoryScope {
  limit?: number;
  offset?: number;
  category?: string;
  tags?: string[];
}

export interface ProductMemorySearchOptions extends ProductMemoryListOptions {
  query: string;
}

export interface ProductMemoryCreateInput extends ProductMemoryScope {
  content: string;
  metadata?: Record<string, unknown>;
}

export interface ProductMemoryUpdateInput extends ProductMemoryScope {
  memoryId: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface ProductMemoryDeleteInput extends ProductMemoryScope {
  memoryId: string;
}

export interface ProductMemoryGetInput extends ProductMemoryScope {
  memoryId: string;
}

export interface ProductMemoryStats {
  totalMemories: number;
  categoryCounts: Record<string, number>;
}

export class ProductMemoryGatewayError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ProductMemoryGatewayError";
  }
}

type Caller = { userId: string; tenantId?: string };

type InternalMemoryServiceClientLike = {
  addMemory: (input: any) => Promise<{ memory_id: string }>;
  listMemories: (input: any) => Promise<{ memories: UnifiedMemory[]; count: number }>;
  searchMemories: (input: any) => Promise<{ memories: UnifiedMemory[]; count: number }>;
  updateMemory: (input: any) => Promise<void>;
  getMemory: (input: any) => Promise<UnifiedMemory | null>;
  deleteMemory: (input: any) => Promise<void>;
  getMemoryStats: (input: any) => Promise<{
    totalMemories: number;
    categoryCounts: Record<string, number>;
  }>;
};

type CallContext = {
  correlationId: string;
  operation: string;
  userId: string;
  startTime: number;
};

export class ProductMemoryGateway {
  constructor(
    private readonly client: InternalMemoryServiceClientLike,
    private readonly caller: Caller | null = null,
    private readonly audit: AuditLogger = new NoOpAuditLogger(),
  ) {}

  async createMemory(input: ProductMemoryCreateInput): Promise<ProductMemoryRecord> {
    const ctx = this.beginCall("createMemory", input.userId);
    const metadata = normalizeMetadata(input.metadata);
    const response = await this.runCall(ctx, () =>
      this.client.addMemory({
        ...toInternalScope(input),
        content: input.content,
        category: typeof metadata["category"] === "string" ? metadata["category"] : undefined,
        metadata,
      }),
    );
    return {
      id: response.memory_id,
      content: input.content,
      metadata,
    };
  }

  async listMemories(
    options: ProductMemoryListOptions,
  ): Promise<{ memories: ProductMemoryRecord[]; total: number }> {
    const ctx = this.beginCall("listMemories", options.userId);
    const pagination = normalizePagination(options);
    const response = await this.runCall(ctx, () =>
      this.client.listMemories({
        ...toInternalScope(options),
        limit: pagination.limit,
        offset: pagination.offset,
        category: options.category,
        tags: options.tags,
      }),
    );
    return {
      memories: response.memories.map(mapProductMemoryRecord),
      total: response.count,
    };
  }

  async searchMemories(
    options: ProductMemorySearchOptions,
  ): Promise<{ memories: ProductMemoryRecord[]; total: number }> {
    const ctx = this.beginCall("searchMemories", options.userId);
    const pagination = normalizePagination(options);
    const response = await this.runCall(ctx, () =>
      this.client.searchMemories({
        ...toInternalScope(options),
        query: options.query,
        limit: pagination.limit,
      }),
    );
    return {
      memories: response.memories.map(mapProductMemoryRecord),
      total: response.count,
    };
  }

  async updateMemory(input: ProductMemoryUpdateInput): Promise<ProductMemoryRecord> {
    const ctx = this.beginCall("updateMemory", input.userId);
    const metadata = normalizeMetadata(input.metadata);
    await assertOwnedMemoryAccessible(this.client, input);
    await this.runCall(ctx, () =>
      this.client.updateMemory({
        memoryId: input.memoryId,
        ...toInternalScope(input),
        content: input.content,
        metadata,
      }),
    );
    return {
      id: input.memoryId,
      content: input.content,
      metadata,
    };
  }

  async getMemory(input: ProductMemoryGetInput): Promise<ProductMemoryRecord | null> {
    const ctx = this.beginCall("getMemory", input.userId);
    try {
      const memory = await this.runCall(ctx, () =>
        this.client.getMemory({
          memoryId: input.memoryId,
          ...toInternalScope(input),
        }),
      );
      return memory ? mapProductMemoryRecord(memory) : null;
    } catch (err) {
      if (
        err instanceof ProductMemoryGatewayError &&
        (err.status === 404 || err.message.toLowerCase().includes("not found"))
      ) {
        return null;
      }
      throw err;
    }
  }

  async deleteMemory(input: ProductMemoryDeleteInput): Promise<void> {
    const ctx = this.beginCall("deleteMemory", input.userId);
    await assertOwnedMemoryAccessible(this.client, input);
    await this.runCall(ctx, () =>
      this.client.deleteMemory({
        memoryId: input.memoryId,
        ...toInternalScope(input),
      }),
    );
  }

  async getMemoryStats(scope: ProductMemoryListOptions): Promise<ProductMemoryStats> {
    const ctx = this.beginCall("getMemoryStats", scope.userId);
    return this.runCall(ctx, () => this.client.getMemoryStats(toInternalScope(scope)));
  }

  private beginCall(operation: string, userId: string): CallContext {
    const correlationId = `${operation}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const startTime = Date.now();
    const actorId = this.caller?.userId ?? "system";

    this.audit.log({
      type: "auth.success",
      actorId,
      userId,
      operation,
      correlationId,
      timestamp: Date.now(),
    });

    if (this.caller && userId !== this.caller.userId) {
      this.audit.log({
        type: "scope.rejected",
        actorId: this.caller.userId,
        userId,
        operation,
        correlationId,
        details: { reason: "User scope mismatch" },
        timestamp: Date.now(),
      });
      throw new ProductMemoryGatewayError("User scope mismatch: cannot act on another user", 403);
    }

    if (this.caller) {
      this.audit.log({
        type: "scope.validated",
        actorId: this.caller.userId,
        userId,
        operation,
        correlationId,
        timestamp: Date.now(),
      });
    }

    return { correlationId, operation, userId, startTime };
  }

  private async runCall<T>(ctx: CallContext, call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (err) {
      if (err instanceof InternalMemoryServiceError) {
        throw new ProductMemoryGatewayError(
          err.message || "Unknown error",
          err.status,
          err.details,
        );
      }
      throw err;
    }
  }
}

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

function normalizeMetadata(metadata?: Record<string, unknown>): InternalMemoryMetadata {
  const result: InternalMemoryMetadata = {};
  for (const [key, value] of Object.entries(metadata ?? {})) {
    const normalized = toJsonValue(value);
    if (normalized !== undefined) {
      result[key] = normalized;
    }
  }
  return result;
}

function toJsonValue(value: unknown): JsonValue | undefined {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    const mapped = value
      .map((entry) => toJsonValue(entry))
      .filter((entry): entry is JsonValue => entry !== undefined);
    return mapped;
  }

  if (typeof value === "object") {
    const output: { [key: string]: JsonValue } = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
      const normalized = toJsonValue(entryValue);
      if (normalized !== undefined) {
        output[entryKey] = normalized;
      }
    }
    return output;
  }

  return undefined;
}

function mapProductMemoryRecord(memory: InternalMemoryRecord | UnifiedMemory): ProductMemoryRecord {
  // Type guard to check if it's a UnifiedMemory
  const isUnifiedMemory = (m: InternalMemoryRecord | UnifiedMemory): m is UnifiedMemory => {
    return "tenantId" in m || "sourceService" in m || "strengthTrend" in m;
  };

  if (isUnifiedMemory(memory)) {
    return {
      id: memory.id,
      content: memory.content ?? (memory as any).memory ?? "",
      metadata: (memory as any).metadata ?? {},
      createdAt: (memory as any).createdAt ?? (memory as any).created_at,
      updatedAt: (memory as any).updatedAt ?? (memory as any).updated_at,
      // UnifiedMemory fields
      tenantId: memory.tenantId,
      userId: memory.userId,
      bankId: memory.bankId,
      scope: memory.scope,
      retention: memory.retention,
      category: memory.category,
      tags: memory.tags,
      version: memory.version,
      schemaVersion: memory.schemaVersion,
      sourceService: memory.sourceService,
      importance: memory.importance,
      decayRate: memory.decayRate,
      strengthTrend: memory.strengthTrend,
      activationCount: memory.activationCount,
      retrievalCount: memory.retrievalCount,
      isGhost: memory.isGhost,
      gist: memory.gist,
      synthesizedFrom: memory.synthesizedFrom,
      vectorId: memory.vectorId,
      emotionalContext: memory.emotionalContext,
      empathyMetrics: memory.empathyMetrics,
      accessedAt: memory.accessedAt,
      lastRetrievedAt: memory.lastRetrievedAt,
    };
  }
  // Legacy InternalMemoryRecord
  return {
    id: memory.id,
    content: memory.content ?? memory.memory ?? "",
    metadata: memory.metadata ?? {},
    createdAt: memory.createdAt ?? memory.created_at,
    updatedAt: memory.updatedAt ?? memory.updated_at,
  };
}

let gatewaySingleton: ProductMemoryGateway | null = null;

/**
 * Backward-compatible singleton accessor.
 *
 * Production code should prefer getProductMemoryGatewayFor() so the gateway
 * has a caller context for tenant isolation and audit logging.
 */
export function getProductMemoryGateway(): ProductMemoryGateway {
  gatewaySingleton ??= new ProductMemoryGateway(createMemoryTransport());
  return gatewaySingleton;
}

/**
 * Build a per-request gateway bound to the authenticated caller.
 *
 * The transport is selected at call time via MEMORY_SERVICE_TRANSPORT so
 * operators can switch from the HTTP self-loopback to the foresight-mcp
 * transport without code changes.
 */
export function getProductMemoryGatewayFor(
  caller: Caller,
  audit?: AuditLogger,
): ProductMemoryGateway {
  return new ProductMemoryGateway(createMemoryTransport(), caller, audit ?? new NoOpAuditLogger());
}

export function toInternalScope(input: ProductMemoryScope): InternalMemoryScopeInput {
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
  } = input;
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
  };
}

function normalizePagination(options: ProductMemoryListOptions) {
  const offset = options.offset ?? 0;
  const limit = options.limit ?? 10;
  return { offset, limit };
}
