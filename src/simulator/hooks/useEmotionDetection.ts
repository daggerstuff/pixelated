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
 * updates the SimulatorContext's emotion state (for example, via its `dispatch` function,
 * which dispatches the `UPDATE_EMOTION_STATE` action) using the dimension-based VED
 * (Valence-Energy-Dominance) values returned by the model. Note that the `energy`
 * dimension is equivalent to the `arousal` dimension in the PAD model.
 *
 * It is primarily used to track real-time emotional shifts during a simulated session.
 */
export const useEmotionDetection = () => {
  const providerRef = useRef&lt;EmotionLlamaProvider | null&gt;(null)
  const { dispatch } = useSimulatorContext()

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
   * Uses the pre-computed VED (Valence-Energy-Dominance) values from the EmotionLlamaProvider's
   * dimensional analysis, which maps categorical emotions to continuous VED scale values.
   * Note that the `energy` dimension is equivalent to the `arousal` dimension in the PAD model.
   *
   * @param text - The user input or transcript text to analyze.
   * @returns A promise that resolves to the emotion analysis payload from the provider, or null if the provider is not initialized or if the analysis fails.
   */
  const detectEmotions = useCallback(
    async (text: string): Promise&lt;EmotionAnalysis | null&gt; => {
      try {
        if (!providerRef.current) {
          logger.error('EmotionLlamaProvider not initialized')
          return null
        }
        const analysis = await providerRef.current.analyzeEmotions(text)
        // Update the simulator context with the pre-computed VED emotion state from dimensions
        if (analysis.dimensions) {
          const { valence, energy, dominance } = analysis.dimensions
          dispatch({
            type: 'UPDATE_EMOTION_STATE',
            payload: { valence, energy, dominance, timestamp: Date.now() },
          })
        }
        return analysis
      } catch (error: unknown) {
        logger.error('Error detecting emotions:', error)
        return null
      }
    },
    [dispatch],
  )

  return { detectEmotions }
}