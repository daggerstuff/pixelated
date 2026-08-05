/**
 * Pixelated Empathy SDK
 * Official JavaScript/TypeScript SDK for the Pixelated Empathy API
 */

import { z } from 'zod'

import {
  ForesightClient,
  ForesightClientError,
  ForesightClientConfig,
  ForesightMemory,
  StoreMemoryInput,
  StoreMemoryOutput,
  GetMemoryInput,
  QueryMemoriesInput,
  ListMemoriesInput,
  ListMemoriesOutput,
  UpdateMemoryInput,
  DeleteMemoryInput,
  DeleteMemoryOutput,
  MemoryScope,
  RetentionPolicy,
  type UnifiedMemory,
} from './foresight'

export {
  ForesightClient,
  ForesightClientError,
  ForesightClientConfig,
  ForesightMemory,
  StoreMemoryInput,
  StoreMemoryOutput,
  GetMemoryInput,
  QueryMemoriesInput,
  ListMemoriesInput,
  ListMemoriesOutput,
  UpdateMemoryInput,
  DeleteMemoryInput,
  DeleteMemoryOutput,
  MemoryScope,
  RetentionPolicy,
  type UnifiedMemory,
} from './foresight'

export interface PixelatedConfig {
  baseUrl?: string
  apiKey?: string
  jwt?: string
  timeout?: number
  maxRetries?: number
  retryDelay?: number
}

export interface UserProfile {
  id: string
  fullName?: string
  email: string
  role: string
  avatarUrl?: string
  createdAt: string
  lastLogin?: string
}

export const UserProfileSchema: z.ZodType<UserProfile> = z.object({
  id: z.string(),
  fullName: z.string().optional(),
  email: z.string(),
  role: z.string(),
  avatarUrl: z.string().optional(),
  createdAt: z.string(),
  lastLogin: z.string().optional(),
})

export const HealthSchema = z.object({
  status: z.string(),
  timestamp: z.string(),
  version: z.string(),
  uptime: z.number().optional(),
})
export const VersionSchema = z.object({
  version: z.string(),
  build: z.string(),
  commit: z.string().optional(),
})
export const ApiKeyElementSchema = z.object({
  id: z.string(),
  name: z.string(),
  key_prefix: z.string(),
  scopes: z.array(z.string()),
  is_active: z.boolean(),
  created_at: z.string(),
  expires_at: z.string().nullable().optional(),
  last_used_at: z.string().nullable().optional(),
})
export const ApiKeyListSchema = z.object({
  keys: z.array(ApiKeyElementSchema),
})
export const ApiKeyCreateSchema = z.object({
  key: z.string(),
  id: z.string(),
})
export const ApiKeyRevokeSchema = z.object({}).optional()

export interface SearchResult {
  id: string
  title: string
  excerpt: string
  url: string
  type: string
  score: number
}

export const SearchResultSchema: z.ZodType<SearchResult> = z.object({
  id: z.string(),
  title: z.string(),
  excerpt: z.string(),
  url: z.string(),
  type: z.string(),
  score: z.number(),
})

export interface BiasAnalysisParams {
  text: string
  context?: string
  therapistId?: string
  sessionId?: string
  clientId?: string
  demographics?: Record<string, any>
  sessionType?: string
  therapistNotes?: string
}

export interface BiasAnalysisResult {
  id: string
  biases: Array<{
    type: string
    confidence: number
    evidence: string
    suggestion: string
  }>
  overallScore: number
  recommendations: string[]
}

export const BiasAnalysisResultSchema: z.ZodType<BiasAnalysisResult> = z.object(
  {
    id: z.string(),
    biases: z.array(
      z.object({
        type: z.string(),
        confidence: z.number(),
        evidence: z.string(),
        suggestion: z.string(),
      }),
    ),
    overallScore: z.number(),
    recommendations: z.array(z.string()),
  },
)

export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system'
  language?: string
  timezone?: string
  notifications?: {
    email?: boolean
    push?: boolean
  }
}

export const UserPreferencesSchema: z.ZodType<UserPreferences> = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.string().optional(),
  timezone: z.string().optional(),
  notifications: z
    .object({
      email: z.boolean().optional(),
      push: z.boolean().optional(),
    })
    .optional(),
})

export interface MemoryTurn {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  metadata?: Record<string, any>
}

export const MemoryTurnSchema: z.ZodType<MemoryTurn> = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export interface MemorySession {
  id: string
  turns: MemoryTurn[]
  metadata?: Record<string, any>
}

export const MemorySessionSchema: z.ZodType<MemorySession> = z.object({
  id: z.string(),
  turns: z.array(MemoryTurnSchema),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export interface RateLimitError extends Error {
  retryAfter: number
  limit: number
  remaining: number
  resetTime: number
}

export interface ApiError extends Error {
  status: number
  code: string
  details?: any
}

export class PixelatedClient {
  private readonly baseUrl: string
  private readonly apiKey?: string
  private readonly jwt?: string
  private readonly timeout: number
  private readonly maxRetries: number
  private readonly retryDelay: number

  constructor(config: PixelatedConfig = {}) {
    this.baseUrl = config.baseUrl ?? 'https://api.pixelatedempathy.com/api/v1'
    this.apiKey = config.apiKey
    this.jwt = config.jwt
    this.timeout = config.timeout ?? 30000
    this.maxRetries = config.maxRetries ?? 3
    this.retryDelay = config.retryDelay ?? 1000
  }

  /**
   * Internal helper for API requests with retry logic
   */
  private async request<T>(
    endpoint: string,
    schema: z.ZodType<T>,
    options: RequestInit = {},
    retryCount = 0,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey
    } else if (this.jwt) {
      headers['Authorization'] = `Bearer ${this.jwt}`
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // Handle rate limiting with exponential backoff
      if (response.status === 429 && retryCount < this.maxRetries) {
        const retryAfter = response.headers.get('Retry-After')
        const delay = retryAfter
          ? parseInt(retryAfter) * 1000
          : this.retryDelay * Math.pow(2, retryCount)

        await this.sleep(delay)
        return this.request<T>(endpoint, schema, options, retryCount + 1)
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        let errorData: { error?: string; code?: string; details?: unknown } = {}
        try {
          errorData = errorText
            ? (JSON.parse(errorText) as typeof errorData)
            : {}
        } catch {
          /* leave errorData as {} */
        }
        const error: ApiError = {
          name: 'ApiError',
          message: errorData.error ?? 'API Error: ' + response.statusText,
          status: response.status,
          code: errorData.code ?? 'UNKNOWN',
          details: errorData.details,
        }
        throw error
      }

      return await this.parseResponse(response, schema)
    } catch (error) {
      clearTimeout(timeoutId)

      // Retry on network errors
      if (error instanceof Error && retryCount < this.maxRetries) {
        if (
          error.message.includes('abort') ||
          error.message.includes('network')
        ) {
          await this.sleep(this.retryDelay * Math.pow(2, retryCount))
          return this.request<T>(endpoint, schema, options, retryCount + 1)
        }
      }

      throw error
    }
  }

  private async parseResponse<T>(
    response: Response,
    schema: z.ZodType<T>,
  ): Promise<T> {
    const text = await response.text()
    try {
      const parsed: unknown = text ? JSON.parse(text) : {}
      return schema.parse(parsed)
    } catch (err) {
      if (err instanceof z.ZodError) {
        const summary = err.issues
          .map(
            (i) => (i.path.length ? i.path.join('.') + ': ' : '') + i.message,
          )
          .join('; ')
        throw new Error('Response schema mismatch: ' + summary)
      }
      throw err
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Bias Analysis API
   */
  get biasAnalysis() {
    return {
      /**
       * Perform bias analysis on clinical text
       */
      analyze: async (
        params: BiasAnalysisParams,
      ): Promise<BiasAnalysisResult> => {
        return this.request<BiasAnalysisResult>(
          '/bias-analysis/analyze',
          BiasAnalysisResultSchema,
          {
            method: 'POST',
            body: JSON.stringify(params),
          },
        )
      },
    }
  }

  /**
   * User API
   */
  get user() {
    return {
      /**
       * Get the current user profile
       */
      getProfile: async (): Promise<UserProfile> => {
        const response = await this.request<{ profile: UserProfile }>(
          '/profile',
          z.object({ profile: UserProfileSchema }),
        )
        return response.profile
      },

      /**
       * Update the current user profile
       */
      updateProfile: async (
        updates: Partial<UserProfile>,
      ): Promise<UserProfile> => {
        const response = await this.request<{ profile: UserProfile }>(
          '/profile',
          z.object({ profile: UserProfileSchema }),
          {
            method: 'PUT',
            body: JSON.stringify(updates),
          },
        )
        return response.profile
      },

      /**
       * Get user preferences
       */
      getPreferences: async (): Promise<UserPreferences> => {
        const response = await this.request<{ preferences: UserPreferences }>(
          '/preferences',
          z.object({ preferences: UserPreferencesSchema }),
        )
        return response.preferences
      },

      /**
       * Update user preferences
       */
      updatePreferences: async (
        updates: Partial<UserPreferences>,
      ): Promise<UserPreferences> => {
        const response = await this.request<{ preferences: UserPreferences }>(
          '/preferences',
          z.object({ preferences: UserPreferencesSchema }),
          {
            method: 'PUT',
            body: JSON.stringify(updates),
          },
        )
        return response.preferences
      },
    }
  }

  /**
   * Search API
   */
  get search() {
    return {
      /**
       * Search content
       */
      query: async (
        query: string,
        filters?: { type?: string; limit?: number },
      ): Promise<SearchResult[]> => {
        const params = new URLSearchParams({ q: query })
        if (filters?.type) params.append('type', filters.type)
        if (filters?.limit) params.append('limit', filters.limit.toString())

        const response = await this.request<{ results: SearchResult[] }>(
          `/search?${params}`,
          z.object({ results: z.array(SearchResultSchema) }),
        )
        return response.results
      },
    }
  }

  /**
   * Memory/Sessions API
   */
  get memory() {
    return {
      /**
       * Get a session by ID
       */
      getSession: async (sessionId: string): Promise<MemorySession> => {
        const response = await this.request<{ session: MemorySession }>(
          `/memory/sessions/${sessionId}`,
          z.object({ session: MemorySessionSchema }),
        )
        return response.session
      },

      /**
       * Create a new turn in a session
       */
      addTurn: async (
        sessionId: string,
        turn: Omit<MemoryTurn, 'id' | 'timestamp'>,
      ): Promise<MemoryTurn> => {
        const response = await this.request<{ turn: MemoryTurn }>(
          `/memory/sessions/${sessionId}/turns`,
          z.object({ turn: MemoryTurnSchema }),
          {
            method: 'POST',
            body: JSON.stringify(turn),
          },
        )
        return response.turn
      },

      /**
       * List sessions
       */
      listSessions: async (params?: {
        limit?: number
        offset?: number
      }): Promise<MemorySession[]> => {
        const queryParams = new URLSearchParams()
        if (params?.limit) queryParams.append('limit', params.limit.toString())
        if (params?.offset)
          queryParams.append('offset', params.offset.toString())

        const response = await this.request<{ sessions: MemorySession[] }>(
          `/memory/sessions?${queryParams}`,
          z.object({ sessions: z.array(MemorySessionSchema) }),
        )
        return response.sessions
      },
    }
  }

  /**
   * Foresight memory client (typed memory operations via Foresight gateway)
   */
  get foresight(): ForesightClient {
    return this.createMemoryClient('/api/v1/memory')
  }

  /**
   * Developer memory client (external developer API surface)
   *
   * Targets `/api/v1/developer/memory/*` and is intended for use with an
   * API key. The same typed memory operations are exposed as the Foresight
   * client, but routed through the developer-only endpoint.
   */
  get developer(): { memory: ForesightClient } {
    return {
      memory: this.createMemoryClient('/api/v1/developer/memory'),
    }
  }

  private createMemoryClient(basePath: string): ForesightClient {
    return new ForesightClient({
      baseUrl: this.baseUrl.replace('/api/v1', basePath),
      getHeaders: () => {
        const h: Record<string, string> = {}
        if (this.apiKey) h['X-API-Key'] = this.apiKey
        else if (this.jwt) h['Authorization'] = `Bearer ${this.jwt}`
        return h
      },
    })
  }

  /**
   * System API
   */
  get system() {
    return {
      /**
       * Check API health
       */
      getHealth: async (): Promise<{
        status: string
        timestamp: string
        version: string
      }> => {
        return this.request('/health', HealthSchema)
      },

      /**
       * Get API version info
       */
      getVersion: async (): Promise<{ version: string; build: string }> => {
        return this.request('/version', VersionSchema)
      },
    }
  }

  /**
   * API Key management (for developers)
   */
  get apiKeys() {
    return {
      /**
       * List API keys
       */
      list: async (): Promise<
        Array<{
          id: string
          name: string
          key_prefix: string
          scopes: string[]
          is_active: boolean
          created_at: string
          expires_at?: string | null | undefined
          last_used_at?: string | null | undefined
        }>
      > => {
        const response = await this.request<{
          keys: Array<{
            id: string
            name: string
            key_prefix: string
            scopes: string[]
            is_active: boolean
            created_at: string
            expires_at?: string | null | undefined
            last_used_at?: string | null | undefined
          }>
        }>('/developer/api-keys', ApiKeyListSchema)
        return response.keys
      },

      /**
       * Create a new API key
       */
      create: async (
        name: string,
        scopes?: string[],
      ): Promise<{ key: string; id: string }> => {
        const response = await this.request<{ key: string; id: string }>(
          '/developer/api-keys',
          ApiKeyCreateSchema,
          {
            method: 'POST',
            body: JSON.stringify({ name, scopes }),
          },
        )
        return response
      },

      /**
       * Revoke an API key
       */
      revoke: async (keyId: string): Promise<void> => {
        await this.request(`/developer/api-keys/${keyId}`, ApiKeyRevokeSchema, {
          method: 'DELETE',
        })
      },
    }
  }
}

// Default export
export default PixelatedClient
