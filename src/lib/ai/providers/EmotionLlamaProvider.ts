/**
 * EmotionLlamaProvider - LLaMA-based emotion analysis provider
 *
 * This provider uses LLaMA models for sophisticated emotion detection and analysis,
 * with support for FHE encryption and multidimensional emotion mapping.
 */

import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import type {
  EmotionAnalysis,
  EmotionVector,
  EmotionDimensions,
  EmotionMetadata,
} from '../emotions/types'
import type { FHESystem } from '../../fhe/index'
import { v4 as uuidv4 } from 'uuid'

const logger = createBuildSafeLogger('EmotionLlamaProvider')

export interface EmotionDetectionResult {
  emotions: Array<{
    type: string
    intensity: number
    confidence: number
  }>
  dimensions: EmotionDimensions
  confidence: number
  metadata: EmotionMetadata
}

/**
 * EmotionLlamaProvider class for LLaMA-based emotion analysis
 */
export class EmotionLlamaProvider {
  private baseUrl: string
  private apiKey: string
  private fheService: FHESystem
  private modelVersion = 'llama-emotion-v1.0'

  constructor(baseUrl: string, apiKey: string, fheService: FHESystem) {
    this.baseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.apiKey = apiKey
    this.fheService = fheService

    logger.info('EmotionLlamaProvider initialized', {
      baseUrl: this.baseUrl,
      modelVersion: this.modelVersion,
    })
  }

  /**
   * Analyze emotions in text using LLaMA model
   */
  async analyzeEmotions(text: string): Promise<EmotionAnalysis> {
    const startTime = Date.now()

    try {
      // Handle empty or whitespace-only inputs (optimization from roadmap)
      if (!text || text.trim().length === 0) {
        logger.debug('Empty input provided, returning neutral emotion analysis')
        return this.createNeutralAnalysis(startTime)
      }

      logger.debug('Analyzing emotions for text', { textLength: text.length })

      // Encrypt the text using FHE
      const encryptedText = await this.fheService.encrypt(text)

      // Prepare the request payload
      const payload = {
        text: encryptedText,
        model: this.modelVersion,
        analysis_type: 'multidimensional',
        return_confidence: true,
        return_dimensions: true,
      }

      // Make API request to LLaMA emotion analysis endpoint
      const response = await fetch(`${this.baseUrl}/analyze/emotions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Model-Version': this.modelVersion,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        logger.warn(
          'LLaMA API request failed, falling back to local analysis',
          {
            status: response.status,
            statusText: response.statusText,
          },
        )
        // Track fallback metrics
        const { emotionMetrics } = await import('../../sentry/utils')
        emotionMetrics.analysisPerformed({
          model: this.modelVersion,
          success: false,
        })
        return this.fallbackAnalysis(text, startTime)
      }

      const result = (await response.json()) as any

      // Decrypt and process the response
      const decryptedResult = await this.processEncryptedResponse(result)

      // Convert to standardized format
      const analysis = this.convertToEmotionAnalysis(decryptedResult, text, startTime)
      const totalDurationMs = Date.now() - startTime

      // Track successful analysis metrics
      const { emotionMetrics } = await import('../../sentry/utils')
      emotionMetrics.analysisPerformed({
        model: this.modelVersion,
        success: true,
      })
      emotionMetrics.analysisLatency(totalDurationMs, this.modelVersion)

      return analysis
    } catch (error: unknown) {
      logger.error('Error in emotion analysis', { error })

      // Track error metrics
      const { emotionMetrics } = await import('../../sentry/utils')
      emotionMetrics.analysisPerformed({
        model: this.modelVersion,
        success: false,
      })

      // Fallback to local analysis
      return this.fallbackAnalysis(text, startTime)
    }
  }

  /**
   * Process encrypted response from LLaMA API
   */
  private async processEncryptedResponse(
    encryptedResult: any,
  ): Promise<EmotionDetectionResult> {
    try {
      // Decrypt the emotion analysis result
      const decryptedEmotions = await this.fheService.decrypt(
        encryptedResult.emotions,
      )
      const decryptedDimensions = await this.fheService.decrypt(
        encryptedResult.dimensions,
      )

      return {
        emotions: JSON.parse(decryptedEmotions),
        dimensions: JSON.parse(decryptedDimensions),
        confidence: encryptedResult.confidence || 0.8,
        metadata: encryptedResult.metadata || {},
      }
    } catch (error: unknown) {
      logger.error('Error processing encrypted response', { error })
      throw new Error('Failed to decrypt emotion analysis response', { cause: error })
    }
  }

  /**
   * Fallback local emotion analysis when API is unavailable
   */
  private async fallbackAnalysis(
    text: string,
    startTime: number,
  ): Promise<EmotionAnalysis> {
    logger.info('Using fallback local emotion analysis')

    // Simple keyword-based emotion detection for fallback
    const emotions = this.detectEmotionsLocally(text)
    const dimensions = this.calculateDimensions(emotions)

    const processingTime = Date.now() - startTime

    return {
      id: uuidv4(),
      sessionId: this.generateSessionId(),
      timestamp: new Date().toISOString(),
      emotions: this.convertEmotionArrayToVector(emotions),
      dimensions,
      confidence: 0.6, // Lower confidence for fallback
      metadata: {
        source: 'text',
        processingTime,
        modelVersion: 'fallback-v1.0',
        confidence: {
          overall: 0.6,
          perEmotion: this.calculatePerEmotionConfidence(emotions),
        },
      },
    }
  }

  /**
   * Create neutral emotion analysis for empty inputs
   */
  private createNeutralAnalysis(startTime: number): EmotionAnalysis {
    const processingTime = Date.now() - startTime

    return {
      id: uuidv4(),
      sessionId: this.generateSessionId(),
      timestamp: new Date().toISOString(),
      emotions: {
        joy: 0,
        sadness: 0,
        anger: 0,
        fear: 0,
        surprise: 0,
        disgust: 0,
        trust: 0.5, // Slight trust for neutral state
        anticipation: 0,
      },
      dimensions: {
        valence: 0,
        arousal: 0,
        dominance: 0,
      },
      confidence: 1.0, // High confidence for neutral analysis
      metadata: {
        source: 'text',
        processingTime,
        modelVersion: this.modelVersion,
        confidence: {
          overall: 1.0,
          perEmotion: {
            joy: 1.0,
            sadness: 1.0,
            anger: 1.0,
            fear: 1.0,
            surprise: 1.0,
            disgust: 1.0,
            trust: 1.0,
            anticipation: 1.0,
          },
        },
      },
    }
  }

  /**
   * Convert API result to EmotionAnalysis format
   */
  private convertToEmotionAnalysis(
    result: EmotionDetectionResult,
    originalText: string,
    startTime: number,
  ): EmotionAnalysis {
    const processingTime = Date.now() - startTime

    return {
      id: uuidv4(),
      sessionId: this.generateSessionId(),
      timestamp: new Date().toISOString(),
      emotions: this.convertEmotionArrayToVector(result.emotions),
      dimensions: result.dimensions,
      confidence: result.confidence,
      metadata: {
        source: 'text',
        processingTime,
        modelVersion: this.modelVersion,
        confidence: {
          overall: result.confidence,
          perEmotion: this.calculatePerEmotionConfidence(result.emotions),
        },
      },
    }
  }

  /**
   * Convert emotion array to EmotionVector format
   */
  private convertEmotionArrayToVector(
    emotions: Array<{ type: string; intensity: number }>,
  ): EmotionVector {
    const vector: EmotionVector = {
      joy: 0,
      sadness: 0,
      anger: 0,
      fear: 0,
      surprise: 0,
      disgust: 0,
      trust: 0,
      anticipation: 0,
    }

    // Map emotion types to vector properties
    emotions.forEach((emotion) => {
      const normalizedType = emotion.type.toLowerCase()

      // Handle various emotion type mappings
      if (
        normalizedType.includes('joy') ||
        normalizedType.includes('happiness')
      ) {
        vector.joy = Math.max(vector.joy, emotion.intensity)
      } else if (normalizedType.includes('sad')) {
        vector.sadness = Math.max(vector.sadness, emotion.intensity)
      } else if (
        normalizedType.includes('anger') ||
        normalizedType.includes('mad')
      ) {
        vector.anger = Math.max(vector.anger, emotion.intensity)
      } else if (
        normalizedType.includes('fear') ||
        normalizedType.includes('afraid')
      ) {
        vector.fear = Math.max(vector.fear, emotion.intensity)
      } else if (normalizedType.includes('surprise')) {
        vector.surprise = Math.max(vector.surprise, emotion.intensity)
      } else if (normalizedType.includes('disgust')) {
        vector.disgust = Math.max(vector.disgust, emotion.intensity)
      } else if (normalizedType.includes('trust')) {
        vector.trust = Math.max(vector.trust, emotion.intensity)
      } else if (
        normalizedType.includes('anticipation') ||
        normalizedType.includes('excitement')
      ) {
        vector.anticipation = Math.max(vector.anticipation, emotion.intensity)
      }
    })

    return vector
  }

  /**
   * Local emotion detection using keyword analysis
   */
  private detectEmotionsLocally(
    text: string,
  ): Array<{ type: string; intensity: number; confidence: number }> {
    const lowercaseText = text.toLowerCase()
    const emotions: Array<{
      type: string
      intensity: number
      confidence: number
    }> = []

    // Emotion keyword patterns
    const emotionPatterns = {
      joy: [
        'happy',
        'joy',
        'pleased',
        'delighted',
        'excited',
        'cheerful',
        'glad',
      ],
      sadness: [
        'sad',
        'depressed',
        'down',
        'unhappy',
        'grief',
        'sorrow',
        'melancholy',
      ],
      anger: [
        'angry',
        'mad',
        'furious',
        'irritated',
        'frustrated',
        'annoyed',
        'rage',
      ],
      fear: [
        'afraid',
        'scared',
        'fearful',
        'terrified',
        'anxious',
        'worried',
        'nervous',
      ],
      surprise: ['surprised', 'amazed', 'shocked', 'astonished', 'unexpected'],
      disgust: ['disgusted', 'revolted', 'repulsed', 'sickened', 'appalled'],
      trust: ['trust', 'confident', 'secure', 'safe', 'reliable', 'believe'],
      anticipation: [
        'excited',
        'eager',
        'anticipating',
        'looking forward',
        'hopeful',
      ],
    }

    // Analyze text for emotion indicators
    for (const [emotionType, keywords] of Object.entries(emotionPatterns)) {
      let score = 0
      let matches = 0

      for (const keyword of keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
        const keywordMatches = lowercaseText.match(regex)
        if (keywordMatches) {
          matches += keywordMatches.length
          score += keywordMatches.length * 0.2
        }
      }

      if (score > 0) {
        emotions.push({
          type: emotionType,
          intensity: Math.min(score, 1.0), // Cap at 1.0
          confidence: Math.min(matches * 0.3, 1.0),
        })
      }
    }

    // If no emotions detected, add neutral
    if (emotions.length === 0) {
      emotions.push({
        type: 'trust', // Use trust as neutral baseline
        intensity: 0.5,
        confidence: 0.8,
      })
    }

    return emotions
  }

  /**
   * Calculate dimensional values from emotions
   */
  private calculateDimensions(
    emotions: Array<{ type: string; intensity: number }>,
  ): EmotionDimensions {
    // Emotion dimension mappings (Russell's Circumplex Model)
    const dimensionMappings = {
      joy: { valence: 0.8, arousal: 0.6, dominance: 0.6 },
      sadness: { valence: -0.8, arousal: 0.2, dominance: -0.4 },
      anger: { valence: -0.6, arousal: 0.9, dominance: 0.8 },
      fear: { valence: -0.7, arousal: 0.8, dominance: -0.6 },
      surprise: { valence: 0.1, arousal: 0.9, dominance: 0.0 },
      disgust: { valence: -0.8, arousal: 0.4, dominance: 0.2 },
      trust: { valence: 0.6, arousal: 0.3, dominance: 0.4 },
      anticipation: { valence: 0.4, arousal: 0.7, dominance: 0.3 },
    }

    let totalValence = 0
    let totalArousal = 0
    let totalDominance = 0
    let totalWeight = 0

    emotions.forEach((emotion) => {
      const mapping =
        dimensionMappings[emotion.type as keyof typeof dimensionMappings]
      if (mapping) {
        const weight = emotion.intensity
        totalValence += mapping.valence * weight
        totalArousal += mapping.arousal * weight
        totalDominance += mapping.dominance * weight
        totalWeight += weight
      }
    })

    // Normalize by total weight
    if (totalWeight > 0) {
      return {
        valence: totalValence / totalWeight,
        arousal: totalArousal / totalWeight,
        dominance: totalDominance / totalWeight,
      }
    }

    // Default neutral dimensions
    return { valence: 0, arousal: 0, dominance: 0 }
  }

  /**
   * Calculate per-emotion confidence scores
   */
  private calculatePerEmotionConfidence(
    emotions: Array<{ type: string; intensity: number; confidence?: number }>,
  ): Record<keyof EmotionVector, number> {
    const confidenceMap: Record<keyof EmotionVector, number> = {
      joy: 0.5,
      sadness: 0.5,
      anger: 0.5,
      fear: 0.5,
      surprise: 0.5,
      disgust: 0.5,
      trust: 0.5,
      anticipation: 0.5,
    }

    emotions.forEach((emotion) => {
      const normalizedType = emotion.type.toLowerCase()
      const confidence = emotion.confidence || 0.7

      if (
        normalizedType.includes('joy') ||
        normalizedType.includes('happiness')
      ) {
        confidenceMap.joy = Math.max(confidenceMap.joy, confidence)
      } else if (normalizedType.includes('sad')) {
        confidenceMap.sadness = Math.max(confidenceMap.sadness, confidence)
      } else if (normalizedType.includes('anger')) {
        confidenceMap.anger = Math.max(confidenceMap.anger, confidence)
      } else if (normalizedType.includes('fear')) {
        confidenceMap.fear = Math.max(confidenceMap.fear, confidence)
      } else if (normalizedType.includes('surprise')) {
        confidenceMap.surprise = Math.max(confidenceMap.surprise, confidence)
      } else if (normalizedType.includes('disgust')) {
        confidenceMap.disgust = Math.max(confidenceMap.disgust, confidence)
      } else if (normalizedType.includes('trust')) {
        confidenceMap.trust = Math.max(confidenceMap.trust, confidence)
      } else if (normalizedType.includes('anticipation')) {
        confidenceMap.anticipation = Math.max(
          confidenceMap.anticipation,
          confidence,
        )
      }
    })

    return confidenceMap
  }

  /**
   * Generate session ID (this should ideally come from context)
   */
  private generateSessionId(): string {
    // In a real implementation, this would come from the session context
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}
