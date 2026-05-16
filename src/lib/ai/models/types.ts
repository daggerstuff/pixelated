/**
 * AI Models Types - Bridge to AI Infrastructure Types
 */

// Core AIModel interface for the model registry
export interface AIModel {
  id: string
  name: string
  provider: string
  version?: string
  capabilities: string[]
  contextWindow: number
  maxTokens: number
  temperature: number
  defaultConfig?: Record<string, unknown>
}

// Re-export from ai-types if available
export * from './ai-types'

// Re-export specific types if needed or add fallback stubs for legacy compatibility
// But preferring the real types from ai-types.ts
