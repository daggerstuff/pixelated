/**
 * FeedbackService helpers — audio-message guards, TF loader, and emotion
 * feedback transforms extracted from FeedbackService.ts.
 */

import type { AudioProcessorMessage } from './FeedbackService.types'
import { TherapeuticTechnique, FeedbackType } from '../types'
import type { Scenario, RealTimeFeedback } from '../types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isAudioProcessorMessage(
  value: unknown,
): value is AudioProcessorMessage {
  if (!isRecord(value)) {
    return false
  }

  if (value['type'] !== 'audioData') {
    return false
  }

  return (
    value['data'] instanceof Float32Array &&
    isRecord(value['metadata']) &&
    typeof value['metadata']['timestamp'] === 'number'
  )
}

export function isTherapeuticTechnique(value: string): value is TherapeuticTechnique {
  return (Object.values(TherapeuticTechnique) as string[]).includes(value)
}
export function resolveSafeLlmBaseUrl(): string {
  return (
    process.env['LLM_BASE_URL'] ??
    process.env['LLM_API_URL'] ??
    process.env['OPENAI_BASE_URL'] ??
    'http://localhost:8000/v1'
  )
}

// Dynamic TensorFlow.js imports to reduce bundle size
export async function loadTensorFlow() {
  return await import('@tensorflow/tfjs')
}

export async function loadTensorFlowLayers() {
  return await import('@tensorflow/tfjs-layers')
}

export function generateEmotionFeedback(
  currentScenario: Scenario | null,
  emotionChange: 'positive' | 'negative' | 'neutral',
  currentApproach: TherapeuticTechnique | null,
): RealTimeFeedback {
  // Generate appropriate feedback based on emotional change direction
  const contextString = currentScenario?.domain ?? 'general'

  if (emotionChange === 'positive') {
    return {
      type: FeedbackType.EMPATHETIC_RESPONSE,
      timestamp: Date.now(),
      suggestion:
        "The client's emotional state appears to be shifting positively. Consider acknowledging this change.",
      rationale:
        'Recognizing positive emotional shifts reinforces progress and helps build therapeutic momentum.',
      priority: 'medium',
      context: contextString,
    }
  } else if (emotionChange === 'negative') {
    // If using cognitive restructuring during a negative shift, suggest validation
    if (currentApproach === TherapeuticTechnique.COGNITIVE_RESTRUCTURING) {
      return {
        type: FeedbackType.TECHNIQUE_APPLICATION,
        timestamp: Date.now(),
        suggestion:
          'The client may need validation before cognitive restructuring as their emotional state intensifies.',
        rationale:
          'Validation creates safety during heightened emotions, making clients more receptive to cognitive work later.',
        priority: 'high',
        context: contextString,
      }
    }

    return {
      type: FeedbackType.THERAPEUTIC_ALLIANCE,
      timestamp: Date.now(),
      suggestion:
        "The client's emotional intensity is increasing. Consider validating their experience before proceeding.",
      rationale:
        'Validation during emotional intensity strengthens the therapeutic alliance and models emotional acceptance.',
      priority: 'high',
      context: contextString,
    }
  } else {
    return {
      type: FeedbackType.QUESTION_FORMULATION,
      timestamp: Date.now(),
      suggestion:
        "Consider using a reflective statement to clarify the client's current emotional experience.",
      rationale:
        'Reflection helps clients articulate emotional experiences that may be difficult to express directly.',
      priority: 'low',
      context: contextString,
    }
  }
}

export function detectEmotionalChange(
  trends: Array<{ timestamp: number; energy: number; valence: number; dominance: number }>,): 'positive' | 'negative' | 'neutral' | null {
  // Need at least a few data points to detect change
  if (trends.length < 5) {
    return null
  }

  // Get recent trend data (last 5 points)
  const recentTrends = trends.slice(-5)

  // Ensure we have valid data
  if (recentTrends.length === 0) {
    return null
  }

  // Use linear regression to detect trend in valence
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0

  // Normalize timestamps relative to the first timestamp
  const baseTime = recentTrends[0].timestamp

  for (const trend of recentTrends) {
    const x = (trend.timestamp - baseTime) / 1000 // seconds
    const y = trend.valence

    sumX += x
    sumY += y
    sumXY += x * y
    sumXX += x * x
  }

  const n = recentTrends.length

  // Calculate slope of the linear regression line
  const slope =
    n > 1 && n * sumXX - sumX * sumX !== 0
      ? (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
      : 0

  // Calculate energy change (volatility)
  let energyVolatility = 0
  for (let i = 1; i < recentTrends.length; i++) {
    const current = recentTrends[i]
    const previous = recentTrends[i - 1]
    energyVolatility += Math.abs(current.energy - previous.energy)
  }
  energyVolatility /= recentTrends.length - 1

  // Significant change thresholds
  const SLOPE_THRESHOLD = 0.02
  const ENERGY_VOLATILITY_THRESHOLD = 0.08

  // Determine if there's a significant change
  const significantChange =
    Math.abs(slope) > SLOPE_THRESHOLD ||
    energyVolatility > ENERGY_VOLATILITY_THRESHOLD

  if (!significantChange) {
    return null
  }

  // Classify the change
  if (slope > SLOPE_THRESHOLD / 2) {
    return 'positive'
  }
  if (slope < -SLOPE_THRESHOLD / 2) {
    return 'negative'
  }
  return 'neutral'
}
