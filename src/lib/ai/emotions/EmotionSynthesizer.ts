import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const logger = createBuildSafeLogger('default')

export interface EmotionProfile {
  id: string
  emotions: Record<string, number>
  timestamp: number
  confidence: number
}

export type EmotionTransitionContext =
  | 'therapist_validates'
  | 'therapist_challenges'
  | 'therapist_reflects'
  | 'therapist_neutral'
  | 'therapist_empathizes' // Added for more nuance
  | 'patient_shares_positive'
  | 'patient_shares_negative'
  | 'patient_discusses_trauma'
  | 'patient_resists'
  | 'goal_achieved'
  | 'setback_experienced'
  | 'session_start'
  | 'session_end'
  | 'general_conversation' // Default context

export interface SynthesisOptions {
  // Original options
  targetEmotion: string // Primary emotion to influence
  intensity: number // Desired intensity of the targetEmotion (0-1)
  duration?: number // How long this emotion might conceptually last (not directly used yet)
  blendWithExisting?: boolean // Hint for blending (true by default in new logic)
}

export interface EnhancedSynthesisOptions {
  baseEmotion?: string // Optional: a primary emotion to focus on, similar to old targetEmotion
  baseIntensity?: number // Optional: intensity for the baseEmotion
  currentEmotions?: Record<string, number> // Current full emotional state of the patient
  context?: EmotionTransitionContext | string // Context of the interaction
  decayFactor?: number // How much existing emotions should decay (e.g., 0.9 means they retain 90%)
  contextInfluence?: number // How much the context should influence new emotion (0-1, e.g., 0.2 for 20% influence)
  randomFluctuation?: number // Small random factor to add liveness (e.g., 0.05 for +/-5% noise)
}

export interface SynthesisResult {
  profile: EmotionProfile
  success: boolean
  message: string
}

/**
 * Emotion Synthesizer - Creates and manipulates emotional profiles
 * Implements singleton pattern for consistent state management across the application
 */
export class EmotionSynthesizer {
  private static instance: EmotionSynthesizer | null = null
  private currentProfile: EmotionProfile | null = null

  private constructor() {
    logger.info('EmotionSynthesizer initialized')
  }

  /**
   * Get the singleton instance of EmotionSynthesizer
   * @returns The singleton instance
   */
  public static getInstance(): EmotionSynthesizer {
    if (!EmotionSynthesizer.instance) {
      EmotionSynthesizer.instance = new EmotionSynthesizer()
    }
    return EmotionSynthesizer.instance
  }

  /**
   * Create a new instance for testing purposes
   * @returns A new instance (not the singleton)
   */
  public static createTestInstance(): EmotionSynthesizer {
    return new EmotionSynthesizer()
  }

  /**
   * Get a default emotion profile without needing an instance
   * This is a convenience method that maintains proper encapsulation
   * @returns A fresh default emotion profile
   */
  public static getDefaultProfile(): EmotionProfile {
    return {
      id: 'default-neutral',
      emotions: {
        neutral: 1.0,
        joy: 0,
        sadness: 0,
        anger: 0,
        fear: 0,
        surprise: 0,
        disgust: 0,
      },
      timestamp: Date.now(),
      confidence: 1.0,
    }
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  public static resetInstance() {
    EmotionSynthesizer.instance = null
  }

  /**
   * Synthesize a new emotion profile based on current state, context, and target influences.
   */
  async synthesizeEmotion(
    options: EnhancedSynthesisOptions,
  ): Promise<SynthesisResult> {
    try {
      logger.debug('Synthesizing emotion with enhanced options', { options })

      const {
        currentEmotions,
        baseEmotion,
        baseIntensity = 0.7, // Default intensity if a baseEmotion is provided
        context = 'general_conversation',
        decayFactor = 0.85, // Emotions retain 85% of intensity by default per step
        contextInfluence = 0.1, // Context has a 10% influence on shifts by default
        randomFluctuation = 0.02, // Tiny bit of noise
      } = options

      let newEmotions = currentEmotions
        ? { ...currentEmotions }
        : { ...this.getDefaultProfile().emotions }

      // 1. Decay existing emotions
      for (const key in newEmotions) {
        newEmotions[key] = (newEmotions[key] ?? 0) * decayFactor
        // Add slight random fluctuation to make it feel more alive, keep it small
        if (randomFluctuation) {
          const noise = (Math.random() - 0.5) * 2 * randomFluctuation // between -randomFluctuation and +randomFluctuation
          newEmotions[key] = Math.max(
            0,
            Math.min(1, (newEmotions[key] ?? 0) + noise),
          )
        }
      }

      // 2. Apply baseEmotion influence (if provided)
      // This is like the old 'targetEmotion' but blends more smoothly.
      if (baseEmotion && Object.hasOwn(newEmotions, baseEmotion)) {
        newEmotions[baseEmotion] = Math.max(
          newEmotions[baseEmotion] ?? 0,
          baseIntensity,
        )
        // Could also blend: (newEmotions[baseEmotion] * (1-baseIntensity)) + baseIntensity
      } else if (baseEmotion) {
        // If baseEmotion is not in current profile (e.g. 'neutral' from default), add it.
        newEmotions[baseEmotion] = baseIntensity
      }

      // 3. Placeholder for Contextual influence (heuristic-based)
      // This part will need more detailed rules based on EmotionTransitionContext
      // Example:
      if (context === 'therapist_validates') {
        newEmotions['joy'] = Math.min(
          1,
          (newEmotions['joy'] ?? 0) + 0.1 * contextInfluence,
        )
        newEmotions['sadness'] = Math.max(
          0,
          (newEmotions['sadness'] ?? 0) - 0.05 * contextInfluence,
        )
        newEmotions['anger'] = Math.max(
          0,
          (newEmotions['anger'] ?? 0) - 0.05 * contextInfluence,
        )
      } else if (context === 'patient_discusses_trauma') {
        newEmotions['sadness'] = Math.min(
          1,
          (newEmotions['sadness'] ?? 0) + 0.2 * contextInfluence,
        )
        newEmotions['fear'] = Math.min(
          1,
          (newEmotions['fear'] ?? 0) + 0.15 * contextInfluence,
        )
        newEmotions['joy'] = Math.max(
          0,
          (newEmotions['joy'] ?? 0) - 0.1 * contextInfluence,
        )
      }
      // ... more context rules to be added

      // Normalize emotions if needed (e.g., if sum > 1, or ensure one primary emotion)
      // For now, just clamp individual emotions between 0 and 1
      for (const key in newEmotions) {
        newEmotions[key] = Math.max(0, Math.min(1, newEmotions[key] ?? 0))
      }

      // Remove 'neutral' if other emotions are present and significant
      // Remove 'neutral' if any other emotion is significant
      if (
        Object.entries(newEmotions).some(
          ([key, value]) => key !== 'neutral' && value > 0.05,
        )
      ) {
        delete newEmotions['neutral']
      }

      const profile: EmotionProfile = {
        id: `emotion-${Date.now()}`,
        emotions: newEmotions,
        timestamp: Date.now(),
        confidence: 0.75 + Math.random() * 0.2, // Confidence might be more stable or context-dependent
      }

      this.currentProfile = profile // Update internal cache

      return {
        profile,
        success: true,
        message: 'Emotion synthesized successfully',
      }
    } catch (error: unknown) {
      logger.error('Error synthesizing emotion', { error })
      return {
        profile: this.getDefaultProfile(),
        success: false,
        message: `Failed to synthesize emotion: ${error}`,
      }
    }
  }

  /**
   * Get current emotion profile
   */
  getCurrentProfile(): EmotionProfile | null {
    return this.currentProfile
  }

  /**
   * Reset to neutral emotional state
   */
  reset() {
    this.currentProfile = null
    logger.debug('EmotionSynthesizer reset')
  }

  /**
   * Get the default emotion profile
   * This provides a public way to access the default neutral emotional state
   * IMPORTANT: This is the ONLY public way to access the default profile.
   * Do NOT use bracket notation or try to access the private getDefaultProfile() method.
   */
  getDefaultEmotionProfile(): EmotionProfile {
    return this.getDefaultProfile()
  }

  /**
   * Blend multiple emotions together
   */
  blendEmotions(emotions: Record<string, number>): EmotionProfile {
    const profile: EmotionProfile = {
      id: `blend-${Date.now()}`,
      emotions,
      timestamp: Date.now(),
      confidence: 0.8,
    }

    this.currentProfile = profile
    return profile
  }

  private getDefaultProfile(): EmotionProfile {
    // Delegate to the static method to avoid code duplication
    return EmotionSynthesizer.getDefaultProfile()
  }
}
