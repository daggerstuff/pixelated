/**
 * Pixelated Empathy SDK
 * Official JavaScript/TypeScript SDK for the Pixelated Empathy API
 */

export interface SDKConfig {
  apiKey: string
  baseUrl?: string
  timeout?: number
}

export interface BiasAnalysisParams {
  text: string
  context?: string
  therapistId: string
  sessionId?: string
  clientId?: string
  demographics?: Record<string, any>
  sessionType?: string
  therapistNotes?: string
}

export interface UserProfileUpdate {
  fullName?: string
  avatarUrl?: string
  userMetadata?: Record<string, any>
}

export class PixelatedEmpathy {
  private apiKey: string
  private baseUrl: string
  private timeout: number

  constructor(config: SDKConfig) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl || 'https://api.pixelatedempathy.com/api/v1'
    this.timeout = config.timeout || 30000
  }

  /**
   * Internal helper for API requests
   */
  private async request(path: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${path}`
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
      ...options.headers,
    }

    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      })

      clearTimeout(id)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `API Error: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      clearTimeout(id)
      throw error
    }
  }

  /**
   * Bias Analysis API
   */
  get biasAnalysis() {
    return {
      /**
       * Perform bias analysis on clinical text
       */
      analyze: async (params: BiasAnalysisParams) => {
        // If we want to keep it under /api/v1, we might need to proxy it or move it
        // For now, we'll use the existing path
        const originalBaseUrl = this.baseUrl
        const baseUrl = this.baseUrl.replace('/v1', '')
        this.baseUrl = baseUrl
        try {
          return await this.request('/bias-analysis/analyze', {
            method: 'POST',
            body: JSON.stringify(params),
          })
        } finally {
          this.baseUrl = originalBaseUrl
        }
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
      getProfile: async () => {
        return this.request('/profile')
      },

      /**
       * Update the current user profile
       */
      updateProfile: async (updates: UserProfileUpdate) => {
        return this.request('/profile', {
          method: 'PUT',
          body: JSON.stringify(updates),
        })
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
      getHealth: async () => {
        return this.request('/health')
      },
    }
  }
}
