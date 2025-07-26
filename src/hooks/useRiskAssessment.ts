import { useCallback } from 'react'
import { useAIService } from './useAIService'
import type { EmotionAnalysis } from './useEmotionDetection'

export type RiskAssessment = {
  category: 'low' | 'medium' | 'high'
  factors: string[]
  requiresExpert: boolean
  confidence: number
}

export const useRiskAssessment = () => {
  const { getAIResponse } = useAIService()

  const assessRisk = useCallback(
    async (
      content: string,
      emotions?: EmotionAnalysis,
    ): Promise<RiskAssessment> => {
      try {
        const prompt = `Assess the risk factors in this message from a mental health perspective. Consider both explicit and implicit indicators of potential harm or concerning mental states. Provide analysis in JSON format with:
      - category: "low", "medium", or "high" risk level
      - factors: Array of identified risk factors or concerns
      - requiresExpert: Boolean indicating if professional intervention is recommended
      - confidence: Number from 0-1 indicating confidence in assessment

      ${emotions ? `Detected emotions: Primary emotion is ${emotions.primaryEmotion} with intensity ${emotions.intensity}. Secondary emotions include: ${emotions.secondaryEmotions.join(', ')}.` : ''}

      Message: "${content}"`

        const response = await getAIResponse(prompt)
        let analysisText = ''

        if (response instanceof ReadableStream) {
          const reader = response.getReader()
          while (true) {
            const { done, value } = await reader.read()
            if (done) {
              break
            }
            analysisText += new TextDecoder().decode(value)
          }
        } else {
          analysisText = response
        }

        const analysis = JSON.parse(analysisText)

        return {
          category: analysis.category || 'low',
          factors: analysis.factors || [],
          requiresExpert: analysis.requiresExpert || false,
          confidence: analysis.confidence || 0.5,
        }
      } catch (error) {
        console.error('Error assessing risk:', error)
        return {
          category: 'low',
          factors: [],
          requiresExpert: false,
          confidence: 0.5,
        }
      }
    },
    [getAIResponse],
  )

  return { assessRisk }
}

export default useRiskAssessment
