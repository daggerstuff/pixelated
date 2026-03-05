import { useCallback } from 'react'
import { useAIService } from './useAIService'
/**
 * Message type (inlined due to ESM/TS import issues)
 */
export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  name: string
  encrypted?: boolean
  verified?: boolean
  isError?: boolean
}

// Extend the Message type with timestamp
interface MessageWithTimestamp extends Message {
  timestamp?: string | number | Date
}

export type ConversationPattern = {
  patternType: string
  description: string
  frequency: number
  significance: number
  suggestedResponse?: string
  confidence: number
}

// Add a type for the possible response from getAIResponse
type AIResponse = ReadableStream<Uint8Array> | { content: string } | string

export const usePatternDetection = () => {
  const { getAIResponse } = useAIService()
  // Log to validate Message type usage
  const sampleMessage: Message = {
    role: 'user',
    content: 'Sample message',
    name: 'SampleUser',
  }
  console.log('[usePatternDetection] Sample Message:', sampleMessage)

  const detectPatterns = useCallback(
    async (messages: Message[]): Promise<ConversationPattern[]> => {
      if (!messages || messages.length === 0) {
        return []
      }

      try {
        const conversationHistory = messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
          timestamp: (msg as MessageWithTimestamp).timestamp,
        }))

        const prompt = `Analyze this conversation history for behavioral and communication patterns. Consider:
      - Recurring themes or topics
      - Communication styles
      - Emotional patterns
      - Potential areas of concern
      - Response patterns

      Provide analysis in JSON format as an array of patterns, each with:
      - patternType: Category of pattern
      - description: Detailed description
      - frequency: Number from 0-1 indicating how often it occurs
      - significance: Number from 0-1 indicating clinical significance
      - suggestedResponse: Optional therapeutic response suggestion
      - confidence: Number from 0-1 indicating confidence in pattern detection

      Conversation History: ${JSON.stringify(conversationHistory)}`

        const response = (await getAIResponse(prompt)) as AIResponse
        let analysisText = ''

        if (
          typeof response === 'object' &&
          response !== null &&
          'getReader' in response
        ) {
          const reader = (response as ReadableStream<Uint8Array>).getReader()
          while (true) {
            const { done, value } = await reader.read()
            if (done) {
              break
            }
            analysisText += new TextDecoder().decode(value)
          }
        } else if (typeof response === 'object' && 'content' in response) {
          analysisText = response.content
        } else if (typeof response === 'string') {
          analysisText = response
        }

        const patterns = JSON.parse(analysisText) as unknown

        return Array.isArray(patterns)
          ? patterns.map((pattern) => ({
            patternType: pattern.patternType || 'unknown',
            description: pattern.description || '',
            frequency: pattern.frequency || 0.5,
            significance: pattern.significance || 0.5,
            suggestedResponse: pattern.suggestedResponse,
            confidence: pattern.confidence || 0.5,
          }))
          : []
      } catch (error: unknown) {
        console.error('Error detecting patterns:', error)
        return [
          {
            patternType: 'error',
            description: 'Unable to analyze patterns',
            frequency: 0,
            significance: 0,
            confidence: 0,
          },
        ]
      }
    },
    [getAIResponse],
  )

  return { detectPatterns }
}

export default usePatternDetection
