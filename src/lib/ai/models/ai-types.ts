/**
 * Central AI type definitions.
 *
 * These types are imported throughout the codebase via `../models/ai-types`.
 * They are defined here (rather than re-exported) because they represent the
 * canonical shapes used by the LLM provider layer and dependent services.
 */

export interface AIMessage {
  role: string
  content: string
  name?: string
}

export interface AIServiceOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  stop?: string[]
}

export interface AIUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface AIChoice {
  message: {
    role: string
    content: string
    tool_calls?: unknown[]
  }
  finishReason: string
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

export interface AIStreamChunk {
  id: string
  model: string
  created: number
  content: string
  done: boolean
  finishReason?: 'stop' | 'length' | 'content_filter'
}

export interface AIModelInfo {
  id: string
  name: string
  provider: string
  capabilities: string[]
  contextWindow: number
  maxTokens: number
}

export type AIModel = AIModelInfo

export interface AIService {
  generateCompletion?(
    messages: AIMessage[],
    options?: AIServiceOptions,
  ): Promise<AICompletion | { content: string; usage?: AIUsage }>
  createChatCompletion(
    messages: AIMessage[],
    options?: AIServiceOptions,
  ): Promise<AICompletion>
  createStreamingChatCompletion(
    messages: AIMessage[],
    options?: AIServiceOptions,
  ): Promise<AsyncGenerator<AIStreamChunk, void, void>>
  createChatCompletionWithTracking?(
    messages: AIMessage[],
    options?: AIServiceOptions,
  ): Promise<AICompletion>
  getModelInfo?(model: string): AIModelInfo
  dispose(): void
}

export interface TherapeuticResponse {
  content: string
  confidence: number
  intervention?: boolean
  techniques?: string[]
  followUp?: string[]
  riskLevel?: 'low' | 'medium' | 'high' | 'critical'
  suggestedFollowup?: string
  approach?: string
  usage?: AIUsage
}

export interface TherapySession {
  sessionId: string
  clientId: string
  therapistId: string
  startTime: Date
  endTime?: Date
  status: 'active' | 'completed' | 'cancelled'
  securityLevel: 'standard' | 'hipaa' | 'maximum'
  emotionAnalysisEnabled: boolean
  sessionType?: string
  transcript?: string
  aiAnalysis?: {
    emotionalState?: string[]
    techniques?: string[]
    recommendations?: string[]
    riskAssessment?: string
  }
  notes?: string
  metadata?: Record<string, unknown>
}
