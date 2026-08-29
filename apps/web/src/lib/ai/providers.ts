import { createBuildSafeLogger } from '../logging/build-safe-logger'
import type { AIService, AICompletion, AIStreamChunk, AIMessage, AIServiceOptions, AIUsage } from './models/ai-types'
import { createLLMService } from './services/llm-provider'
import { DEFAULT_LLM_MODEL } from './constants'
import { acquireRateLimit } from './rate-limiter'
import {
  executeWithFallback,
  executeStreamingWithFallback,
  buildFallbackChain,
  type FallbackConfig,
  type ServiceResolver,
} from './fallback'

const appLogger = createBuildSafeLogger('ai-providers')

// Available AI providers
export type AIProviderType =
 | 'anthropic'
 | 'openai'
 | 'azure-openai'
 | 'llm'
 | 'nvidia'
 | 'huggingface'
 | 'local';

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
    baseUrl: 'https://api.openai.com',
    defaultModel: 'gpt-4',
    capabilities: ['chat', 'analysis', 'crisis-detection'],
  },
  'azure-openai': {
    name: 'Azure OpenAI',
    baseUrl: '', // Will be set from Azure config
    defaultModel: 'gpt-4',
    capabilities: ['chat', 'analysis', 'crisis-detection'],
  },
    llm: {
      name: 'LLM API',
      defaultModel: DEFAULT_LLM_MODEL,
      capabilities: ['chat', 'analysis', 'crisis-detection'],
    },
    nvidia: {
      name: 'NVIDIA NIM',
      baseUrl: 'https://integrate.api.nvidia.com/v1',
      defaultModel: 'openai/gpt-oss-120b',
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

const LLM_PROVIDER_API_KEYS: readonly string[] = [
  'LLM_API_KEY',
  'NVIDIA_API_KEY',
  'NIM_API_KEY',
  'NVIDIA_TOKEN',
]

const LLM_PROVIDER_BASE_URLS: readonly string[] = [
  'LLM_BASE_URL',
  'LLM_API_URL',
  'OPENAI_BASE_URL',
  'NVIDIA_OPENAI_BASE_URL',
  'NVIDIA_BASE_URL',
  'NIM_BASE_URL',
]

function resolveProviderConfigValue(keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = getEnvVar(key)
    if (value) return value
  }
  return undefined
}

/**
 * Initialize AI providers with environment configuration
 */
export function initializeProviders() {
  try {
    // Primary LLM provider key
    const providerApiKey = resolveProviderConfigValue(LLM_PROVIDER_API_KEYS)
    const providerBaseUrl = resolveProviderConfigValue(LLM_PROVIDER_BASE_URLS)
    if (providerApiKey && providerBaseUrl) {
      providers.set('llm', {
        ...defaultConfigs.llm,
        apiKey: providerApiKey,
        ...(providerBaseUrl ? { baseUrl: providerBaseUrl } : {}),
      } as AIProviderConfig)
    }
    // NVIDIA NIM via OpenAI-compatible endpoint
    const nvidiaApiKey = getEnvVar('NVIDIA_API_KEY') ?? getEnvVar('NIM_API_KEY') ?? getEnvVar('NVIDIA_TOKEN')
    const nvidiaBaseUrl = getEnvVar('NVIDIA_BASE_URL') ?? getEnvVar('NVIDIA_OPENAI_BASE_URL') ?? getEnvVar('NIM_BASE_URL') ?? getEnvVar('OPENAI_BASE_URL') ?? 'https://integrate.api.nvidia.com/v1'
    if (nvidiaApiKey && nvidiaBaseUrl) {
      providers.set('nvidia', {
        ...defaultConfigs.nvidia,
        apiKey: nvidiaApiKey,
        baseUrl: nvidiaBaseUrl,
        defaultModel: getEnvVar('NVIDIA_MODEL') ?? defaultConfigs.nvidia.defaultModel,
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
    const localAiBaseUrl = getEnvVar('LOCAL_AI_BASE_URL') ?? 'http://localhost:8000/v1'
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
      case 'llm':
        service = withRateLimit(providerType, createLLMServiceAdapter(config))
        break
      case 'nvidia':
        service = withRateLimit(providerType, createLLMServiceAdapter(config))
        break
      case 'anthropic':
        service = withRateLimit(providerType, createAnthropicServiceAdapter(config))
        break
      case 'openai':
        service = withRateLimit(providerType, createOpenAIServiceAdapter(config))
        break
      case 'huggingface':
        service = withRateLimit(providerType, createHuggingFaceServiceAdapter(config))
        break
      case 'local':
        service = withRateLimit(providerType, createLocalServiceAdapter(config))
        break
      case "azure-openai": { throw new Error('Not implemented yet: "azure-openai" case') }
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
  return providers.get(providerType) ?? null
}

/** Reset provider registry and service cache (for testing). */
export function resetProvidersForTesting(): void {
  providers.clear()
  serviceCache.clear()
}

/** Force-set a provider config (for testing). */
export function setProviderForTesting(
  providerType: AIProviderType,
  config: AIProviderConfig,
): void {
  providers.set(providerType, config)
}

// Provider-specific service adapters

/**
 * Wrap an AIService with per-provider rate limiting.
 * Each call to createChatCompletion or createStreamingChatCompletion
 * acquires a rate-limit token before delegating to the underlying service.
 */
function withRateLimit(provider: AIProviderType, service: AIService): AIService {
  return {
    createChatCompletion: async (messages, options) => {
      await acquireRateLimit(provider)
      return service.createChatCompletion(messages, options)
    },
    createStreamingChatCompletion: async (messages, options) => {
      await acquireRateLimit(provider)
      return service.createStreamingChatCompletion(messages, options)
    },
    getModelInfo: service.getModelInfo.bind(service),
    ...(service.createChatCompletionWithTracking
      ? { createChatCompletionWithTracking: service.createChatCompletionWithTracking.bind(service) }
      : {}),
    ...(service.generateCompletion
      ? { generateCompletion: service.generateCompletion.bind(service) }
      : {}),
    dispose: service.dispose.bind(service),
  }
}

function createLLMServiceAdapter(config: AIProviderConfig): AIService {
  const llmService = createLLMService({
    apiKey: config.apiKey,
    ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
  })

  return {
    createChatCompletion: async (messages, options) => {
      return (await llmService.generateCompletion(
        messages,
        options,
      )) as AICompletion
    },
    createStreamingChatCompletion: async (messages, options) =>
      llmService.createStreamingChatCompletion(messages, {
        ...options,
        model: options?.model ?? config.defaultModel,
      }),
    getModelInfo: (model: string) => ({
      id: model,
      name: model,
      provider: 'llm',
      capabilities: config.capabilities,
      contextWindow: 8192,
      maxTokens: 8192,
    }),
    dispose: llmService.dispose.bind(llmService),
  }
}

function createAnthropicServiceAdapter(config: AIProviderConfig): AIService {
  const baseUrl = config.baseUrl ?? 'https://api.anthropic.com'

  const headers = (extra?: Record<string, string>) => ({
    'Content-Type': 'application/json',
    'x-api-key': config.apiKey,
    'anthropic-version': '2023-06-01',
    ...extra,
  })

  const createChatCompletion = async (
    messages: AIMessage[],
    options?: AIServiceOptions,
  ): Promise<AICompletion> => {
    const model = options?.model ?? config.defaultModel
    const systemMsg = messages.find((m) => m.role === 'system')
    const userMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }))

    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        model,
        max_tokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature,
        stop_sequences: options?.stop,
        system: systemMsg?.content,
        messages: userMessages,
      }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText)
      throw new Error(`Anthropic API error (${response.status}): ${errText}`)
    }

    const data = await response.json() as {
      id: string
      content: Array<{ text: string; type: string }>
      usage: { input_tokens: number; output_tokens: number }
      stop_reason?: string
    }

    const content = data.content?.map((c) => c.text).join('') ?? ''
    const usage: AIUsage = {
      promptTokens: data.usage?.input_tokens ?? 0,
      completionTokens: data.usage?.output_tokens ?? 0,
      totalTokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
    }

    return {
      id: data.id,
      created: Date.now(),
      model,
      choices: [
        {
          message: { role: 'assistant', content },
          finishReason: data.stop_reason === 'max_tokens' ? 'length' : 'stop',
        },
      ],
      usage,
      provider: 'anthropic',
      content,
    }
  }

  return {
    createChatCompletion,
    createStreamingChatCompletion: async (messages, options) => {
      const model = options?.model ?? config.defaultModel
      const systemMsg = messages.find((m) => m.role === 'system')
      const userMessages = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role, content: m.content }))

      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: headers({ Accept: 'text/event-stream' }),
        body: JSON.stringify({
          model,
          max_tokens: options?.maxTokens ?? 4096,
          temperature: options?.temperature,
          stop_sequences: options?.stop,
          stream: true,
          system: systemMsg?.content,
          messages: userMessages,
        }),
      })

      if (!response.ok || !response.body) {
        const errText = await response.text().catch(() => response.statusText)
        throw new Error(`Anthropic stream error (${response.status}): ${errText}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      const msgId = `anthropic-${Date.now()}`

      const stream = async function* (): AsyncGenerator<AIStreamChunk, void, void> {
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              const jsonStr = line.slice(6).trim()
              if (!jsonStr || jsonStr === '[DONE]') continue
              try {
                const event = JSON.parse(jsonStr) as {
                  type: string
                  delta?: { text?: string; stop_reason?: string }
                  message?: { id?: string }
                }
                if (event.type === 'content_block_delta' && event.delta?.text) {
                  yield {
                    id: event.message?.id ?? msgId,
                    model,
                    created: Date.now(),
                    content: event.delta.text,
                    done: false,
                  }
                } else if (event.delta?.stop_reason) {
                  yield {
                    id: msgId,
                    model,
                    created: Date.now(),
                    content: '',
                    done: true,
                    finishReason: event.delta.stop_reason === 'max_tokens' ? 'length' : 'stop',
                  }
                }
              } catch {
                // skip malformed SSE line
              }
            }
          }
        } finally {
          reader.releaseLock()
        }
      }
      return stream()
    },
    getModelInfo: (model: string) => ({
      id: model,
      name: model,
      provider: 'anthropic',
      capabilities: config.capabilities,
      contextWindow: 100000,
      maxTokens: 4096,
    }),
    dispose: () => {},
  }
}

function createOpenAIServiceAdapter(config: AIProviderConfig): AIService {
  const rawBaseUrl = config.baseUrl ?? 'https://api.openai.com'
  // Normalize: strip a trailing /v1 so `${baseUrl}/v1/...` never doubles the segment.
  const baseUrl = rawBaseUrl.replace(/\/v1\/?$/, '')

  const createChatCompletion = async (
    messages: AIMessage[],
    options?: AIServiceOptions,
  ): Promise<AICompletion> => {
    const model = options?.model ?? config.defaultModel
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature,
        stop: options?.stop,
      }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText)
      throw new Error(`OpenAI API error (${response.status}): ${errText}`)
    }

    const data = await response.json() as {
      id: string
      created: number
      model: string
      choices: Array<{
        message: { role: string; content: string }
        finish_reason: string
      }>
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
    }

    const choice = data.choices?.[0]
    const content = choice?.message?.content ?? ''
    const usage: AIUsage = {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
    }

    return {
      id: data.id,
      created: data.created,
      model: data.model,
      choices: [
        {
          message: { role: 'assistant', content },
          finishReason: choice?.finish_reason === 'length' ? 'length' : 'stop',
        },
      ],
      usage,
      provider: 'openai',
      content,
    }
  }

  return {
    createChatCompletion,
    createStreamingChatCompletion: async (messages, options) => {
      const model = options?.model ?? config.defaultModel
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          max_tokens: options?.maxTokens ?? 4096,
          temperature: options?.temperature,
          stop: options?.stop,
          stream: true,
        }),
      })

      if (!response.ok || !response.body) {
        const errText = await response.text().catch(() => response.statusText)
        throw new Error(`OpenAI stream error (${response.status}): ${errText}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      const msgId = `openai-${Date.now()}`

      const stream = async function* (): AsyncGenerator<AIStreamChunk, void, void> {
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              const jsonStr = line.slice(6).trim()
              if (!jsonStr || jsonStr === '[DONE]') continue
              try {
                const event = JSON.parse(jsonStr) as {
                  id?: string
                  model?: string
                  created?: number
                  choices: Array<{
                    delta?: { content?: string; role?: string }
                    finish_reason?: string
                  }>
                }
                const delta = event.choices?.[0]?.delta
                if (delta?.content) {
                  yield {
                    id: event.id ?? msgId,
                    model: event.model ?? model,
                    created: event.created ?? Date.now(),
                    content: delta.content,
                    done: false,
                  }
                }
                const finishReason = event.choices?.[0]?.finish_reason
                if (finishReason) {
                  yield {
                    id: msgId,
                    model: event.model ?? model,
                    created: event.created ?? Date.now(),
                    content: '',
                    done: true,
                    finishReason: finishReason === 'length' ? 'length' : 'stop',
                  }
                }
              } catch {
                // skip malformed SSE line
              }
            }
          }
        } finally {
          reader.releaseLock()
        }
      }
      return stream()
    },
    getModelInfo: (model: string) => ({
      id: model,
      name: model,
      provider: 'openai',
      capabilities: config.capabilities,
      contextWindow: 8192,
      maxTokens: 4096,
    }),
    dispose: () => {},
  }
}

function createHuggingFaceServiceAdapter(config: AIProviderConfig): AIService {
  const baseUrl =
    config.baseUrl ?? 'https://api-inference.huggingface.co/models'

  const createChatCompletion = async (
    messages: AIMessage[],
    options?: AIServiceOptions,
  ): Promise<AICompletion> => {
    const model = options?.model ?? config.defaultModel
    const prompt = messages
      .map((m) => `${m.role === 'assistant' ? 'Assistant' : m.role === 'system' ? 'System' : 'User'}: ${m.content}`)
      .join('\n')

    const response = await fetch(`${baseUrl}/${model}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: options?.maxTokens ?? 1024,
          temperature: options?.temperature,
          return_full_text: false,
        },
        options: { wait_for_model: true },
      }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText)
      throw new Error(`HuggingFace API error (${response.status}): ${errText}`)
    }

    const data = (await response.json()) as Array<{ generated_text?: string }> | { generated_text?: string }
    const generated = Array.isArray(data) ? data[0]?.generated_text ?? '' : data.generated_text ?? ''
    const content = generated.trim()

    const usage: AIUsage = {
      promptTokens: Math.ceil(prompt.length / 4),
      completionTokens: Math.ceil(content.length / 4),
      totalTokens: Math.ceil((prompt.length + content.length) / 4),
    }

    return {
      id: `hf-${Date.now()}`,
      created: Date.now(),
      model,
      choices: [
        {
          message: { role: 'assistant', content },
          finishReason: 'stop',
        },
      ],
      usage,
      provider: 'huggingface',
      content,
    }
  }

  return {
    createChatCompletion,
    createStreamingChatCompletion: async (messages, options) => {
      const model = options?.model ?? config.defaultModel
      const prompt = messages
        .map((m) => `${m.role === 'assistant' ? 'Assistant' : m.role === 'system' ? 'System' : 'User'}: ${m.content}`)
        .join('\n')

      const response = await fetch(`${baseUrl}/${model}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: options?.maxTokens ?? 1024,
            temperature: options?.temperature,
            return_full_text: false,
          },
          stream: true,
        }),
      })

      if (!response.ok || !response.body) {
        const errText = await response.text().catch(() => response.statusText)
        throw new Error(`HuggingFace stream error (${response.status}): ${errText}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      const msgId = `hf-${Date.now()}`

      const stream = async function* (): AsyncGenerator<AIStreamChunk, void, void> {
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''
            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed.startsWith('data:')) continue
              const jsonStr = trimmed.slice(5).trim()
              if (!jsonStr || jsonStr === '[DONE]') continue
              try {
                const event = JSON.parse(jsonStr) as { token?: { text?: string }; generated_text?: string }
                const chunk = event.token?.text ?? event.generated_text ?? ''
                if (chunk) {
                  yield {
                    id: msgId,
                    model,
                    created: Date.now(),
                    content: chunk,
                    done: false,
                  }
                }
              } catch {
                // skip malformed SSE line
              }
            }
          }
          yield {
            id: msgId,
            model,
            created: Date.now(),
            content: '',
            done: true,
            finishReason: 'stop',
          }
        } finally {
          reader.releaseLock()
        }
      }
      return stream()
    },
    getModelInfo: (model: string) => ({
      id: model,
      name: model,
      provider: 'huggingface',
      capabilities: config.capabilities,
      contextWindow: 2048,
      maxTokens: 1024,
    }),
    dispose: () => {},
  }
}

function createLocalServiceAdapter(config: AIProviderConfig): AIService {
  const createLocalCompletion = async (
    messages: AIMessage[],
    options?: AIServiceOptions,
  ): Promise<AICompletion> => {
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
      id: data.id ?? 'local-id',
      created: Date.now(),
      content,
      model: config.defaultModel,
      usage: data.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    } as AICompletion
  }

  return {
    createChatCompletion: createLocalCompletion,
    createStreamingChatCompletion: async (messages, options) => {
      const completion = await createLocalCompletion(messages, options)
      const stream = async function* (): AsyncGenerator<AIStreamChunk, void, void> {
        const normalizedContent = completion.content || ''
        if (!normalizedContent) {
          yield {
            id: completion.id,
            model: completion.model,
            created: Date.now(),
            content: '',
            done: true,
          }
          return
        }

        const chunkSize = 80
        for (let i = 0; i < normalizedContent.length; i += chunkSize) {
          const contentChunk = normalizedContent.slice(i, i + chunkSize)
          yield {
            id: completion.id,
            model: completion.model,
            created: completion.created || Date.now(),
            content: contentChunk,
            done: i + chunkSize >= normalizedContent.length,
            ...(i + chunkSize >= normalizedContent.length && {
              finishReason: 'stop',
            }),
          }
        }
      }
      return stream()
    },
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

/**
 * Create a fallback-aware completion by trying providers in chain order.
 */
export async function createChatCompletionWithFallback(
  primary: AIProviderType,
  messages: AIMessage[],
  options?: AIServiceOptions &
    Partial<Pick<FallbackConfig, 'maxRetries' | 'initialBackoffMs' | 'maxBackoffMs' | 'jitterFactor'>>,
): Promise<AICompletion> {
  const available = getAvailableProviders()
  const chain = buildFallbackChain(primary, available)
  const resolver: ServiceResolver = (provider) => getAIServiceByProvider(provider)
  const {
    maxRetries,
    initialBackoffMs,
    maxBackoffMs,
    jitterFactor,
    ...aiOptions
  } = options ?? {}
  const fallbackConfig: FallbackConfig = {
    providers: chain,
    ...(maxRetries !== undefined && { maxRetries }),
    ...(initialBackoffMs !== undefined && { initialBackoffMs }),
    ...(maxBackoffMs !== undefined && { maxBackoffMs }),
    ...(jitterFactor !== undefined && { jitterFactor }),
  }
  return executeWithFallback(resolver, fallbackConfig, messages, aiOptions)
}

/**
 * Create a fallback-aware streaming completion.
 */
export async function createStreamingChatCompletionWithFallback(
  primary: AIProviderType,
  messages: AIMessage[],
  options?: AIServiceOptions &
    Partial<Pick<FallbackConfig, 'maxRetries' | 'initialBackoffMs' | 'maxBackoffMs' | 'jitterFactor'>>,
): Promise<AsyncGenerator<AIStreamChunk, void, void>> {
  const available = getAvailableProviders()
  const chain = buildFallbackChain(primary, available)
  const resolver: ServiceResolver = (provider) => getAIServiceByProvider(provider)
  const {
    maxRetries,
    initialBackoffMs,
    maxBackoffMs,
    jitterFactor,
    ...aiOptions
  } = options ?? {}
  const fallbackConfig: FallbackConfig = {
    providers: chain,
    ...(maxRetries !== undefined && { maxRetries }),
    ...(initialBackoffMs !== undefined && { initialBackoffMs }),
    ...(maxBackoffMs !== undefined && { maxBackoffMs }),
    ...(jitterFactor !== undefined && { jitterFactor }),
  }
  return executeStreamingWithFallback(
    resolver,
    fallbackConfig,
    messages,
    aiOptions,
  )
}

// Initialize providers on module load
initializeProviders()