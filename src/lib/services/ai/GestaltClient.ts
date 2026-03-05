/**
 * Gestalt Client for interacting with the Python Gestalt Fusion Engine.
 */

import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

const logger = createBuildSafeLogger('gestalt-client')

export interface DialogueTurn {
  speaker: string
  text: string
}

export interface GestaltAnalysisRequest {
  dialogue: DialogueTurn[]
  target_utterance: string
  plutchik_scores: Record<string, number>
  ocean_scores: Record<string, number>
  max_turns?: number
}

export interface GestaltAnalysisResponse {
  defense_label: number
  defense_label_name: string
  defense_confidence: number
  defense_maturity: number | null
  defense_probabilities: Record<string, number>

  plutchik_scores: Record<string, number>
  dominant_emotion: string
  dominant_emotion_intensity: number

  ocean_scores: Record<string, number>

  crisis_level: string
  behavioral_prediction: string
  persona_directive: string
  breakthrough_score: number
}

const PIXEL_API_URL = process.env.PIX_API_URL || 'http://localhost:8001'

export class GestaltClient {
  /**
   * Fuse psychological signals via the Gestalt Engine API.
   */
  static async analyzeGestalt(
    request: GestaltAnalysisRequest,
  ): Promise<GestaltAnalysisResponse> {
    try {
      const response = await fetch(`${PIXEL_API_URL}/analyze/gestalt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Gestalt API error (${response.status}): ${errorText}`)
      }

      return (await response.json()) as GestaltAnalysisResponse
    } catch (error) {
      logger.error('Failed to call Gestalt API', { error })
      throw error
    }
  }

  /**
   * Reset the Gestalt session.
   */
  static async resetSession(): Promise<void> {
    try {
      const response = await fetch(`${PIXEL_API_URL}/analyze/gestalt/reset`, {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error(`Gestalt reset failed: ${response.status}`)
      }
    } catch (error) {
      logger.error('Failed to reset Gestalt session', { error })
    }
  }
}
