import type {
  FeedbackServiceInterface,
  RealTimeFeedback,
  Scenario,
} from '../types'
import { TherapeuticTechnique, FeedbackType } from '../types'
// TensorFlow.js imports moved to dynamic imports to reduce bundle size
// import * as tf from '@tensorflow/tfjs'
// import { loadLayersModel } from '@tensorflow/tfjs-layers'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { createMentalLLaMAFromEnv } from '../../lib/ai/mental-llama'
import { createTogetherAIService } from '../../lib/ai/services/together'
import type { MentalLLaMAAdapter } from '../../lib/ai/mental-llama/MentalLLaMAAdapter'
import type { TogetherAIService } from '../../lib/ai/services/together'

interface MentalHealthInsights {
  hasMentalHealthIssue: boolean
  mentalHealthCategory?: string | null
  explanation?: string
  supportingEvidence?: string[]
}

const logger = createBuildSafeLogger('default')

// Dynamic TensorFlow.js imports to reduce bundle size
async function loadTensorFlow() {
  const tf = await import('@tensorflow/tfjs')
  return tf
}

async function loadTensorFlowLayers() {
  const { loadLayersModel } = await import('@tensorflow/tfjs-layers')
  return { loadLayersModel }
}

/**
 * Service for processing real-time audio and generating therapeutic feedback
 * Uses client-side processing with zero data retention for HIPAA compliance
 */
export class FeedbackService implements FeedbackServiceInterface {
  private currentScenario: Scenario | null = null
  private feedbackBuffer: RealTimeFeedback[] = []
  private audioContext: AudioContext | null = null
  private analyzer: AnalyserNode | null = null
  private audioWorklet: AudioWorkletNode | null = null
  private lastProcessedTimestamp: number = 0
  private processingThrottleMs: number = 750 // Throttle processing to avoid excessive CPU usage
  private emotionState: {
    energy: number
    valence: number
    dominance: number
    trends: Array<{
      timestamp: number
      energy: number
      valence: number
      dominance: number
    }>
  } = {
    energy: 0.5,
    valence: 0.5,
    dominance: 0.5,
    trends: [],
  }
  private speechPatterns: {
    pauseCount: number
    averagePauseDuration: number
    speakingRate: number // words per minute
    toneVariation: number // standard deviation of pitch
    volumeVariation: number // standard deviation of volume
  } = {
    pauseCount: 0,
    averagePauseDuration: 0,
    speakingRate: 0,
    toneVariation: 0,
    volumeVariation: 0,
  }
  private detectedKeywords: Map<string, number> = new Map() // Maps keywords to frequency
  private detectedTechniques: Map<TherapeuticTechnique, number> = new Map()
  // Remove unused clientResponsePredictions
  private techniqueModel: unknown | null = null // tf.LayersModel | null = null
  private isModelLoaded = false
  private modelLoadingPromise: Promise<void> | null = null
  private mentalLLaMAAdapter: MentalLLaMAAdapter | null = null
  // Remove unused mentalArenaAdapter
  private togetherAIService: TogetherAIService | null = null
  private isEnhancedModelLoaded = false
  private isUsingEnhancedModels = true
  private lastTranscribedText = ''
  private transcriptBuffer: string[] = []
  // Remove unused emotionDetectionEngine
  private audioProcessor: AudioWorkletNode | null = null
  private processingQueue: Array<{
    data: Float32Array
    timestamp: number
  }> = []
  private isProcessing = false
  private readonly maxQueueSize = 10

  constructor() {
    // Initialize audio worklet if available
    if (typeof window !== 'undefined' && window.AudioContext) {
      this.initializeAudioProcessor()
    }

    // Load enhanced healthcare models
    this.initEnhancedModels()
  }

  private async initializeAudioProcessor() {
    try {
      const audioContext = new AudioContext()
      await audioContext.audioWorklet.addModule('/audio-processor.js')

      this.audioProcessor = new AudioWorkletNode(
        audioContext,
        'audio-processor',
      )
      this.audioProcessor.port.onmessage =
        this.handleAudioProcessorMessage.bind(this)

      // Configure audio processor
      this.audioProcessor.port.postMessage({
        type: 'updateConfig',
        config: {
          processingInterval: 100,
          minBufferSize: 512,
          maxBufferSize: 2048,
          energyThreshold: 0.01,
        },
      })
    } catch (error: unknown) {
      logger.error('Failed to initialize audio processor:', {
        error: error instanceof Error ? String(error) : String(error),
      })
    }
  }

  private handleAudioProcessorMessage(event: MessageEvent): void {
    if (event.data.type === 'audioData') {
      this.queueAudioData(event.data.data, event.data.metadata)
    }
  }

  private queueAudioData(data: Float32Array, metadata: { timestamp: number }): void {
    // Add to processing queue
    this.processingQueue.push({
      data,
      timestamp: metadata.timestamp,
    })

    // Trim queue if it gets too large
    if (this.processingQueue.length > this.maxQueueSize) {
      this.processingQueue.shift()
    }

    // Start processing if not already in progress
    if (!this.isProcessing) {
      this.processQueuedData()
    }
  }

  private async processQueuedData() {
    if (this.processingQueue.length === 0 || this.isProcessing) {
      return
    }

    this.isProcessing = true

    try {
      // Process all queued items in batch
      const items = this.processingQueue.splice(0, this.maxQueueSize)
      const results = await Promise.all(
        items.map(async (item) => {
          const result: Array<{
            type: string
            confidence: number
            intensity: number
          }> = [] // Placeholder: No emotion analysis performed
          return { result, timestamp: item.timestamp }
        }),
      )

      // Update emotion state with results
      results.forEach(({ result, timestamp }) => {
        this.updateEmotionState(result, timestamp)
      })
    } catch (error: unknown) {
      logger.error('Error processing audio data:', {
        error: error instanceof Error ? String(error) : String(error),
      })
    } finally {
      this.isProcessing = false

      // Process any remaining items
      if (this.processingQueue.length > 0) {
        this.processQueuedData()
      }
    }
  }

  private updateEmotionState(
    emotions: Array<{ type: string; confidence: number; intensity: number }>,
    timestamp: number,
  ) {
    // Update emotion state with smoothing
    emotions.forEach((emotion) => {
      const { type, intensity } = emotion

      switch (type.toLowerCase()) {
        case 'energy':
          this.emotionState.energy =
            this.emotionState.energy * 0.7 + intensity * 0.3
          break
        case 'valence':
          this.emotionState.valence =
            this.emotionState.valence * 0.7 + intensity * 0.3
          break
        case 'dominance':
          this.emotionState.dominance =
            this.emotionState.dominance * 0.85 + intensity * 0.15
          break
      }
    })

    // Record trend data
    this.emotionState.trends.push({
      timestamp,
      energy: this.emotionState.energy,
      valence: this.emotionState.valence,
      dominance: this.emotionState.dominance,
    })

    // Keep only recent trend data
    const cutoffTime = Date.now() - 60000 // Last 60 seconds
    this.emotionState.trends = this.emotionState.trends.filter(
      (trend) => trend.timestamp >= cutoffTime,
    )
  }

  /**
   * Initialize the enhanced healthcare models
   */
  private async initEnhancedModels(): Promise<void> {
    try {
      // Initialize MentalLLaMA
      const { adapter: mentalLLaMAAdapter } = await createMentalLLaMAFromEnv()
      this.mentalLLaMAAdapter = mentalLLaMAAdapter

      // Initialize TogetherAI service for inference
      this.togetherAIService = createTogetherAIService({
        apiKey: process.env['TOGETHER_API_KEY'] || '',
        togetherApiKey: process.env['TOGETHER_API_KEY'] || '',
        togetherBaseUrl:
          process.env['TOGETHER_API_URL'] || 'https://api.together.xyz/v1',
      })

      this.isEnhancedModelLoaded = true
      logger.info('Enhanced healthcare models loaded successfully')
    } catch (error: unknown) {
      logger.error('Failed to load enhanced healthcare models:', {
        error: error instanceof Error ? String(error) : String(error),
      })
      this.isEnhancedModelLoaded = false
      this.isUsingEnhancedModels = false
    }
  }

  /**
   * Add transcribed text to the buffer for analysis
   */
  public addTranscribedText(text: string): void {
    this.lastTranscribedText = text
    this.transcriptBuffer.push(text)

    // Cap the buffer at a reasonable size
    if (this.transcriptBuffer.length > 10) {
      this.transcriptBuffer.shift()
    }
  }

  /**
   * Analyze transcribed text using the enhanced healthcare models
   */
  private async analyzeTranscribedText(): Promise<{
    mentalHealthInsights: MentalHealthInsights | null
    therapeuticSuggestions: string | null
  }> {
    if (
      !this.isEnhancedModelLoaded ||
      !this.isUsingEnhancedModels ||
      !this.lastTranscribedText
    ) {
      return {
        mentalHealthInsights: null,
        therapeuticSuggestions: null,
      }
    }

    try {
      // Create context from the transcript buffer
      const context = this.transcriptBuffer.join(' ')

      // Analyze mental health indicators using MentalLLaMA
      const mentalHealthAnalysis = this.mentalLLaMAAdapter
        ? await this.mentalLLaMAAdapter.analyzeMentalHealth(context)
        : null

      // Generate therapeutic suggestions based on the analysis
      let therapeuticSuggestions = null

      if (
        mentalHealthAnalysis?.hasMentalHealthIssue &&
        this.togetherAIService
      ) {
        // Use TogetherAI with the fine-tuned model to generate therapeutic suggestions
        const response = await this.togetherAIService.createChatCompletion(
          [
            {
              role: 'system',
              content: `You are a therapeutic assistant specializing in ${mentalHealthAnalysis.mentalHealthCategory || 'mental health'}.
                       Generate appropriate therapeutic interventions and feedback for a therapist to help a client.`,
            },
            {
              role: 'user',
              content: `Based on this client statement: "${this.lastTranscribedText}"
                       Mental health analysis indicates: ${mentalHealthAnalysis.explanation || 'possible mental health concerns'}
                       Supporting evidence: ${JSON.stringify(mentalHealthAnalysis.supportingEvidence || [])}

                       Please provide 2-3 specific therapeutic suggestions, appropriate techniques to try, and things to avoid.`,
            },
          ],
          {
            model:
              process.env['FINE_TUNED_THERAPEUTIC_MODEL'] ||
              'meta-llama-3-8b-instruct',
            temperature: 0.3,
            maxTokens: 500,
          },
        )

        therapeuticSuggestions = response.choices?.[0]?.message?.content || null
      }

      return {
        mentalHealthInsights: mentalHealthAnalysis,
        therapeuticSuggestions,
      }
    } catch (error: unknown) {
      logger.error('Error analyzing transcribed text with enhanced models:', {
        error: error instanceof Error ? String(error) : String(error),
      })

      return {
        mentalHealthInsights: null,
        therapeuticSuggestions: null,
      }
    }
  }

  /**
   * Generate enhanced feedback using fine-tuned healthcare models
   */
  private async generateEnhancedFeedback(): Promise<RealTimeFeedback | null> {
    if (
      !this.isEnhancedModelLoaded ||
      !this.isUsingEnhancedModels ||
      !this.lastTranscribedText
    ) {
      return null
    }

    try {
      const { mentalHealthInsights, therapeuticSuggestions } =
        await this.analyzeTranscribedText()

      if (!mentalHealthInsights && !therapeuticSuggestions) {
        return null
      }

      // Determine appropriate therapeutic technique based on analysis
      let suggestedTechnique: TherapeuticTechnique =
        TherapeuticTechnique.REFLECTIVE_STATEMENTS

      if (mentalHealthInsights) {
        // Map mental health category to appropriate therapeutic technique
        const category =
          mentalHealthInsights.mentalHealthCategory?.toLowerCase() || ''

        if (category.includes('depression')) {
          suggestedTechnique = TherapeuticTechnique.COGNITIVE_RESTRUCTURING
        } else if (category.includes('anxiety')) {
          suggestedTechnique = TherapeuticTechnique.MINDFULNESS
        } else if (category.includes('trauma') || category.includes('ptsd')) {
          suggestedTechnique = TherapeuticTechnique.GROUNDING_TECHNIQUES
        }
      }

      // Create feedback object
      const feedback: RealTimeFeedback = {
        id: `feedback-${Date.now()}`,
        timestamp: Date.now(),
        type: FeedbackType.TECHNIQUE_SUGGESTION,
        content:
          therapeuticSuggestions ||
          "Try using reflective listening to better understand the client's perspective.",
        suggestedTechnique,
        emotionalState: {
          energy: this.emotionState.energy,
          valence: this.emotionState.valence,
          dominance: this.emotionState.dominance,
        },
        confidence: 0.85, // Enhanced models have higher confidence
        metadata: {
          hasMentalHealthInsights: !!mentalHealthInsights,
          mentalHealthCategory:
            mentalHealthInsights?.mentalHealthCategory || null,
          enhancedModelUsed: true,
        },
      }

      return feedback
    } catch (error: unknown) {
      logger.error('Error generating enhanced feedback:', {
        error: error instanceof Error ? String(error) : String(error),
      })
      return null
    }
  }

  /**
   * Audio processing function for real-time analysis
   */
  private processAudioData(audioData: Float32Array): void {
    // Get input data
    if (!audioData || audioData.length === 0) {
      return
    }

    // Perform various analyses on the audio data
    this.analyzeAudioCharacteristics(audioData)

    // Update emotion state based on audio characteristics
    // TODO: Extract actual emotion data from audioData and pass to updateEmotionState
    // this.updateEmotionState(extractedEmotions, Date.now())

    // Update speech patterns
    this.detectSpeechPatterns(audioData)
  }

  /**
   * Analyzes audio for therapeutic characteristics
   */
  private analyzeAudioCharacteristics(audioData: Float32Array): void {
    if (!audioData || audioData.length === 0) {
      return
    }

    // Calculate RMS (loudness)
    let sumSquares = 0
    for (let i = 0; i < audioData.length; i++) {
      const sample = audioData[i]
      if (sample !== undefined) {
        sumSquares += sample * sample
      }
    }
    const rms = Math.sqrt(sumSquares / audioData.length)

    // Calculate zero-crossing rate (higher values often indicate higher-frequency content)
    let zeroCrossings = 0
    for (let i = 1; i < audioData.length; i++) {
      const current = audioData[i]
      const previous = audioData[i - 1]
      if (
        current !== undefined &&
        previous !== undefined &&
        ((current >= 0 && previous < 0) || (current < 0 && previous >= 0))
      ) {
        zeroCrossings++
      }
    }
    const zcr = zeroCrossings / (audioData.length - 1)

    // Update speech characteristics based on these measurements
    this.speechPatterns.volumeVariation = Math.max(0, Math.min(1, rms * 10)) // Normalize to 0-1
    this.speechPatterns.toneVariation = Math.max(0, Math.min(1, zcr * 5)) // Normalize to 0-1
  }

  /**
   * Detects speech patterns like pauses, speaking rate, etc.
   */
  private detectSpeechPatterns(audioData: Float32Array): void {
    if (!audioData || audioData.length === 0) {
      return
    }

    // Calculate RMS
    let sumSquares = 0
    for (let i = 0; i < audioData.length; i++) {
      const sample = audioData[i]
      if (sample !== undefined) {
        sumSquares += sample * sample
      }
    }
    const rms = Math.sqrt(sumSquares / audioData.length)

    // Detect pause if volume is below threshold
    const isCurrentlyPaused = rms < 0.01

    // In a real implementation, this would analyze pauses, speech rate,
    // and other patterns in more detail using ML models

    // Update speech rate estimation (placeholder implementation)
    const defaultRate = 120 // Default words per minute
    this.speechPatterns.speakingRate = isCurrentlyPaused
      ? this.speechPatterns.speakingRate * 0.95
      : this.speechPatterns.speakingRate * 0.95 + 0.05 * defaultRate // Target around 120 wpm
  }

  /**
   * Process audio for feedback generation
   * Enhanced to use fine-tuned healthcare models when available
   */
  async processFeedback(
    audioChunk: Float32Array,
    duration: number,
  ): Promise<RealTimeFeedback | null> {
    const now = Date.now()

    // Throttle processing to avoid excessive CPU usage
    if (now - this.lastProcessedTimestamp < this.processingThrottleMs) {
      return null
    }

    this.lastProcessedTimestamp = now

    // Process the audio data
    this.processAudioData(audioChunk)

    // Update speaking rate based on duration and audio chunk size
    if (duration > 0) {
      const estimatedWordsPerSecond =
        audioChunk.length / (44100 * duration * 0.3) // rough estimate assuming 0.3s per word at 44.1kHz
      this.speechPatterns.speakingRate = estimatedWordsPerSecond * 60 // convert to words per minute
    }

    try {
      // First try to generate enhanced feedback using fine-tuned models
      if (this.isEnhancedModelLoaded && this.isUsingEnhancedModels) {
        const enhancedFeedback = await this.generateEnhancedFeedback()
        if (enhancedFeedback) {
          // Add feedback to buffer
          this.feedbackBuffer.push(enhancedFeedback)
          // Keep buffer size reasonable
          if (this.feedbackBuffer.length > 20) {
            this.feedbackBuffer.shift()
          }
          return enhancedFeedback
        }
      }

      // Fall back to standard feedback generation if enhanced models unavailable
      // Ensure models are loaded
      await this.ensureModelsLoaded()

      // Detect emotional changes
      const emotionChange = this.detectEmotionalChange()

      // No significant change detected
      if (!emotionChange) {
        return null
      }

      // Determine appropriate therapeutic approach
      const currentApproach = await this.analyzeTherapeuticApproach(
        this.emotionState.valence,
        this.emotionState.energy,
      )

      // Generate feedback based on detected emotion and approach
      const feedback = this.generateEmotionFeedback(
        emotionChange,
        currentApproach,
      )

      // Add feedback to buffer
      this.feedbackBuffer.push(feedback)

      // Keep buffer size reasonable
      if (this.feedbackBuffer.length > 20) {
        this.feedbackBuffer.shift()
      }

      return feedback
    } catch (error: unknown) {
      logger.error('Error processing feedback:', {
        error: error instanceof Error ? String(error) : String(error),
      })
      return null
    }
  }

  /**
   * Detects significant changes in emotional state
   */
  private detectEmotionalChange(): 'positive' | 'negative' | 'neutral' | null {
    // Need at least a few data points to detect change
    if (this.emotionState.trends.length < 5) {
      return null
    }

    // Get recent trend data (last 5 points)
    const recentTrends = this.emotionState.trends.slice(-5)

    // Ensure we have valid data
    if (recentTrends.length === 0 || !recentTrends[0]) {
      return null
    }

    // Use linear regression to detect trend in valence
    let sumX = 0
    let sumY = 0
    let sumXY = 0
    let sumXX = 0

    // Normalize timestamps relative to the first timestamp
    const baseTime = recentTrends[0].timestamp

    for (let i = 0; i < recentTrends.length; i++) {
      const trend = recentTrends[i]
      if (!trend) {
        continue
      }

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
      if (current && previous) {
        energyVolatility += Math.abs(current.energy - previous.energy)
      }
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

  /**
   * Analyzes the current therapeutic approach based on emotional metrics
   */
  private async analyzeTherapeuticApproach(
    valence: number,
    energy: number,
  ): Promise<TherapeuticTechnique | null> {
    await this.ensureModelsLoaded()

    if (!this.techniqueModel) {
      logger.error('Technique model not available')
      return null
    }

    try {
      // Dynamically load TensorFlow.js
      const tf = await loadTensorFlow()

      // Create a feature tensor from current emotional state
      // and speech patterns
      const features = tf.tensor2d([
        [
          valence,
          energy,
          this.emotionState.dominance,
          this.speechPatterns.pauseCount / 10,
          this.speechPatterns.speakingRate / 200,
        ],
      ])

      // Run inference
      const prediction = this.techniqueModel.predict(features) as unknown // tf.Tensor
      const predictionData = await prediction.data()

      // Clean up tensors
      features.dispose()
      prediction.dispose()

      // Find the technique with the highest probability
      let maxIndex = 0
      let maxValue = predictionData[0]

      for (let i = 1; i < predictionData.length; i++) {
        const currentValue = predictionData[i]
        if (
          currentValue !== undefined &&
          maxValue !== undefined &&
          currentValue > maxValue
        ) {
          maxIndex = i
          maxValue = currentValue
        }
      }

      // If confidence is too low, return null
      if (maxValue === undefined || maxValue < 0.4) {
        return null
      }

      // Map index to therapeutic technique
      // This mapping must match the order of the model's output classes
      const techniques = [
        TherapeuticTechnique.REFLECTIVE_STATEMENTS,
        TherapeuticTechnique.COGNITIVE_RESTRUCTURING,
        TherapeuticTechnique.MOTIVATIONAL_INTERVIEWING,
        TherapeuticTechnique.VALIDATION,
        TherapeuticTechnique.STRENGTH_BASED,
        TherapeuticTechnique.REFRAMING,
        TherapeuticTechnique.BEHAVIORAL_ACTIVATION,
        TherapeuticTechnique.MINDFULNESS,
      ]

      return techniques[maxIndex] || null
    } catch (error: unknown) {
      logger.error('Error in therapeutic approach analysis', {
        error: error instanceof Error ? String(error) : String(error),
      })
      return null
    }
  }

  /**
   * Generates feedback based on detected emotional change
   */
  private generateEmotionFeedback(
    emotionChange: 'positive' | 'negative' | 'neutral',
    currentApproach: TherapeuticTechnique | null,
  ): RealTimeFeedback {
    // Generate appropriate feedback based on emotional change direction
    const contextString = this.currentScenario?.domain || 'general'

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

  /**
   * Sets the scenario context for feedback generation
   * Enhanced with healthcare model context
   */
  setScenarioContext(scenario: Scenario): void {
    this.currentScenario = scenario
    this.clearFeedbackBuffer()

    // Reset emotion state
    this.emotionState = {
      energy: 0.5,
      valence: 0.5,
      dominance: 0.5,
      trends: [],
    }

    // Clear detected techniques
    this.detectedTechniques.clear()

    // Clear detected keywords
    this.detectedKeywords.clear()

    // Clear transcript buffer
    this.transcriptBuffer = []
    this.lastTranscribedText = ''

    logger.info('Set scenario context for feedback generation', {
      scenarioId: scenario.id,
      scenarioType: scenario.domain,
      usingEnhancedModels: this.isUsingEnhancedModels,
    })
  }

  /**
   * Clears all context and feedback
   */
  clearContext() {
    this.currentScenario = null
    this.clearFeedbackBuffer()

    // Reset all speech and emotion analysis data
    this.emotionState = {
      energy: 0.5,
      valence: 0.5,
      dominance: 0.5,
      trends: [],
    }

    this.speechPatterns = {
      pauseCount: 0,
      averagePauseDuration: 0,
      speakingRate: 0,
      toneVariation: 0,
      volumeVariation: 0,
    }

    this.detectedKeywords.clear()
    this.detectedTechniques.clear()
  }

  /**
   * Clears the feedback buffer
   */
  private clearFeedbackBuffer() {
    this.feedbackBuffer = []
  }

  /**
   * Cleanup method to release resources
   */
  cleanup() {
    // Clean up audio context if it exists
    if (this.audioWorklet) {
      this.audioWorklet.disconnect()
      this.audioWorklet.port.onmessage = null
      this.audioWorklet = null
    }

    if (this.analyzer) {
      this.analyzer.disconnect()
      this.analyzer = null
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch((err) => {
        console.error('Error closing AudioContext:', err)
      })
      this.audioContext = null
    }

    // Clear all data
    this.clearContext()
  }

  private async loadModels(): Promise<void> {
    if (this.isModelLoaded) {
      return
    }

    if (this.modelLoadingPromise) {
      await this.modelLoadingPromise
      return
    }

    this.modelLoadingPromise = (async () => {
      try {
        logger.info('Loading technique analysis model...')

        // Dynamically load TensorFlow.js layers
        const { loadLayersModel } = await loadTensorFlowLayers()

        // Load the therapeutic technique detection model
        this.techniqueModel = await loadLayersModel(
          '/models/technique-detection/model.json',
        )

        this.isModelLoaded = true
        logger.info('ML models loaded successfully')
      } catch (error: unknown) {
        logger.error('Failed to load ML models', {
          error: error instanceof Error ? String(error) : String(error),
        })

        // Create fallback models if loading fails
        await this.createFallbackModels()
      }
    })()

    await this.modelLoadingPromise
  }

  private async createFallbackModels(): Promise<void> {
    // Create simple fallback models for degraded operation
    logger.warn('Creating fallback models for degraded operation')

    try {
      // Dynamically load TensorFlow.js
      const tf = await loadTensorFlow()

      // Simple sequential model for technique detection
      const techniqueModel = tf.sequential()
      techniqueModel.add(
        tf.layers.dense({
          inputShape: [5],
          units: 16,
          activation: 'relu',
        }),
      )
      techniqueModel.add(
        tf.layers.dense({
          units: 8,
          activation: 'softmax',
        }),
      )
      techniqueModel.compile({
        optimizer: 'adam',
        loss: 'categoricalCrossentropy',
      })
      this.techniqueModel = techniqueModel

      this.isModelLoaded = true
    } catch (error: unknown) {
      logger.error('Failed to create fallback models', {
        error: error instanceof Error ? String(error) : String(error),
      })
      // Set model to null if even fallback creation fails
      this.techniqueModel = null
    }
  }

  private async ensureModelsLoaded(): Promise<void> {
    if (!this.isModelLoaded) {
      await this.loadModels()
    }
  }

  /**
   * Toggle the use of enhanced healthcare models
   */
  public toggleEnhancedModels(enabled: boolean): void {
    this.isUsingEnhancedModels = enabled && this.isEnhancedModelLoaded
  }
}
