export type ModelCapability =
  | 'chat'
  | 'sentiment'
  | 'crisis'
  | 'response'
  | 'intervention'
  | 'analysis'
  | 'reasoning'
  | 'code-generation'
  | 'summarization'
  | 'therapeutic-planning'
  | 'emotion-validation'
  | 'safety-assessment'

export * from './ai-types'

export interface AIModel {
  id: string
  name: string
  provider:
    | 'openai'
    | 'anthropic'
    | 'google'
    | 'local'
    | 'huggingface'
    | 'together'
    | 'azure-openai'
  version: string
  capabilities: ModelCapabilities
  configuration: ModelConfiguration
  metadata: ModelMetadata
}

export interface ModelCapabilities {
  textGeneration: boolean
  textAnalysis: boolean
  chatCompletion: boolean
  streaming: boolean
  functionCalling: boolean
  imageAnalysis: boolean
  audioProcessing: boolean
  maxTokens: number
  contextWindow: number
  supportedLanguages: string[]
}

export interface ModelConfiguration {
  temperature: number
  maxTokens: number
  topP: number
  topK?: number
  frequencyPenalty: number
  presencePenalty: number
  stopSequences: string[]
  systemPrompt?: string
}

export interface ModelMetadata {
  description: string
  trainingData: string
  releaseDate: Date
  lastUpdated: Date
  license: string
  pricing: {
    inputTokensPerMillion: number
    outputTokensPerMillion: number
    currency: string
  }
  performance: {
    latency: number
    throughput: number
    accuracy: number
  }
}

export interface AIStreamChunk {
  id: string
  object: 'chat.completion.chunk' | 'text_completion'
  created: number
  model: string
  choices?: Array<{
    index: number
    delta: {
      role?: 'assistant' | 'user' | 'system'
      content?: string
    }
    finish_reason?: 'stop' | 'length' | 'function_call' | 'tool_calls' | null
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface ChatCompletionRequest {
  model: string
  messages: ChatMessage[]
  temperature?: number
  max_tokens?: number
  top_p?: number
  frequency_penalty?: number
  presence_penalty?: number
  stop?: string | string[]
  stream?: boolean
  functions?: ChatFunction[]
  function_call?: 'auto' | 'none' | { name: string }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function'
  content: string
  name?: string
  function_call?: {
    name: string
    arguments: string
  }
}

export interface ChatFunction {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export interface ChatCompletionResponse {
  id: string
  object: 'chat.completion'
  created: number
  model: string
  choices: Array<{
    index: number
    message: ChatMessage
    finish_reason: 'stop' | 'length' | 'function_call' | 'tool_calls'
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface ModelProvider {
  name: string
  baseUrl: string
  apiKey: string
  models: AIModel[]
  rateLimit: {
    requestsPerMinute: number
    tokensPerMinute: number
  }
  healthCheck(): Promise<boolean>
  listModels(): Promise<AIModel[]>
  createChatCompletion(
    request: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse>
  createChatStream(
    request: ChatCompletionRequest,
  ): Promise<ReadableStream<AIStreamChunk>>
}

export interface ModelRegistry {
  providers: Map<string, ModelProvider>
  defaultProvider: string
  fallbackProviders: string[]
  registerProvider(provider: ModelProvider): void
  getProvider(name: string): ModelProvider | undefined
  getModel(modelId: string): AIModel | undefined
  listAvailableModels(): AIModel[]
}

// Specialized model types for mental health
export interface MentalHealthModel extends AIModel {
  specialization: {
    domain: 'general' | 'crisis' | 'therapy' | 'assessment' | 'diagnosis'
    certifications: string[]
    ethicalGuidelines: string[]
    privacyCompliance: string[]
  }
  safeguards: {
    crisisDetection: boolean
    biasMonitoring: boolean
    responseFiltering: boolean
    auditLogging: boolean
  }
}

export interface TherapeuticModel extends MentalHealthModel {
  approaches: Array<
    'CBT' | 'DBT' | 'psychodynamic' | 'humanistic' | 'mindfulness'
  >
  interventions: string[]
  populationTargets: Array<
    'adults' | 'adolescents' | 'children' | 'elderly' | 'couples' | 'families'
  >
  traumaInformed: boolean
}

// Error types
export interface ModelError {
  code: string
  message: string
  type:
    | 'rate_limit'
    | 'authentication'
    | 'model_unavailable'
    | 'invalid_request'
    | 'server_error'
  details?: Record<string, unknown>
  retryAfter?: number
}

// Performance monitoring
export interface ModelPerformanceMetrics {
  modelId: string
  timestamp: Date
  requestCount: number
  averageLatency: number
  successRate: number
  errorRate: number
  tokenUsage: {
    input: number
    output: number
    total: number
  }
  costs: {
    input: number
    output: number
    total: number
  }
}

// Model validation
export interface ModelValidationResult {
  modelId: string
  isValid: boolean
  issues: ModelValidationIssue[]
  recommendations: string[]
  score: number
}

export interface ModelValidationIssue {
  type: 'safety' | 'performance' | 'compliance' | 'configuration'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  suggestion: string
}
