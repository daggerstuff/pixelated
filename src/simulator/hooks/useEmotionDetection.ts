import { useCallback, useEffect, useRef } from 'react'
import { EmotionLlamaProvider } from '../../lib/ai/providers/EmotionLlamaProvider'
import { fheService } from '../../lib/fhe'
import type { EmotionAnalysis } from '../../lib/ai/emotions/types'
import { useSimulatorContext } from '../context/SimulatorContext'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

const logger = createBuildSafeLogger('useEmotionDetection')

export const useEmotionDetection = () => {
  const providerRef = useRef<EmotionLlamaProvider | null>(null)
  const { updateEmotionState } = useSimulatorContext()

  // Initialize the provider
  useEffect(() => {
    const initProvider = async () => {
      try {
        const baseUrl = process.env.EMOTION_LLAMA_API_URL
        const apiKey = process.env.EMOTION_LLAMA_API_KEY

        if (!baseUrl || !apiKey) {
          logger.error(
            'Missing required API credentials for EmotionLlamaProvider',
          )
          return
        }

        providerRef.current = new EmotionLlamaProvider(
          baseUrl,
          apiKey,
          fheService,
        )
      } catch (error: unknown) {
        logger.error('Failed to initialize EmotionLlamaProvider:', error)
      }
    }

    initProvider()
  }, [])

  const detectEmotions = useCallback(
    async (text: string): Promise<EmotionAnalysis | null> => {
      try {
        if (!providerRef.current) {
          logger.error('EmotionLlamaProvider not initialized')
          return null
        }

        const analysis = await providerRef.current.analyzeEmotions(text)

        // Update the simulator context with the new emotion state
        if (analysis.emotions.length > 0) {
          // Calculate valence (positive/negative sentiment)
          const valence =
            analysis.emotions.reduce((sum, emotion) => {
              const valenceMap: Record<string, number> = {
                joy: 1,
                happiness: 1,
                excitement: 0.8,
                contentment: 0.6,
                neutral: 0,
                anxiety: -0.6,
                fear: -0.8,
                sadness: -1,
                anger: -0.9,
              }
              return (
                sum +
                (valenceMap[emotion.type.toLowerCase()] || 0) *
                  emotion.intensity
              )
            }, 0) / analysis.emotions.length

          // Calculate energy/arousal level
          const energy =
            analysis.emotions.reduce((sum, emotion) => {
              const energyMap: Record<string, number> = {
                excitement: 1,
                anger: 0.9,
                joy: 0.8,
                anxiety: 0.7,
                fear: 0.6,
                happiness: 0.5,
                sadness: 0.3,
                contentment: 0.2,
                neutral: 0.5,
              }
              return (
                sum +
                (energyMap[emotion.type.toLowerCase()] || 0.5) *
                  emotion.intensity
              )
            }, 0) / analysis.emotions.length

          // Calculate dominance
          const dominance =
            analysis.emotions.reduce((sum, emotion) => {
              const dominanceMap: Record<string, number> = {
                anger: 0.9,
                joy: 0.8,
                excitement: 0.7,
                happiness: 0.6,
                neutral: 0.5,
                anxiety: 0.4,
                fear: 0.3,
                sadness: 0.2,
              }
              return (
                sum +
                (dominanceMap[emotion.type.toLowerCase()] || 0.5) *
                  emotion.intensity
              )
            }, 0) / analysis.emotions.length

          updateEmotionState({
            valence,
            energy,
            dominance,
            timestamp: Date.now(),
          })
        }

        return analysis
      } catch (error: unknown) {
        logger.error('Error detecting emotions:', error)
        return null
      }
    },
    [updateEmotionState],
  )

  return { detectEmotions }
}
