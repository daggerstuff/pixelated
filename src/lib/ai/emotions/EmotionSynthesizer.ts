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
  | 'therapist_empathizes'
  | 'patient_shares_positive'
  | 'patient_shares_negative'
  | 'patient_discusses_trauma'
  | 'patient_resists'
  | 'goal_achieved'
  | 'setback_experienced'
  | 'session_start'
  | 'session_end'
  | 'general_conversation'

export interface SynthesisOptions {
  targetEmotion: string
  intensity: number
  duration?: number
  blendWithExisting?: boolean
}

export interface EnhancedSynthesisOptions {
  baseEmotion?: string
  baseIntensity?: number
  currentEmotions?: Record<string, number>
  context?: EmotionTransitionContext | string
  decayFactor?: number
  contextInfluence?: number
  randomFluctuation?: number
}

export interface SynthesisResult {
  profile: EmotionProfile
  success: boolean
  message: string
}

export class EmotionSynthesizer {
  private static instance: EmotionSynthesizer | null = null
  private currentProfile: EmotionProfile | null = null

  private constructor() {
    logger.info('EmotionSynthesizer initialized')
  }

  public static getInstance(): EmotionSynthesizer {
    if (!EmotionSynthesizer.instance) {
      EmotionSynthesizer.instance = new EmotionSynthesizer()
    }
    return EmotionSynthesizer.instance
  }

  public static createTestInstance(): EmotionSynthesizer {
    return new EmotionSynthesizer()
  }

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

  public static resetInstance() {
    EmotionSynthesizer.instance = null
  }

  async synthesizeEmotion(options: EnhancedSynthesisOptions): Promise<SynthesisResult> {
    try {
      logger.debug('Synthesizing emotion with enhanced options', { options })
      const {
        currentEmotions,
        baseEmotion,
        baseIntensity = 0.7,
        context = 'general_conversation',
        decayFactor = 0.85,
        contextInfluence = 0.1,
        randomFluctuation = 0.02,
      } = options

      let newEmotions = currentEmotions ? { ...currentEmotions } : { ...this.getDefaultProfile().emotions }

      for (const key in newEmotions) {
        newEmotions[key] = (newEmotions[key] ?? 0) * decayFactor
        if (randomFluctuation) {
          const noise = (Math.random() - 0.5) * 2 * randomFluctuation
          newEmotions[key] = Math.max(0, Math.min(1, (newEmotions[key] ?? 0) + noise))
        }
      }

      if (baseEmotion && Object.hasOwn(newEmotions, baseEmotion)) {
        newEmotions[baseEmotion] = Math.max(newEmotions[baseEmotion] ?? 0, baseIntensity)
      } else if (baseEmotion) {
        newEmotions[baseEmotion] = baseIntensity
      }

      // Placeholder for Contextual influence (heuristic-based)
      // ...

      for (const key in newEmotions) {
        newEmotions[key] = Math.max(0, Math.min(1, newEmotions[key] ?? 0))
      }

      if (
        Object.entries(newEmotions).some(([key, value]) => key !== 'neutral' && value > 0.05)
      ) {
        delete newEmotions['neutral']
      }

      const profile: EmotionProfile = {
        id: `emotion-${Date.now()}`,
        emotions: newEmotions,
        timestamp: Date.now(),
        confidence: 0.75 + Math.random() * 0.2,
      }

      this.currentProfile = profile
      return { profile, success: true, message: 'Emotion synthesized successfully' }
    } catch (error: unknown) {
      logger.error('Error synthesizing emotion', { error })
      return {
        profile: this.getDefaultProfile(),
        success: false,
        message: `Failed to synthesize emotion: ${error}`,
      }
    }
  }

  getCurrentProfile(): EmotionProfile | null {
    return this.currentProfile
  }

  reset() {
    this.currentProfile = null
    logger.debug('EmotionSynthesizer reset')
  }

  getDefaultEmotionProfile(): EmotionProfile {
    return this.getDefaultProfile()
  }

  /**
   * Wraps a raw emotion intensity map into a single `EmotionProfile` instance.
   * This is used to create a synthesized emotional state from a provided set of emotion
   * intensities, assigning a new time-based identifier, timestamp, and a default confidence
   * score of 0.8. The resulting profile also becomes the new current active state.
   *
   * @param emotions - A record of emotion keys to their raw intensity values.
   * @returns A newly created `EmotionProfile` object representing the given state.
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
    return EmotionSynthesizer.getDefaultProfile()
  }
}