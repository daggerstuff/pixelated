// Stub AI Models Registry - Phase 5.0 Reconstruction
// TODO: Replace with actual AI infrastructure integration

import type { AIModel } from './types'

// Stub model data based on your existing AI infrastructure
const STUB_MODELS: AIModel[] = [
  {
    id: 'gemini-2-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    capabilities: ['text-generation', 'conversation'],
    maxTokens: 32768,
    available: true,
  },
  {
    id: 'claude-3-sonnet',
    name: 'Claude 3 Sonnet',
    provider: 'anthropic',
    capabilities: ['text-generation', 'conversation', 'analysis'],
    maxTokens: 200000,
    available: true,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    capabilities: ['text-generation', 'conversation', 'vision'],
    maxTokens: 128000,
    available: true,
  },
  {
    id: 'together-llama-3-8b',
    name: 'Llama 3 8B',
    provider: 'together',
    capabilities: ['text-generation', 'conversation'],
    maxTokens: 8192,
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
