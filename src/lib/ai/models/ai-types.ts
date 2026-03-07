export interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  name?: string
}

export interface AIServiceOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
  stop?: string[]
}

export interface AIStreamChunk {
  id: string
  model: string
  created: number
  content: string
  done: boolean
  finishReason?: 'stop' | 'length' | 'content_filter'
}

export interface AIUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface AIChoice {
  message: AIMessage
  finishReason: 'stop' | 'length' | 'content_filter'
}

export interface AICompletion {
  id: string
  created: number
  model: string
  choices: AIChoice[]
  usage: AIUsage
  provider: string
  content: string
}

export interface AIModelInfo {
  id: string
  name: string
  provider: string
  capabilities: string[]
  contextWindow: number
  maxTokens: number
}

export interface AIService {
  createChatCompletion(
    messages: AIMessage[],
    options?: AIServiceOptions,
  ): Promise<AICompletion>

  createStreamingChatCompletion(
    messages: AIMessage[],
    options?: AIServiceOptions,
  ): Promise<AsyncGenerator<AIStreamChunk, void, void>>

  getModelInfo(model: string): AIModelInfo

  createChatCompletionWithTracking?(
    messages: AIMessage[],
    options?: AIServiceOptions,
  ): Promise<AICompletion>

  generateCompletion?(
    messages: AIMessage[],
    options?: AIServiceOptions,
    provider?: string,
  ): Promise<AICompletion>

  dispose(): void
}

export interface TherapeuticResponse {
  content: string
  confidence: number
  intervention?: boolean
  techniques?: string[]
  usage?: AIUsage
}

export interface TherapySession {
  sessionId?: string
  clientId: string
  therapistId?: string
  startTime: Date
  endTime: Date
  sessionType?: 'individual' | 'group' | 'family' | 'crisis'
  status?: 'scheduled' | 'active' | 'completed' | 'cancelled'
  notes?: string
  transcript?: string
  metadata?: Record<string, unknown>
  aiAnalysis?: {
    emotionalState: string[]
    techniques: string[]
    recommendations: string[]
    riskAssessment: 'low' | 'medium' | 'high'
  }
}
