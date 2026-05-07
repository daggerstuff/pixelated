import { useCallback } from 'react'

import type { AIMessage, AIServiceOptions } from '@/lib/ai/models/ai-types'
import { createLLMService } from '@/lib/ai/services/llm-provider'

export function useAIService() {
  const getAIResponse = useCallback(
    async (prompt: string, options?: AIServiceOptions) => {
      try {
        // Create AI service
        const aiService = createLLMService({
          apiKey: process.env['LLM_API_KEY'] || '',
          baseUrl:
            process.env['LLM_BASE_URL'] ||
            process.env['LLM_API_URL'] ||
            process.env['OPENAI_BASE_URL'] ||
            '',
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
