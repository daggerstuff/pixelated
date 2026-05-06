import { createBuildSafeLogger } from '../logging/build-safe-logger'
import type { AIService, AICompletion, AIStreamChunk } from './models/ai-types'
import { createTogetherAIService } from './services/together'

const appLogger = createBuildSafeLogger('ai-providers')

// Available AI providers
export type AIProviderType =
  | 'anthropic'
  | 'openai'
  | 'azure-openai'
  | 'together'
  | 'huggingface'
  | 'local'

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
const serviceCache = new Map<AIProviderType, AIService>()

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
  anthropic: {
    name: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-3-sonnet-20240229',
    capabilities: ['chat', 'analysis', 'crisis-detection'],
  },
  openai: {
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
  together: {
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz',
    defaultModel: 'minimaxai/minimax-m2.7',
    capabilities: ['chat', 'analysis', 'crisis-detection'],
  },
  huggingface: {
    name: 'Hugging Face',
    baseUrl: 'https://api-inference.huggingface.co',
    defaultModel: 'microsoft/DialoGPT-medium',
    capabilities: ['chat'],
  },
  local: {
    name: 'Local Wayfarer (GGUF)',
    baseUrl: 'http://localhost:8000/v1',
    defaultModel: 'pixelated-v1-wayfarer',
    capabilities: ['chat', 'analysis', 'crisis-detection'],
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

    // Local GGUF Inference
    const localAiBaseUrl = getEnvVar('LOCAL_AI_BASE_URL') || 'http://localhost:8000/v1'
    providers.set('local', {
      ...defaultConfigs.local,
      apiKey: 'local-no-key',
      baseUrl: localAiBaseUrl,
    } as AIProviderConfig)

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
    const cachedService = serviceCache.get(providerType)
    if (cachedService) {
      return cachedService
    }

    const config = providers.get(providerType)
    if (!config) {
      appLogger.warn(`Provider ${providerType} not configured`)
      return null
    }

    let service: AIService | null = null
    switch (providerType) {
      case 'together':
        service = createTogetherServiceAdapter(config)
        break
      case 'anthropic':
        service = createAnthropicServiceAdapter(config)
        break
      case 'openai':
        service = createOpenAIServiceAdapter(config)
        break
      case 'huggingface':
        service = createHuggingFaceServiceAdapter(config)
        break
      case 'local':
        service = createLocalServiceAdapter(config)
        break
      default:
        appLogger.warn(`Unsupported provider type: ${providerType}`)
        return null
    }

    if (service) {
      serviceCache.set(providerType, service)
    }
    return service
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

function createLocalServiceAdapter(config: AIProviderConfig): AIService {
  return {
    createChatCompletion: async (messages, options) => {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          ...options,
        }),
      })

      if (!response.ok) {
        throw new Error(`Local AI service failed: ${response.statusText}`)
      }

      const data = await response.json()
      const content = data?.choices?.[0]?.message?.content
      if (content === undefined) {
        throw new Error('Local AI service returned an empty or malformed response')
      }

      return {
        id: data.id || 'local-id',
        content,
        model: config.defaultModel,
        usage: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      } as AICompletion
    },
    createStreamingChatCompletion: async (_messages, _options) =>
      Promise.reject(
        new Error('Local streaming not yet implemented'),
      ) as unknown as Promise<AsyncGenerator<AIStreamChunk, void, void>>,
    getModelInfo: (model: string) => ({
      id: model,
      name: model,
      provider: 'local',
      capabilities: config.capabilities,
      contextWindow: 4096,
      maxTokens: 4096,
    }),
    dispose: () => {},
  }
}

// Initialize providers on module load
initializeProviders()
