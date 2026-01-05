// Re-export types from models/ai-types for backward compatibility
export type {
  AIMessage,
  AIService,
  AIServiceOptions,
  AIStreamChunk,
  AIUsage,
  AIChoice,
  AICompletion,
  AIModelInfo,
  TherapeuticResponse,
  TherapySession,
} from './models/ai-types'

// Main AIService implementation
export { createTogetherAIService } from './services/together'
