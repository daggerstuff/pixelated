import type { AIService, AICompletion, AIStreamChunk } from './models/ai-types'
import { createTogetherAIService } from './services/together'
import { createBuildSafeLogger } from '../logging/build-safe-logger'

const appLogger = createBuildSafeLogger('ai-providers')

// Available AI providers
export type AIProviderType =
  | 'anthropic'
  | 'openai'
  | 'azure-openai'
  | 'together'
  | 'huggingface'

// Provider configuration interface
export interface AIProviderConfig {
  name: string
  baseUrl?: string
  apiKey: string
  defaultModel: string
  capabilities: string[]
}

// Provider registry
const providers = new Map<AIProviderType, AIProviderConfig>()

/**
 * Helper to fetch environment variables from either process.env (SSR)
 * or import.meta.env (Vite/Build time). This avoids bracket access
 * scattered through the codebase and keeps linter output clean.
 */
function getEnvVar(key: string): string | undefined {
  const metaEnv = import.meta.env as Record<string, string> | undefined
  return process.env[key] ?? metaEnv?.[key]
}

// Default provider configurations
const defaultConfigs: Record<AIProviderType, Partial<AIProviderConfig>> = {
  'anthropic': {
    name: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-3-sonnet-20240229',
    capabilities: ['chat', 'analysis', 'crisis-detection'],
  },
  'openai': {
    name: 'OpenAI GPT',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4',
    capabilities: ['chat', 'analysis', 'crisis-detection'],
  },
  'azure-openai': {
    name: 'Azure OpenAI',
    baseUrl: '', // Will be set from Azure config
    defaultModel: 'gpt-4',
    capabilities: ['chat', 'analysis', 'crisis-detection'],
  },
  'together': {
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz',
    defaultModel: 'mistralai/Mixtral-8x7B-Instruct-v0.2',
    capabilities: ['chat', 'analysis', 'crisis-detection'],
  },
  'huggingface': {
    name: 'Hugging Face',
    baseUrl: 'https://api-inference.huggingface.co',
    defaultModel: 'microsoft/DialoGPT-medium',
    capabilities: ['chat'],
  },
}

/**
 * Initialize AI providers with environment configuration
 */
export function initializeProviders() {
  try {
    // Together AI (primary provider)
    const togetherApiKey = getEnvVar('TOGETHER_API_KEY')
    if (togetherApiKey) {
      providers.set('together', {
        ...defaultConfigs.together,
        apiKey: togetherApiKey,
      } as AIProviderConfig)
    }

    // OpenAI
    const openaiApiKey = getEnvVar('OPENAI_API_KEY')
    if (openaiApiKey) {
      providers.set('openai', {
        ...defaultConfigs.openai,
        apiKey: openaiApiKey,
      } as AIProviderConfig)
    }

    // Anthropic
    const anthropicApiKey = getEnvVar('ANTHROPIC_API_KEY')
    if (anthropicApiKey) {
      providers.set('anthropic', {
        ...defaultConfigs.anthropic,
        apiKey: anthropicApiKey,
      } as AIProviderConfig)
    }

    // Azure OpenAI
    const azureOpenAiKey = getEnvVar('AZURE_OPENAI_API_KEY')
    const azureOpenAiEndpoint = getEnvVar('AZURE_OPENAI_ENDPOINT')
    if (azureOpenAiKey && azureOpenAiEndpoint) {
      providers.set('azure-openai', {
        ...defaultConfigs['azure-openai'],
        apiKey: azureOpenAiKey,
        baseUrl: azureOpenAiEndpoint,
      } as AIProviderConfig)
    }

    // Hugging Face
    const hfApiKey = getEnvVar('HUGGINGFACE_API_KEY')
    if (hfApiKey) {
      providers.set('huggingface', {
        ...defaultConfigs.huggingface,
        apiKey: hfApiKey,
      } as AIProviderConfig)
    }

    appLogger.info(`Initialized ${providers.size} AI providers`)
  } catch (error: unknown) {
    appLogger.error('Failed to initialize AI providers:', {
      error: error as Error,
    })
  }
}

/**
 * Get AI service by provider type
 */
export function getAIServiceByProvider(
  providerType: AIProviderType,
): AIService | null {
  try {
    const config = providers.get(providerType)
    if (!config) {
      appLogger.warn(`Provider ${providerType} not configured`)
      return null
    }

    switch (providerType) {
      case 'together':
        return createTogetherServiceAdapter(config)
      case 'anthropic':
        return createAnthropicServiceAdapter(config)
      case 'openai':
        return createOpenAIServiceAdapter(config)
      case 'huggingface':
        return createHuggingFaceServiceAdapter(config)
      default:
        appLogger.warn(`Unsupported provider type: ${providerType}`)
        return null
    }
  } catch (error: unknown) {
    appLogger.error(
      `Failed to create AI service for provider ${providerType}:`,
      { error: error as Error },
    )
    return null
  }
}

/**
 * Get available providers
 */
export function getAvailableProviders(): AIProviderType[] {
  return Array.from(providers.keys())
}

/**
 * Check if provider is available
 */
export function isProviderAvailable(providerType: AIProviderType): boolean {
  return providers.has(providerType)
}

/**
 * Get provider configuration
 */
export function getProviderConfig(
  providerType: AIProviderType,
): AIProviderConfig | null {
  return providers.get(providerType) || null
}

// Provider-specific service adapters

function createTogetherServiceAdapter(config: AIProviderConfig): AIService {
  const togetherService = createTogetherAIService({
    togetherApiKey: config.apiKey,
    apiKey: config.apiKey,
    ...(config.baseUrl ? { togetherBaseUrl: config.baseUrl } : {}),
  })

  return {
    createChatCompletion: async (messages, options) => {
      return (await togetherService.generateCompletion(
        messages,
        options,
      )) as AICompletion
    },
    createStreamingChatCompletion: async (_messages, _options) =>
      Promise.reject(
        new Error('Streaming not implemented for Together AI'),
      ) as unknown as Promise<AsyncGenerator<AIStreamChunk, void, void>>,
    getModelInfo: (model: string) => ({
      id: model,
      name: model,
      provider: 'together',
      capabilities: config.capabilities,
      contextWindow: 8192,
      maxTokens: 8192,
    }),
    dispose: togetherService.dispose.bind(togetherService),
  }
}

function createAnthropicServiceAdapter(config: AIProviderConfig): AIService {
  // Placeholder implementation for Anthropic
  return {
    createChatCompletion: async () => {
      throw new Error('Anthropic service not implemented')
    },
    createStreamingChatCompletion: async (_messages, _options) =>
      Promise.reject(
        new Error('Anthropic streaming not implemented'),
      ) as unknown as Promise<AsyncGenerator<AIStreamChunk, void, void>>,
    getModelInfo: (model: string) => ({
      id: model,
      name: model,
      provider: 'anthropic',
      capabilities: config.capabilities,
      contextWindow: 100000,
      maxTokens: 4096,
    }),
    dispose: () => {
      // Cleanup if needed
    },
  }
}

function createOpenAIServiceAdapter(config: AIProviderConfig): AIService {
  // Placeholder implementation for OpenAI
  return {
    createChatCompletion: async () => {
      throw new Error('OpenAI service not implemented')
    },
    createStreamingChatCompletion: async (_messages, _options) =>
      Promise.reject(
        new Error('OpenAI streaming not implemented'),
      ) as unknown as Promise<AsyncGenerator<AIStreamChunk, void, void>>,
    getModelInfo: (model: string) => ({
      id: model,
      name: model,
      provider: 'openai',
      capabilities: config.capabilities,
      contextWindow: 8192,
      maxTokens: 4096,
    }),
    dispose: () => {
      // Cleanup if needed
    },
  }
}

function createHuggingFaceServiceAdapter(config: AIProviderConfig): AIService {
  // Placeholder implementation for Hugging Face
  return {
    createChatCompletion: async () => {
      throw new Error('Hugging Face service not implemented')
    },
    createStreamingChatCompletion: async (_messages, _options) =>
      Promise.reject(
        new Error('Hugging Face streaming not implemented'),
      ) as unknown as Promise<AsyncGenerator<AIStreamChunk, void, void>>,
    getModelInfo: (model: string) => ({
      id: model,
      name: model,
      provider: 'huggingface',
      capabilities: config.capabilities,
      contextWindow: 2048,
      maxTokens: 1024,
    }),
    dispose: () => {
      // Cleanup if needed
    },
  }
}

// Initialize providers on module load
initializeProviders()
