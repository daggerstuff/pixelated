import { useCallback } from 'react'
import { useAIService } from './useAIService.js'

export type EmotionAnalysis = {
  primaryEmotion: string
  secondaryEmotions: string[]
  intensity: number
  confidence: number
}

// Define types for the possible responses from getAIResponse
type AIResponseContent = string
type AIResponseStream = {
  getReader: () => {
    read: () => Promise<{
      done: boolean
      value: Uint8Array
    }>
  }
}

export const useEmotionDetection = () => {
  const { getAIResponse } = useAIService()

  const parseStreamResponse = async (
    stream: AIResponseStream,
  ): Promise<string> => {
    const reader = stream.getReader()
    let analysisText = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      analysisText += new TextDecoder().decode(value)
    }
    return analysisText
  }

  const extractResponseText = (response: AIResponseContent): string => {
    return typeof response === 'string'
      ? response
      : (response as { content: string }).content || ''
  }

  const parseEmotionAnalysis = (analysisText: string): EmotionAnalysis => {
    try {
      const analysis = JSON.parse(analysisText) as unknown
      return {
        primaryEmotion: analysis.primaryEmotion || 'neutral',
        secondaryEmotions: analysis.secondaryEmotions || [],
        intensity: analysis.intensity || 0.5,
        confidence: analysis.confidence || 0.8,
      }
    } catch {
      return {
        primaryEmotion: 'neutral',
        secondaryEmotions: [],
        intensity: 0.5,
        confidence: 0.5,
      }
    }
  }

  const detectEmotions = useCallback(
    async (content: string): Promise<EmotionAnalysis> => {
      try {
        const prompt = `Analyze the emotional content of this message. Consider both obvious and subtle emotional indicators. Provide analysis in JSON format with:
      - primaryEmotion: The dominant emotion
      - secondaryEmotions: Array of other detected emotions
      - intensity: Number from 0-1 indicating emotional intensity
      - confidence: Number from 0-1 indicating confidence in analysis

      Message: "${content}"`

        const response = (await getAIResponse(prompt)) as
          | AIResponseContent
          | AIResponseStream

        let analysisText = ''
        if (
          response &&
          typeof response === 'object' &&
          'getReader' in response
        ) {
          analysisText = await parseStreamResponse(response as AIResponseStream)
        } else {
          analysisText = extractResponseText(response as AIResponseContent)
        }

        return parseEmotionAnalysis(analysisText)
      } catch (error: unknown) {
        console.error('Error detecting emotions:', error)
        return {
          primaryEmotion: 'neutral',
          secondaryEmotions: [],
          intensity: 0.5,
          confidence: 0.5,
        }
      }
    },
    [getAIResponse],
  )

  return { detectEmotions }
}

export default useEmotionDetection
