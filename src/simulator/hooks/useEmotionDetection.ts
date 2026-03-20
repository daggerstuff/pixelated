import { useCallback, useEffect, useRef } from 'react'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import type { EmotionAnalysis } from '../../lib/ai/emotions/types'
import { EmotionLlamaProvider } from '../../lib/ai/providers/EmotionLlamaProvider'
import { fheService } from '@/lib/fhe'
import { useSimulatorContext } from '../context/SimulatorContext'

const logger = createBuildSafeLogger('useEmotionDetection')

// Action type for updating emotion state
const UPDATE_EMOTION_STATE = 'UPDATE_EMOTION_STATE'

/**
 * Hook to detect and track emotional states in real-time.
 *
 * Uses the PAD (Pleasure-Arousal-Dominance) emotional state model to map
 * categorical emotions from the AI provider into continuous dimensional
 * coordinates (valence, energy, dominance). This allows for fluid,
 * continuous state tracking in the simulator context rather than
 * discrete emotional jumps.
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

        // Update the simulator context with the new emotion state
        if (analysis.emotions.length > 0) {
          // Calculate valence (positive/negative sentiment)
          const valence = analysis.emotions.reduce((sum, emotion) => {
            const valenceMap: Record<string, number> = {
              joy: 1,
              sadness: -1,
              anger: -0.9,
              fear: -0.8,
              surprise: 0.3,
              disgust: -0.8,
              trust: 0.7,
              anticipation: 0.6,
            }
            return (
              sum +
              (valenceMap[emotion.type.toLowerCase()] || 0) * emotion.intensity
            )
          }, 0) / analysis.emotions.length

          // Calculate energy/arousal level
          const energy = analysis.emotions.reduce((sum, emotion) => {
            const energyMap: Record<string, number> = {
              anger: 0.9,
              joy: 0.8,
              fear: 0.6,
              sadness: 0.3,
              surprise: 0.8,
              disgust: 0.7,
              trust: 0.5,
              anticipation: 0.6,
            }
            return (
              sum +
              (energyMap[emotion.type.toLowerCase()] || 0.5) * emotion.intensity
            )
          }, 0) / analysis.emotions.length

          // Calculate dominance
          const dominance = analysis.emotions.reduce((sum, emotion) => {
            const dominanceMap: Record<string, number> = {
              anger: 0.9,
              joy: 0.8,
              fear: 0.3,
              sadness: 0.2,
              surprise: 0.5,
              disgust: 0.3,
              trust: 0.7,
              anticipation: 0.6,
            }
            return (
              sum +
              (dominanceMap[emotion.type.toLowerCase()] || 0.5) *
                emotion.intensity
            )
          }, 0) / analysis.emotions.length

          dispatch({
            type: UPDATE_EMOTION_STATE,
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