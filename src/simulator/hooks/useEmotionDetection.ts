import { useCallback, useEffect, useRef } from 'react'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import type { EmotionAnalysis } from '../../lib/ai/emotions/types'
import { EmotionLlamaProvider } from '../../lib/ai/providers/EmotionLlamaProvider'
import { fheService } from '@/lib/fhe'
import { useSimulatorContext } from '../context/SimulatorContext'

const logger = createBuildSafeLogger('useEmotionDetection')

/**
 * Custom hook to detect emotions from text and update the simulator's emotion state.
 *
 * Initializes the `EmotionLlamaProvider` to extract categorical emotions (e.g., joy, anger).
 * It maps these categorical emotions to continuous dimensional coordinates using the
 * PAD (Pleasure-Arousal-Dominance) emotional state model. The resulting `valence`
 * (pleasure/sentiment), `energy` (arousal), and `dominance` values are calculated as
 * the mean of each emotion's contribution (mapped from categorical to dimensional values,
 * weighted by intensity) — i.e., the intensity-weighted sum for each dimension divided by
 * the count of detected emotions — and used to update the global simulator context.
 *
 * @returns An object containing the `detectEmotions` function to analyze text inputs.
 */
export const useEmotionDetection = () => {
  const providerRef = useRef<EmotionLlamaProvider | null>(null)
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

  const detectEmotions = useCallback(
    async (text: string): Promise<EmotionAnalysis | null> => {
      try {
        if (!providerRef.current) {
          logger.error('EmotionLlamaProvider not initialized')
          return null
        }

        const analysis = await providerRef.current.analyzeEmotions(text)

        // Convert EmotionVector object to array of entries and filter for non-zero intensities
        const emotionEntries = Object.entries(analysis.emotions).filter(
          ([, intensity]) => intensity > 0,
        )

        // Update the simulator context with the new emotion state
        if (emotionEntries.length > 0) {
          // Calculate valence (positive/negative sentiment)
          const valence = emotionEntries.reduce((sum, [emotionType, intensity]) => {
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
              sum + (valenceMap[emotionType.toLowerCase()] || 0) * intensity
            )
          }, 0) / emotionEntries.length

          // Calculate energy/arousal level
          const energy = emotionEntries.reduce((sum, [emotionType, intensity]) => {
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
              sum + (energyMap[emotionType.toLowerCase()] || 0.5) * intensity
            )
          }, 0) / emotionEntries.length

          // Calculate dominance
          const dominance = emotionEntries.reduce((sum, [emotionType, intensity]) => {
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
              sum + (dominanceMap[emotionType.toLowerCase()] || 0.5) * intensity
            )
          }, 0) / emotionEntries.length

          dispatch({
            type: 'UPDATE_EMOTION_STATE',
            payload: {
              valence,
              energy,
              dominance,
              timestamp: Date.now(),
            },
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