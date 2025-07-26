import { useCallback } from 'react'
import { createTogetherAIService } from '@/lib/ai/services/together'
import type { AIMessage, AIServiceOptions } from '@/lib/ai/models/ai-types'

export function useAIService() {
  const getAIResponse = useCallback(
    async (prompt: string, options?: AIServiceOptions) => {
      try {
        // Create AI service with Together provider
        const aiService = createTogetherAIService({
          togetherApiKey: process.env['TOGETHER_API_KEY'] || '',
          apiKey: process.env['TOGETHER_API_KEY'] || '',
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
      } catch (error) {
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
