// Stub AI Models Registry - Phase 5.0 Reconstruction
// TODO: Replace with actual AI infrastructure integration

import type { AIModel } from './types'

// Stub model data based on your existing AI infrastructure
const STUB_MODELS: Array<AIModel & { available: boolean }> = [
  {
    id: 'gemini-2-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    capabilities: ['text-generation', 'conversation'],
    maxTokens: 32768,
    contextWindow: 1048576,
    temperature: 0.7,
    available: true,
  },
  {
    id: 'claude-3-sonnet',
    name: 'Claude 3 Sonnet',
    provider: 'anthropic',
    capabilities: ['text-generation', 'conversation', 'analysis'],
    maxTokens: 200000,
    contextWindow: 200000,
    temperature: 0.7,
    available: true,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    capabilities: ['text-generation', 'conversation', 'vision'],
    maxTokens: 128000,
    contextWindow: 128000,
    temperature: 0.7,
    available: true,
  },
  {
    id: 'llm-llama-3-8b',
    name: 'Llama 3 8B',
    provider: 'llm',
    capabilities: ['text-generation', 'conversation'],
    maxTokens: 8192,
    contextWindow: 8192,
    temperature: 0.7,
    available: true,
  },
  {
    id: 'minimaxai/minimax-m3',
    name: 'MiniMax-M3',
    provider: 'nvidia',
    capabilities: ['text-generation', 'conversation', 'analysis', 'reasoning'],
    maxTokens: 128000,
    contextWindow: 128000,
    temperature: 0.7,
    available: true,
  },
  {
    id: 'z-ai/glm-5.2',
    name: 'GLM-5.2',
    provider: 'nvidia',
    capabilities: ['text-generation', 'conversation', 'analysis'],
    maxTokens: 128000,
    contextWindow: 128000,
    temperature: 0.7,
    available: true,
  },
]

export function getAllModels(): AIModel[] {
  return STUB_MODELS
}

export function getModelsByProvider(provider: string): AIModel[] {
  return STUB_MODELS.filter((model) => model.provider === provider)
}

export function getModelsByCapability(capability: string): AIModel[] {
  return STUB_MODELS.filter((model) => model.capabilities.includes(capability))
}

export function getModelById(id: string): AIModel | undefined {
  return STUB_MODELS.find((model) => model.id === id)
}
