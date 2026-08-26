/**
 * PIX-3903: TypeScript client for the canonical v1 public memory API.
 *
 * Types are imported from `@/lib/memory/contract` — this file does not
 * declare its own request/response shapes.
 *
 * Usage:
 *   const client = new MemoryApiClient()
 *   const created = await client.create({ content: 'Hello' })
 *   const listed = await client.list({ limit: 10, offset: 0 })
 */

import type { MemoryApiError as MemoryApiErrorBody } from '@/lib/memory/contract/errors'
import type {
  CreateMemoryRequest,
  CreateMemoryResponse,
  DeleteMemoryResponse,
  ListMemoriesQuery,
  ListMemoriesResponse,
  SearchMemoryRequest,
  SearchMemoriesResponse,
  UpdateMemoryRequest,
  UpdateMemoryResponse,
} from '@/lib/memory/contract/v1'

export type {
  CreateMemoryRequest,
  CreateMemoryResponse,
  DeleteMemoryResponse,
  ListMemoriesQuery,
  ListMemoriesResponse,
  PublicMemory,
  SearchMemoryRequest,
  SearchMemoriesResponse,
  UpdateMemoryRequest,
  UpdateMemoryResponse,
} from '@/lib/memory/contract/v1'

export const DEFAULT_MEMORY_API_BASE_URL = '/api/v1/memory' as const
export const DEFAULT_INGESTION_GATE_BASE_URL = '/api/ingestion/gate' as const

export interface MemoryApiClientConfig {
  baseUrl?: string
  fetchFn?: typeof fetch
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>
}

export class MemoryApiClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly body?: MemoryApiErrorBody,
  ) {
    super(message)
    this.name = 'MemoryApiClientError'
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let body: MemoryApiErrorBody | undefined
    try {
      const parsed = (await res.json()) as unknown
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'error' in parsed &&
        'message' in parsed
      ) {
        body = parsed as MemoryApiErrorBody
      }
    } catch {
      body = undefined
    }
    throw new MemoryApiClientError(
      body?.message ?? `Memory API error ${res.status}: ${res.statusText}`,
      res.status,
      body,
    )
  }
  return (await res.json()) as T
}

function appendQuery(
  base: string,
  query: Record<string, string | number | string[] | undefined>,
): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item)
      }
      continue
    }
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

export class MemoryApiClient {
  readonly baseUrl: string
  private readonly fetchFn: typeof fetch
  private readonly getHeaders?: MemoryApiClientConfig['getHeaders']

  constructor(config: MemoryApiClientConfig = {}) {
    this.baseUrl = config.baseUrl ?? DEFAULT_MEMORY_API_BASE_URL
    this.fetchFn = config.fetchFn ?? fetch
    this.getHeaders = config.getHeaders
  }

  private async request(
    path: string,
    init: RequestInit = {},
  ): Promise<Response> {
    const extraHeaders = (await this.getHeaders?.()) ?? {}
    const mergedHeaders = new Headers(init.headers)
    mergedHeaders.set('Content-Type', 'application/json')
    for (const [key, val] of Object.entries(extraHeaders)) {
      mergedHeaders.set(key, val)
    }
    return this.fetchFn(`${this.baseUrl}${path}`, {
      ...init,
      headers: mergedHeaders,
    })
  }

  async create(input: CreateMemoryRequest): Promise<CreateMemoryResponse> {
    const res = await this.request('', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return handleResponse<CreateMemoryResponse>(res)
  }

  async list(
    query: ListMemoriesQuery = { tags: undefined },
  ): Promise<ListMemoriesResponse> {
    const res = await this.request(
      appendQuery('', {
        limit: query.limit,
        offset: query.offset,
        category: query.category,
        tags: query.tags,
      }),
    )
    return handleResponse<ListMemoriesResponse>(res)
  }

  async search(input: SearchMemoryRequest): Promise<SearchMemoriesResponse> {
    const res = await this.request('/search', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return handleResponse<SearchMemoriesResponse>(res)
  }

  async update(
    memoryId: string,
    patch: UpdateMemoryRequest,
  ): Promise<UpdateMemoryResponse> {
    const res = await this.request(`/${encodeURIComponent(memoryId)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    return handleResponse<UpdateMemoryResponse>(res)
  }

  async delete(memoryId: string): Promise<DeleteMemoryResponse> {
    const res = await this.request(`/${encodeURIComponent(memoryId)}`, {
      method: 'DELETE',
    })
    return handleResponse<DeleteMemoryResponse>(res)
  }
}

// ─── Ingestion Gate (PIX-3894) ────────────────────────────────────────────────

export interface IngestRequest {
  content: string
  source_id: string
  user_id?: string
}

export interface IngestResponse {
  accepted: boolean
  report: Record<string, unknown>
  request_id: string
}

export interface IngestionGateClientConfig {
  baseUrl?: string
  fetchFn?: typeof fetch
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>
}

export class IngestionGateClient {
  readonly baseUrl: string
  private readonly fetchFn: typeof fetch
  private readonly getHeaders?: IngestionGateClientConfig['getHeaders']

  constructor(config: IngestionGateClientConfig = {}) {
    this.baseUrl = config.baseUrl ?? DEFAULT_INGESTION_GATE_BASE_URL
    this.fetchFn = config.fetchFn ?? fetch
    this.getHeaders = config.getHeaders
  }

  private async request(
    path: string,
    init: RequestInit = {},
  ): Promise<Response> {
    const extraHeaders = (await this.getHeaders?.()) ?? {}
    const mergedHeaders = new Headers(init.headers)
    mergedHeaders.set('Content-Type', 'application/json')
    for (const [key, val] of Object.entries(extraHeaders)) {
      mergedHeaders.set(key, val)
    }
    return this.fetchFn(`${this.baseUrl}${path}`, {
      ...init,
      headers: mergedHeaders,
    })
  }

  async ingest(input: IngestRequest): Promise<IngestResponse> {
    const res = await this.request('/ingest', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    if (!res.ok) {
      throw new Error(`Ingestion gate error ${res.status}: ${res.statusText}`)
    }
    return (await res.json()) as IngestResponse
  }

  async health(): Promise<Record<string, unknown>> {
    const res = await this.request('/health')
    if (!res.ok) {
      throw new Error(
        `Ingestion gate health error ${res.status}: ${res.statusText}`,
      )
    }
    return (await res.json()) as Record<string, unknown>
  }
}
