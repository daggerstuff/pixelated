/**
 * PIX-510 Task 4: TypeScript Memory API Client
 * Mirrors ai/memory/api.py exactly — 1:1 REST client for FastAPI endpoints.
 *
 * Usage:
 *   const client = new MemoryApiClient({ baseUrl: 'http://localhost:8000' })
 *   const block = await client.create({ tenantId, sessionId, content })
 *   const results = await client.search({ tenantId, minImportance: 0.5 })
 */

import type {
  MemoryBlock,
  MemoryImportance,
  MemoryWriteInput,
} from '@/types/memory'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MemoryApiConfig {
  baseUrl?: string
  fetchFn?: typeof fetch
}

export interface ScoreResponse {
  id: string
  importance: MemoryImportance
  components: Record<string, number>
}

export interface TrajectoryResponse {
  sessionId: string
  memoryCount: number
  trend: 'escalating' | 'de-escalating' | 'stable' | 'volatile'
  crisisIndicators: string[]
  maxIntensity: number
  trajectory: Array<{
    memoryId: string
    valence: number
    arousal: number
    dominance: number
  }>
}

export interface SearchParams {
  tenantId: string
  sessionId?: string
  minImportance?: number
  maxImportance?: number
  emotions?: string[]
  crisisOnly?: boolean
  dateFrom?: number
  dateTo?: number
  consolidationPhases?: string[]
  limit?: number
  offset?: number
}

export interface UpdateParams {
  content?: string
  importance?: number
  consolidationPhase?: 'raw' | 'consolidated' | 'archived' | 'forgotten'
}

export interface HealthStatus {
  status: string
  memoryCount: number
  scorerLatencyMs: number
  classifierLatencyMs: number
}

// ─── Error handling ────────────────────────────────────────────────────────────

export class MemoryApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly body?: unknown,
  ) {
    super(message)
    this.name = 'MemoryApiError'
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let body: unknown
    try { body = await res.json() } catch { body = undefined }
    throw new MemoryApiError(
      `Memory API error ${res.status}: ${res.statusText}`,
      res.status,
      body,
    )
  }
  // oxlint-disable-next-line
  if (res.status === 204) return undefined as unknown as T
  // oxlint-disable-next-line
  return (await res.json()) as T
}

// ─── Client ────────────────────────────────────────────────────────────────────

export class MemoryApiClient {
  private readonly baseUrl: string
  private readonly fetch: typeof fetch

  constructor(config: MemoryApiConfig = {}) {
    this.baseUrl = config.baseUrl ?? 'http://localhost:8000'
    this.fetch = config.fetchFn ?? fetch
  }

  // ── Health ─────────────────────────────────────────────────────────────────

  async health(): Promise<HealthStatus> {
    const res = await this.fetch(`${this.baseUrl}/health`)
    const data = await handleResponse<Record<string, unknown>>(res)
    return {
      status: typeof data['status'] === 'string' ? data['status'] : 'ok',
      memoryCount: Number(data['memory_count'] ?? 0),
      scorerLatencyMs: Number(data['scorer_latency_ms'] ?? 0),
      classifierLatencyMs: Number(data['classifier_latency_ms'] ?? 0),
    }
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async create(input: MemoryWriteInput): Promise<MemoryBlock> {
    const body: Record<string, unknown> = {
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      content: input.content,
    }
    if (input.emotions) {
      body['emotions'] = input.emotions
    }
    if (input.gating) {
      body['gating'] = input.gating
    }
    const res = await this.fetch(`${this.baseUrl}/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return handleResponse<MemoryBlock>(res)
  }

  // ── Search ────────────────────────────────────────────────────────────────

  async search(params: SearchParams): Promise<MemoryBlock[]> {
    const qs = new URLSearchParams()
    qs.set('tenant_id', params.tenantId)
    if (params.sessionId) qs.set('session_id', params.sessionId)
    if (params.minImportance !== undefined) qs.set('min_importance', String(params.minImportance))
    if (params.maxImportance !== undefined) qs.set('max_importance', String(params.maxImportance))
    if (params.emotions?.length) qs.set('emotions', params.emotions.join(','))
    if (params.crisisOnly) qs.set('crisis_only', 'true')
    if (params.dateFrom) qs.set('date_from', String(params.dateFrom))
    if (params.dateTo) qs.set('date_to', String(params.dateTo))
    if (params.consolidationPhases?.length) qs.set('consolidation_phases', params.consolidationPhases.join(','))
    qs.set('limit', String(params.limit ?? 50))
    qs.set('offset', String(params.offset ?? 0))

    const res = await this.fetch(`${this.baseUrl}/memories?${qs}`)
    return handleResponse<MemoryBlock[]>(res)
  }

  // ── Get ───────────────────────────────────────────────────────────────────

  async get(memoryId: string, tenantId: string): Promise<MemoryBlock> {
    const qs = new URLSearchParams({ tenant_id: tenantId })
    const res = await this.fetch(`${this.baseUrl}/memories/${encodeURIComponent(memoryId)}?${qs}`)
    return handleResponse<MemoryBlock>(res)
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async update(memoryId: string, tenantId: string, params: UpdateParams): Promise<MemoryBlock> {
    const qs = new URLSearchParams({ tenant_id: tenantId })
    const body: Record<string, unknown> = {}
    if (params.content !== undefined) body['content'] = params.content
    if (params.importance !== undefined) body['importance'] = params.importance
    if (params.consolidationPhase !== undefined) body['consolidation_phase'] = params.consolidationPhase

    const res = await this.fetch(
      `${this.baseUrl}/memories/${encodeURIComponent(memoryId)}?${qs}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    )
    return handleResponse<MemoryBlock>(res)
  }

  // ── Delete ───────────────────────────────────────────────────────────────

  async delete(memoryId: string, tenantId: string): Promise<void> {
    const qs = new URLSearchParams({ tenant_id: tenantId })
    const res = await this.fetch(
      `${this.baseUrl}/memories/${encodeURIComponent(memoryId)}?${qs}`,
      { method: 'DELETE' },
    )
    if (res.status !== 204) {
      await handleResponse<unknown>(res)
    }
  }

  // ── Score ────────────────────────────────────────────────────────────────

  async score(memoryId: string, tenantId: string, context = ''): Promise<ScoreResponse> {
    const qs = new URLSearchParams({ tenant_id: tenantId })
    if (context) qs.set('context', context)
    const res = await this.fetch(`${this.baseUrl}/memories/score?${qs}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memory_id: memoryId }),
    })
    return handleResponse<ScoreResponse>(res)
  }

  // ── Trajectory ───────────────────────────────────────────────────────────

  async trajectory(sessionId: string, tenantId: string, limit = 50): Promise<TrajectoryResponse> {
    const qs = new URLSearchParams({ tenant_id: tenantId, limit: String(limit) })
    const res = await this.fetch(`${this.baseUrl}/memories/trajectory/${encodeURIComponent(sessionId)}?${qs}`)
    const data = await handleResponse<unknown>(res)
    if (this.isTrajectoryResponse(data)) {
      return data
    }
    throw new Error('Invalid trajectory response')
  }

  private isTrajectoryResponse(data: unknown): data is TrajectoryResponse {
    return (
      typeof data === 'object' &&
      data !== null &&
      'sessionId' in data &&
      'trajectory' in data
    )
  }
}