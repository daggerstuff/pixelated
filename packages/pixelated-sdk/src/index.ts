/**
 * Pixelated Empathy SDK
 * Official JavaScript/TypeScript SDK for the Pixelated Empathy API
 */

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

export interface SearchResult {
  id: string
  title: string
  excerpt: string
  url: string
  type: string
  score: number
}

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

export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system'
  language?: string
  timezone?: string
  notifications?: {
    email?: boolean
    push?: boolean
  }
}

export interface MemoryTurn {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  metadata?: Record<string, any>
}

export interface MemorySession {
  id: string
  turns: MemoryTurn[]
  metadata?: Record<string, any>
}

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
    this.baseUrl = config.baseUrl || 'https://api.pixelatedempathy.com/api/v1'
    this.apiKey = config.apiKey
    this.jwt = config.jwt
    this.timeout = config.timeout || 30000
    this.maxRetries = config.maxRetries || 3
    this.retryDelay = config.retryDelay || 1000
  }

  /**
   * Internal helper for API requests with retry logic
   */
  private async request<T>(
    endpoint: string,
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
        return this.request<T>(endpoint, options, retryCount + 1)
      }

      if (!response.ok) {
        const errorData = await this.parseResponse(response).catch(() => ({}))
        const error: ApiError = {
          name: 'ApiError',
          message: errorData.error || `API Error: ${response.statusText}`,
          status: response.status,
          code: errorData.code || 'UNKNOWN',
          details: errorData.details,
        }
        throw error
      }

      return await this.parseResponse(response)
    } catch (error) {
      clearTimeout(timeoutId)

      // Retry on network errors
      if (error instanceof Error && retryCount < this.maxRetries) {
        if (
          error.message.includes('abort') ||
          error.message.includes('network')
        ) {
          await this.sleep(this.retryDelay * Math.pow(2, retryCount))
          return this.request<T>(endpoint, options, retryCount + 1)
        }
      }

      throw error
    }
  }

  private async parseResponse(response: Response): Promise<any> {
    const text = await response.text()
    if (!text) return {}
    try {
      return JSON.parse(text)
    } catch {
      return { raw: text }
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
        return this.request<BiasAnalysisResult>('/bias-analysis/analyze', {
          method: 'POST',
          body: JSON.stringify(params),
        })
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
        )
        return response.sessions
      },
    }
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
        return this.request('/health')
      },

      /**
       * Get API version info
       */
      getVersion: async (): Promise<{ version: string; build: string }> => {
        return this.request('/version')
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
        Array<{ id: string; name: string; created: string; expires?: string }>
      > => {
        const response = await this.request<{ keys: any[] }>(
          '/developer/api-keys',
        )
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
        await this.request(`/developer/api-keys/${keyId}`, {
          method: 'DELETE',
        })
      },
    }
  }
}

// Default export
export default PixelatedClient
