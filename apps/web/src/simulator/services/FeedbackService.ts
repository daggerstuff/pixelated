import type { LayersModel } from '@tensorflow/tfjs'

// TensorFlow.js imports moved to dynamic imports to reduce bundle size
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { isRecord, isAudioProcessorMessage, isTherapeuticTechnique, resolveSafeLlmBaseUrl, loadTensorFlow, loadTensorFlowLayers, generateEmotionFeedback, detectEmotionalChange } from './FeedbackService.utils'
export type { AudioProcessorMessage, MentalHealthInsights } from './FeedbackService.types'

import { createMentalLLaMAFromEnv } from '../../lib/ai/mental-llama'
import type { MentalLLaMAAdapter } from '../../lib/ai/mental-llama/adapter/MentalLLaMAAdapter'
import { createLLMService } from '../../lib/ai/services/llm-provider'
import type { LLMService } from '../../lib/ai/services/llm-provider'
import type {
  FeedbackServiceInterface,
  RealTimeFeedback,
  Scenario,
  DetectedTechnique,
  EmotionState,
} from '../types'
import { TherapeuticTechnique, FeedbackType } from '../types'




const logger = createBuildSafeLogger('default')

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
  private readonly processingThrottleMs: number = 750 // Throttle processing to avoid excessive CPU usage
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
  private readonly detectedKeywords: Map<string, number> = new Map() // Maps keywords to frequency
  private readonly detectedTechniques: Map<TherapeuticTechnique, number> =
    new Map()
  // Remove unused clientResponsePredictions
  private techniqueModel: LayersModel | null = null
  private isModelLoaded = false
  private modelLoadingPromise: Promise<void> | null = null
  private mentalLLaMAAdapter: MentalLLaMAAdapter | null = null
  // Remove unused mentalArenaAdapter
  private llmService: LLMService | null = null
  private isEnhancedModelLoaded = false
  private isUsingEnhancedModels = true
  private lastTranscribedText = ''
  private transcriptBuffer: string[] = []
  // Remove unused emotionDetectionEngine
  private audioProcessor: AudioWorkletNode | null = null
  private readonly processingQueue: Array<{
    data: Float32Array
    timestamp: number
  }> = []
  private isProcessing = false
  private readonly maxQueueSize = 10

  constructor() {
    // Initialize audio worklet if available
    if (typeof window !== 'undefined' && typeof AudioContext !== 'undefined') {
      void this.initializeAudioProcessor()
    }

    // Load enhanced healthcare models
    void this.initEnhancedModels()
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
    if (isAudioProcessorMessage(event.data)) {
      this.queueAudioData(event.data.data, event.data.metadata)
    }
  }

  private queueAudioData(
    data: Float32Array,
    metadata: { timestamp: number },
  ): void {
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
      void this.processQueuedData()
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
        void this.processQueuedData()
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

      // Initialize the shared LLM service for inference
      this.llmService = createLLMService({
        apiKey: process.env['LLM_API_KEY'] ?? '',
        baseUrl: resolveSafeLlmBaseUrl(),
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
        ? await this.mentalLLaMAAdapter.analyzeMentalHealth({ text: context })
        : null

      // Generate therapeutic suggestions based on the analysis
      let therapeuticSuggestions: string | null = null

      if (mentalHealthAnalysis?.hasMentalHealthIssue && this.llmService) {
        const analysisCategory = mentalHealthAnalysis.mentalHealthCategory
        const analysisExplanation = mentalHealthAnalysis.explanation
        const supportingEvidence = Array.isArray(
          mentalHealthAnalysis.supportingEvidence,
        )
          ? mentalHealthAnalysis.supportingEvidence
          : []

        // Use LLM service with the fine-tuned model to generate therapeutic suggestions
        const response = await this.llmService.createChatCompletion(
          [
            {
              role: 'system',
              content: `You are a therapeutic assistant specializing in ${analysisCategory}.
                       Generate appropriate therapeutic interventions and feedback for a therapist to help a client.`,
            },
            {
              role: 'user',
              content: `Based on this client statement: "${this.lastTranscribedText}"
                       Mental health analysis indicates: ${analysisExplanation}
                       Supporting evidence: ${JSON.stringify(supportingEvidence)}

                       Please provide 2-3 specific therapeutic suggestions, appropriate techniques to try, and things to avoid.`,
            },
          ],
          {
            model:
              process.env['FINE_TUNED_THERAPEUTIC_MODEL'] ??
              'meta-llama-3-8b-instruct',
            temperature: 0.3,
            maxTokens: 500,
          },
        )

        const firstChoice = response.choices[0]
        if (typeof firstChoice.message.content === 'string') {
          therapeuticSuggestions = firstChoice.message.content
        } else {
          therapeuticSuggestions = null
        }
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
          mentalHealthInsights.mentalHealthCategory?.toLowerCase() ?? ''

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
          therapeuticSuggestions ??
          "Try using reflective listening to better understand the client's perspective.",
        suggestedTechnique,
        emotionalState: {
          energy: this.emotionState.energy,
          valence: this.emotionState.valence,
          dominance: this.emotionState.dominance,
        },
        confidence: 0.85,
        suggestion:
          therapeuticSuggestions ??
          "Try using reflective listening to better understand the client's perspective.",
        rationale:
          'Automatically generated feedback based on enhanced model analysis',
        priority: 'medium' as const,
        metadata: {
          hasMentalHealthInsights: !!mentalHealthInsights,
          mentalHealthCategory:
            mentalHealthInsights?.mentalHealthCategory ?? null,
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
    if (audioData.length === 0) {
      return
    }

    // Perform various analyses on the audio data
    this.analyzeAudioCharacteristics(audioData)

    // Calculate RMS (loudness) for energy
    let sumSquares = 0
    for (const sample of audioData) {
      sumSquares += sample * sample
    }
    const rms = Math.sqrt(sumSquares / audioData.length)

    // Calculate zero-crossing rate for valence
    let zeroCrossings = 0
    for (let i = 1; i < audioData.length; i++) {
      const current = audioData[i]
      const previous = audioData[i - 1]
      if ((current >= 0 && previous < 0) || (current < 0 && previous >= 0)) {
        zeroCrossings++
      }
    }
    const zcr = zeroCrossings / (audioData.length - 1)

    // Normalize values
    const energy = Math.max(0, Math.min(1, rms * 10))
    const valence = Math.max(0, Math.min(1, zcr * 5))
    // Approximate dominance based on energy
    const dominance = Math.max(0, Math.min(1, energy * 0.8 + 0.2))

    // Update emotion state based on audio characteristics
    const extractedEmotions = [
      { type: 'energy', confidence: 0.8, intensity: energy },
      { type: 'valence', confidence: 0.7, intensity: valence },
      { type: 'dominance', confidence: 0.6, intensity: dominance },
    ]
    this.updateEmotionState(extractedEmotions, Date.now())

    // Update speech patterns
    this.detectSpeechPatterns(audioData)
  }

  /**
   * Analyzes audio for therapeutic characteristics
   */
  private analyzeAudioCharacteristics(audioData: Float32Array): void {
    if (audioData.length === 0) {
      return
    }

    // Calculate RMS (loudness)
    let sumSquares = 0
    for (const sample of audioData) {
      sumSquares += sample * sample
    }
    const rms = Math.sqrt(sumSquares / audioData.length)

    // Calculate zero-crossing rate (higher values often indicate higher-frequency content)
    let zeroCrossings = 0
    for (let i = 1; i < audioData.length; i++) {
      const current = audioData[i]
      const previous = audioData[i - 1]
      if ((current >= 0 && previous < 0) || (current < 0 && previous >= 0)) {
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
    if (audioData.length === 0) {
      return
    }

    // Calculate RMS
    let sumSquares = 0
    for (const sample of audioData) {
      sumSquares += sample * sample
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
      const emotionChange = detectEmotionalChange(this.emotionState.trends)

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
      const feedback = generateEmotionFeedback(this.currentScenario, 
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

  /** Implements FeedbackServiceInterface.analyzeFeedback */
  async analyzeFeedback(
    text: string,
    techniques: DetectedTechnique[],
    emotionState: EmotionState | null,
  ): Promise<RealTimeFeedback> {
    this.addTranscribedText(text)

    for (const technique of techniques) {
      if (isTherapeuticTechnique(technique.technique)) {
        this.detectedTechniques.set(technique.technique, Date.now())
      }
    }

    if (emotionState) {
      this.emotionState.energy = emotionState.energy
      this.emotionState.valence = emotionState.valence
      this.emotionState.dominance = emotionState.dominance
    }

    const enhancedFeedback = await this.generateEnhancedFeedback()
    if (enhancedFeedback) {
      return enhancedFeedback
    }

    return {
      type: FeedbackType.TECHNIQUE_SUGGESTION,
      timestamp: Date.now(),
      suggestion: text
        ? `Consider reflecting on the client's statement: "${text.slice(0, 80)}"`
        : 'Continue using reflective listening to explore the client experience.',
      rationale:
        'Automatically generated feedback based on real-time analysis of therapeutic interaction.',
      priority: 'medium',
    }
  }

  /**
   * Detects significant changes in emotional state
   */

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
      const prediction = this.techniqueModel.predict(features)
      if (Array.isArray(prediction)) {
        for (const tensor of prediction) {
          tensor.dispose()
        }
        features.dispose()
        return null
      }

      const predictionData = Array.from(await prediction.data())
      if (predictionData.length === 0) {
        prediction.dispose()
        return null
      }

      // Clean up tensors
      features.dispose()
      prediction.dispose()

      // Find the technique with the highest probability
      let maxIndex = 0
      let maxValue = predictionData[0]

      for (let i = 1; i < predictionData.length; i++) {
        const currentValue = predictionData[i]
        if (typeof currentValue === 'number' && currentValue > maxValue) {
          maxIndex = i
          maxValue = currentValue
        }
      }

      // If confidence is too low, return null
      if (maxValue < 0.4) {
        features.dispose()
        prediction.dispose()
        return null
      }

      // Map index to therapeutic technique
      // This mapping must match the order of the model's output classes
      const techniques: TherapeuticTechnique[] = [
        TherapeuticTechnique.REFLECTIVE_STATEMENTS,
        TherapeuticTechnique.COGNITIVE_RESTRUCTURING,
        TherapeuticTechnique.MOTIVATIONAL_INTERVIEWING,
        TherapeuticTechnique.VALIDATION,
        TherapeuticTechnique.STRENGTH_BASED,
        TherapeuticTechnique.REFRAMING,
        TherapeuticTechnique.BEHAVIORAL_ACTIVATION,
        TherapeuticTechnique.MINDFULNESS,
      ]

      return techniques[maxIndex] ?? null
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
