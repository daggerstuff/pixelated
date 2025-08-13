// Enhanced API Client with retry logic and error handling
export class EnterpriseAPIClient {
  private baseURL: string
  private maxRetries: number = 3
  private retryDelay: number = 1000

  constructor(baseURL: string = '') {
    this.baseURL = baseURL
  }

  private async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    attempt: number = 1
  ): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      if (attempt >= this.maxRetries) {
        throw error
      }
      
      const delay = this.retryDelay * Math.pow(2, attempt - 1) // Exponential backoff
      console.warn(`API request failed (attempt ${attempt}/${this.maxRetries}), retrying in ${delay}ms...`, error)
      
      await this.wait(delay)
      return this.retryWithBackoff(operation, attempt + 1)
    }
  }

  async request<T = any>(
    endpoint: string,
    options: RequestInit & {
      timeout?: number
      retryOn?: number[]
    } = {}
  ): Promise<T> {
    const { timeout = 30000, retryOn = [408, 429, 500, 502, 503, 504], ...fetchOptions } = options
    
    const operation = async (): Promise<T> => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      try {
        const response = await fetch(`${this.baseURL}${endpoint}`, {
          ...fetchOptions,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'X-Client-Version': '2.0.0',
            'X-Request-ID': crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
            ...fetchOptions.headers,
          },
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          
          if (retryOn.includes(response.status)) {
            throw new APIRetryableError(`HTTP ${response.status}: ${errorData.error || response.statusText}`, response.status)
          }
          
          throw new APIError(`HTTP ${response.status}: ${errorData.error || response.statusText}`, response.status, errorData)
        }

        return await response.json()
      } catch (error) {
        clearTimeout(timeoutId)
        
        if (error instanceof Error && error.name === 'AbortError') {
          throw new APITimeoutError(`Request timeout after ${timeout}ms`)
        }
        
        throw error
      }
    }

    return this.retryWithBackoff(operation)
  }

  // Specialized methods for our APIs
  async parseContent(data: ParseRequest): Promise<ParseResponse> {
    return this.request('/api/psychology/parse', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async generateScenario(data: GenerateScenarioRequest): Promise<GenerateScenarioResponse> {
    return this.request('/api/psychology/generate-scenario', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getFrameworks(params?: FrameworksRequest): Promise<FrameworksResponse> {
    const query = params ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v))}` : ''
    return this.request(`/api/psychology/frameworks${query}`)
  }

  async analyzeContent(data: AnalyzeRequest): Promise<AnalyzeResponse> {
    return this.request('/api/psychology/analyze', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async chatMessage(data: ChatRequest): Promise<ChatResponse> {
    return this.request('/api/mental-health/chat', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async detectCrisis(data: CrisisDetectionRequest): Promise<CrisisDetectionResponse> {
    return this.request('/api/mental-health/crisis-detection', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }
}

export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any
  ) {
    super(message)
    this.name = 'APIError'
  }
}

export class APIRetryableError extends APIError {
  constructor(message: string, status: number) {
    super(message, status)
    this.name = 'APIRetryableError'
  }
}

export class APITimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'APITimeoutError'
  }
}

// Global API client instance
export const apiClient = new EnterpriseAPIClient()

// Type definitions (assuming these are imported from API files)
interface ParseRequest {
  content: string
  type: 'clinical_note' | 'research_paper' | 'case_study' | 'therapy_session'
  options?: {
    extractEntities?: boolean
    identifyFrameworks?: boolean
    generateSummary?: boolean
  }
}

interface ParseResponse {
  entities: {
    conditions: string[]
    treatments: string[]
    medications: string[]
    symptoms: string[]
    riskFactors: string[]
  }
  frameworks: Array<{
    name: string
    confidence: number
    applicability: string
    techniques: string[]
  }>
  summary: string
  confidence: number
  processingTime: number
  metadata: {
    wordCount: number
    complexity: 'low' | 'medium' | 'high'
    clinicalRelevance: number
  }
}

interface GenerateScenarioRequest {
  context: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  framework?: string
  clientProfile?: {
    age?: number
    gender?: string
    background?: string
    presenting_concern?: string
  }
  options?: {
    includeAssessment?: boolean
    includeLearningObjectives?: boolean
    includeInterventions?: boolean
  }
}

interface GenerateScenarioResponse {
  scenario: any
  learningObjectives: string[]
  assessmentCriteria: any[]
  suggestedInterventions: any[]
  supervision_notes: string[]
  metadata: any
}

interface FrameworksRequest {
  query?: string
  category?: string
  evidenceLevel?: string
  clientPopulation?: string
  issue?: string
}

interface FrameworksResponse {
  frameworks: any[]
  totalCount: number
  filteredCount: number
  categories: string[]
  metadata: any
}

interface AnalyzeRequest {
  content: string
  analysisType: 'session' | 'progress' | 'intervention' | 'risk' | 'comprehensive'
  clientContext?: any
  analysisOptions?: any
}

interface AnalyzeResponse {
  analysis: any
  recommendations: any
  interventionSuggestions: any[]
  followUpActions: any[]
  metadata: any
}

interface ChatRequest {
  message: string
  sessionId?: string
  userContext?: any
  options?: any
}

interface ChatResponse {
  response: any
  analysis: any
  riskAssessment?: any
  copingStrategies?: any
  resources?: any
  followUp: any
  metadata: any
}

interface CrisisDetectionRequest {
  content: string
  contentType: 'chat_message' | 'journal_entry' | 'form_response' | 'voice_transcript'
  context?: any
  options?: any
}

interface CrisisDetectionResponse {
  assessment: any
  riskFactors: any[]
  protectiveFactors: any[]
  recommendations: any
  resources: any
  monitoring: any
  metadata: any
}
