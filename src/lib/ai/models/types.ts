/**
 * AI Models Types - Phase 5.0 Reconstruction Stub
 * TODO: Replace with actual AI infrastructure types
 */

export interface AIService {
  getModelInfo: (...args: any[]) => any
  createChatCompletion: (...args: any[]) => any
  createChatStream: (...args: any[]) => any
}

export interface AIModel {
  id: string
  name: string
  provider: string
  capabilities: string[]
  maxTokens: number
  costPerToken?: number
  available: boolean
}

export interface ModelCapability {
  name: string
  description: string
}

export interface ModelProvider {
  id: string
  name: string
  models: string[]
}

export type ModelCapabilityType =
  | 'text-generation'
  | 'conversation'
  | 'analysis'
  | 'vision'
  | 'code-generation'
  | 'translation'
