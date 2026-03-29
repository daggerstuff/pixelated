import { useCallback, useEffect, useRef } from 'react'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import type { EmotionAnalysis } from '../../lib/ai/emotions/types'
import { EmotionLlamaProvider } from '../../lib/ai/providers/EmotionLlamaProvider'
import { fheService } from '@/lib/fhe'
import { useSimulatorContext } from '../context/SimulatorContext'

const logger = createBuildSafeLogger('useEmotionDetection')

/**
 * Hook for initializing and interacting with the EmotionLlamaProvider.
 *
 * This hook sets up a connection to the Emotion Llama API (with credentials
 * injected from the environment) and exposes a `detectEmotions` method. When called,
 * it runs the provider's emotional analysis on the provided text, and automatically
 * dispatches an `updateEmotionState` action to the SimulatorContext using the
 * dimension-based PAD (Pleasure-Arousal-Dominance) values returned by the model.
 *
 * It is primarily used to track real-time emotional shifts during a simulated session.
 */
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

    void initProvider()
  }, [])

  /**
   * Analyzes text for emotional content and updates the simulator context with a dimensional emotional state.
   * Uses the pre-computed PAD (Pleasure-Arousal-Dominance) values from the EmotionLlamaProvider's
   * dimensional analysis, which maps categorical emotions to continuous PAD scale values.
   *
   * @param text - The user input or transcript text to analyze.
   * @returns A promise that resolves to the emotion analysis payload from the provider, or null if the provider is not initialized or if the analysis fails.
   */
  const detectEmotions = useCallback(
    async (text: string): Promise<EmotionAnalysis | null> => {
      try {
        if (!providerRef.current) {
          logger.error('EmotionLlamaProvider not initialized')
          return null
        }

        const analysis = await providerRef.current.analyzeEmotions(text)

        // Update the simulator context with the pre-computed PAD emotion state from dimensions
        if (analysis.dimensions) {
          const { valence, energy, dominance } = analysis.dimensions
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

  return {
    detectEmotions,
  }
}