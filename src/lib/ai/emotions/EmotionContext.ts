import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const logger = createBuildSafeLogger('default')
import type { EmotionProfile } from './EmotionSynthesizer'

export interface EmotionContextState {
  currentEmotion: EmotionProfile | null
  emotionHistory: EmotionProfile[]
  sessionId: string
  userId?: string | undefined
  lastUpdated: number
}

export interface EmotionTransition {
  from: EmotionProfile
  to: EmotionProfile
  trigger: string
  timestamp: number
  confidence: number
}

/**
 * Emotion Context - Manages emotional state and transitions over time
 */
export class EmotionContext {
  private state: EmotionContextState
  private transitions: EmotionTransition[] = []
  private maxHistorySize = 50

  constructor(sessionId: string, userId?: string) {
    this.state = {
      currentEmotion: null,
      emotionHistory: [],
      sessionId,
      userId,
      lastUpdated: Date.now(),
    }

    logger.info('EmotionContext initialized', { sessionId, userId })
  }

  /**
   * Update the current emotional state
   */
  updateEmotion(newEmotion: EmotionProfile, trigger: string = 'manual'): void {
    const previousEmotion = this.state.currentEmotion

    // Record transition if there was a previous emotion
    if (previousEmotion) {
      this.transitions.push({
        from: previousEmotion,
        to: newEmotion,
        trigger,
        timestamp: Date.now(),
        confidence: newEmotion.confidence,
      })
    }

    // Update current state
    this.state.currentEmotion = newEmotion
    this.state.emotionHistory.push(newEmotion)
    this.state.lastUpdated = Date.now()

    // Trim history if too large
    if (this.state.emotionHistory.length > this.maxHistorySize) {
      this.state.emotionHistory = this.state.emotionHistory.slice(
        -this.maxHistorySize,
      )
    }

    logger.debug('Emotion updated', {
      trigger,
      emotion: newEmotion.emotions,
      confidence: newEmotion.confidence,
    })
  }

  /**
   * Get current emotional state
   */
  getCurrentEmotion(): EmotionProfile | null {
    return this.state.currentEmotion
  }

  /**
   * Get emotion history
   */
  getEmotionHistory(): EmotionProfile[] {
    return [...this.state.emotionHistory]
  }

  /**
   * Get emotion transitions
   */
  getTransitions(): EmotionTransition[] {
    return [...this.transitions]
  }

  /**
   * Get current context state
   */
  getState(): EmotionContextState {
    return { ...this.state }
  }

  /**
   * Calculate dominant emotion over time period
   */
  getDominantEmotion(timeWindow: number = 300000): string | null {
    // 5 minutes default
    const cutoff = Date.now() - timeWindow
    const recentEmotions = this.state.emotionHistory.filter(
      (emotion) => emotion.timestamp >= cutoff,
    )

    if (recentEmotions.length === 0) {
      return null
    }

    const emotionSums: Record<string, number> = {}

    recentEmotions.forEach((profile) => {
      Object.entries(profile.emotions).forEach(([emotion, intensity]) => {
        emotionSums[emotion] = (emotionSums[emotion] || 0) + intensity
      })
    })

    const dominantEmotion = Object.entries(emotionSums).reduce(
      (max, [emotion, sum]) => (sum > max.sum ? { emotion, sum } : max),
      { emotion: '', sum: 0 },
    )

    return dominantEmotion.emotion || null
  }

  /**
   * Calculate emotional stability
   */
  getEmotionalStability(): number {
    if (this.transitions.length < 2) {
      return 1.0
    }

    const recentTransitions = this.transitions.slice(-10)
    let totalVariance = 0

    for (let i = 1; i < recentTransitions.length; i++) {
      const prev = recentTransitions[i - 1]
      const curr = recentTransitions[i]

      // Ensure both transitions exist before processing
      if (!prev || !curr) {
        continue
      }

      // Calculate emotional distance between states
      totalVariance += this.calculateEmotionalDistance(prev.to, curr.to)
    }

    const averageVariance =
      recentTransitions.length > 1
        ? totalVariance / (recentTransitions.length - 1)
        : 0
    return Math.max(0, 1 - averageVariance)
  }

  /**
   * Clear context and reset state
   */
  reset() {
    this.state = {
      currentEmotion: null,
      emotionHistory: [],
      sessionId: this.state.sessionId,
      userId: this.state.userId,
      lastUpdated: Date.now(),
    }
    this.transitions = []

    logger.info('EmotionContext reset')
  }

  private calculateEmotionalDistance(
    emotion1: EmotionProfile,
    emotion2: EmotionProfile,
  ): number {
    const emotions1 = emotion1.emotions
    const emotions2 = emotion2.emotions

    let distance = 0
    const allEmotions = new Set([
      ...Object.keys(emotions1),
      ...Object.keys(emotions2),
    ])

    for (const emotion of Array.from(allEmotions)) {
      const val1 = emotions1[emotion] || 0
      const val2 = emotions2[emotion] || 0
      distance += Math.abs(val1 - val2)
    }

    return distance / allEmotions.size
  }
}
