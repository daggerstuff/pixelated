import { useCallback } from 'react'

import type { AIMessage, AIServiceOptions } from '@/lib/ai/models/ai-types'
import { createLLMService } from '@/lib/ai/services/llm-provider'

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

function resolveProviderApiKey(): string | undefined {
  for (const key of LLM_PROVIDER_API_KEYS) {
    const value = process.env[key]
    if (value) return value
  }
  return undefined
}

function resolveSafeLlmBaseUrl(): string {
  const baseUrl =
    LLM_PROVIDER_BASE_URLS.map((key) => process.env[key]).find(Boolean) ?? ''

  return baseUrl
}

export function useAIService() {
  const getAIResponse = useCallback(
    async (prompt: string, options?: AIServiceOptions) => {
      try {
        // Create AI service
        const aiService = createLLMService({
          apiKey: resolveProviderApiKey() ?? '',
          baseUrl: resolveSafeLlmBaseUrl(),
        })

        // Format the prompt as a message
        const messages: AIMessage[] = [
          {
            role: 'user',
            content: prompt,
          },
        ]

        // Get completion from the service
        const response = await aiService.createChatCompletion(messages, {
          model: 'emotion-llama-2',
          ...options,
        })

        // Clean up resources
        aiService.dispose()

        return response.content
      } catch (error: unknown) {
        console.error('Error getting AI response:', error)
        throw error
      }
    },
    [],
  )

  return {
    getAIResponse,
  }
}

export default useAIService
