import {
  MemoryServiceRequestSigner,
  type InternalMemoryServiceClientConfig,
} from '@/lib/server/internal-memory-service-auth'
import {
  buildScopePayload,
  buildScopeQuery,
} from '@/lib/server/internal-memory-scope'

type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export interface InternalMemoryMetadata {
  [key: string]: JsonValue | undefined
}

export interface InternalMemoryRecord {
  id: string
  content?: string
  memory?: string
  metadata?: InternalMemoryMetadata
  created_at?: string
  updated_at?: string
  createdAt?: string
  updatedAt?: string
}

export interface InternalMemoryScopeInput {
  userId: string
  orgId?: string
  projectId?: string
  sessionId?: string
  agentId?: string
  runId?: string
  includeShared?: boolean
}

export class InternalMemoryServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'InternalMemoryServiceError'
  }
}

interface SearchInput extends InternalMemoryScopeInput {
  query: string
  limit: number
}

interface ListInput extends InternalMemoryScopeInput {
  limit: number
  offset?: number
  category?: string
  tags?: string[]
}

interface CreateInput extends InternalMemoryScopeInput {
  content: string
  category?: string
  metadata?: InternalMemoryMetadata
}

interface UpdateInput extends InternalMemoryScopeInput {
  memoryId: string
  content: string
  metadata?: InternalMemoryMetadata
}

interface DeleteInput extends InternalMemoryScopeInput {
  memoryId: string
}

interface GetInput extends InternalMemoryScopeInput {
  memoryId: string
}

export class InternalMemoryServiceClient {
  private readonly signer: MemoryServiceRequestSigner

  constructor(private readonly config: InternalMemoryServiceClientConfig) {
    this.signer = new MemoryServiceRequestSigner(
      config.actorId,
      config.actorSecret,
    )
  }

  async addMemory(input: CreateInput): Promise<{ memory_id: string }> {
    return this.requestJson<{ memory_id: string }>({
      method: 'POST',
      path: '/api/memory/add',
      userId: input.userId,
      expectedStatus: 200,
      jsonBody: {
        content: input.content,
        user_id: input.userId,
        ...buildScopePayload(input),
        category: input.category,
        metadata: input.metadata,
      },
    })
  }

  async searchMemories(
    input: SearchInput,
  ): Promise<{ memories: InternalMemoryRecord[]; count: number }> {
    return this.requestJson<{ memories: InternalMemoryRecord[]; count: number }>({
      method: 'POST',
      path: '/api/memory/search',
      userId: input.userId,
      expectedStatus: 200,
      jsonBody: {
        query: input.query,
        user_id: input.userId,
        org_id: input.orgId,
        project_id: input.projectId,
        session_id: input.sessionId,
        agent_id: input.agentId,
        run_id: input.runId,
        include_shared: input.includeShared ?? true,
        limit: input.limit,
      },
    })
  }

  async listMemories(
    input: ListInput,
  ): Promise<{ memories: InternalMemoryRecord[]; count: number }> {
    const params = buildScopeQuery(input)
    params.set('limit', String(input.limit))
    params.set('offset', String(input.offset ?? 0))
    if (input.category) {
      params.set('category', input.category)
    }
    for (const tag of input.tags ?? []) {
      params.append('tag', tag)
    }

    return this.requestJson<{ memories: InternalMemoryRecord[]; count: number }>({
      method: 'GET',
      path: `/api/memory/all/${encodeURIComponent(input.userId)}`,
      userId: input.userId,
      expectedStatus: 200,
      query: params,
    })
  }

  async getMemoryStats(
    input: InternalMemoryScopeInput,
  ): Promise<{ totalMemories: number; categoryCounts: Record<string, number> }> {
    const params = buildScopeQuery(input)
    return this.requestJson<{ totalMemories: number; categoryCounts: Record<string, number> }>({
      method: 'GET',
      path: `/api/memory/stats/${encodeURIComponent(input.userId)}`,
      userId: input.userId,
      expectedStatus: 200,
      query: params,
    })
  }

  async getMemory(
    input: GetInput,
  ): Promise<InternalMemoryRecord | null> {
    const params = buildScopeQuery(input)
    try {
      return await this.requestJson<InternalMemoryRecord>({
        method: 'GET',
        path: `/api/memory/${encodeURIComponent(input.memoryId)}`,
        userId: input.userId,
        expectedStatus: 200,
        query: params,
      })
    } catch (error) {
      if (
        error instanceof InternalMemoryServiceError &&
        error.status === 404
      ) {
        return null
      }
      throw error
    }
  }

  async updateMemory(input: UpdateInput): Promise<void> {
    await this.requestJson({
      method: 'PATCH',
      path: `/api/memory/${encodeURIComponent(input.memoryId)}`,
      userId: input.userId,
      expectedStatus: 200,
      jsonBody: {
        content: input.content,
        user_id: input.userId,
        ...buildScopePayload(input),
        metadata: input.metadata,
      },
    })
  }

  async deleteMemory(input: DeleteInput): Promise<void> {
    const params = buildScopeQuery(input)

    await this.requestJson({
      method: 'DELETE',
      path: `/api/memory/${encodeURIComponent(input.memoryId)}`,
      userId: input.userId,
      expectedStatus: 200,
      query: params,
    })
  }

  private async requestJson<T = unknown>({
    method,
    path,
    userId,
    expectedStatus,
    jsonBody,
    query,
  }: {
    method: string
    path: string
    userId: string
    expectedStatus: number
    jsonBody?: Record<string, unknown>
    query?: URLSearchParams
  }): Promise<T> {
    const prepared = this.prepareRequest(path, jsonBody, query)
    const response = await fetch(prepared.url, {
      method,
      headers: this.signedHeaders({
        method,
        target: prepared.target,
        userId,
        body: prepared.body,
      }),
      body: prepared.body || undefined,
      signal: createTimeoutSignal(this.config.timeoutMs ?? 5000),
    })

    return this.parseResponse<T>(response, {
      expectedStatus,
      method,
      requestPath: prepared.requestPath,
    })
  }

  private prepareRequest(
    path: string,
    jsonBody?: Record<string, unknown>,
    query?: URLSearchParams,
  ) {
    const requestPath = path.startsWith('/') ? path : `/${path}`
    const target = query?.size ? `${requestPath}?${query.toString()}` : requestPath
    const url = new URL(target, this.config.baseUrl)
    const body = jsonBody
      ? JSON.stringify(jsonBody, undefined, 0)
      : ''
    return { requestPath, target, url, body }
  }

  private async parseResponse<T>(
    response: Response,
    context: {
      expectedStatus: number
      method: string
      requestPath: string
    },
  ): Promise<T> {
    const { expectedStatus, method, requestPath } = context
    if (response.status !== expectedStatus) {
      let details: unknown
      try {
        details = await response.json()
      } catch {
        details = await response.text()
      }

      throw new InternalMemoryServiceError(
        `Shared memory service request failed (${response.status} ${method} ${requestPath})`,
        response.status,
        details,
      )
    }

    if (response.status === 204 || expectedStatus === 204) {
      return undefined as T
    }

    return response.json() as Promise<T>
  }

  private signedHeaders({
    method,
    target,
    userId,
    body,
  }: {
    method: string
    target: string
    userId: string
    body: string
  }): Record<string, string> {
    return this.signer.signedHeaders({ method, target, userId, body })
  }
}

function createTimeoutSignal(timeoutMs: number): AbortSignal {
  const timeoutFactory = (AbortSignal as typeof AbortSignal & {
    timeout?: (milliseconds: number) => AbortSignal
  }).timeout
  if (typeof timeoutFactory === 'function') {
    return timeoutFactory(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}
