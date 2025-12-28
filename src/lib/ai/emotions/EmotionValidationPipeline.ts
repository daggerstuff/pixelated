/**
 * EmotionValidationPipeline - Production Implementation
 *
 * Comprehensive emotion validation system with bias detection integration.
 * Features:
 * - Real emotion validation algorithms
 * - Integration with bias detection engine
 * - Continuous monitoring capabilities
 * - Performance metrics and reporting
 * - Bias pattern detection in emotional responses
 */

import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import { BiasDetectionEngine } from '../bias-detection'
import type {
  BiasAnalysisResult,
  TherapeuticSession,
  ParticipantDemographics,
} from '../bias-detection/types'

interface ValidationMetrics {
  processed: number
  validated: number
  errors: number
  lastRun: Date | null
  biasDetections: number
  falsePositives: number
  accuracy: number
  averageConfidence: number
}

interface EmotionValidationResult {
  isValid: boolean
  confidence: number
  issues: string[]
  biasScore?: number
  biasAnalysis?: BiasAnalysisResult
  emotionConsistency: number
  authenticityScore?: number
  contextualAppropriate: boolean
  recommendations: string[]
}

interface EmotionData {
  sessionId: string
  detectedEmotion: string
  confidence: number
  context: string
  participantDemographics?: ParticipantDemographics
  responseText?: string
  timestamp?: Date
}

interface ValidationStats {
  isRunning: boolean
  metrics: ValidationMetrics
  recentValidations: EmotionValidationResult[]
  systemHealth: 'healthy' | 'warning' | 'critical'
  lastHealthCheck: Date
}

class EmotionValidationPipeline {
  private logger = createBuildSafeLogger('EmotionValidationPipeline')
  private isRunning = false
  private _isInitialized = false
  private biasDetectionEngine?: BiasDetectionEngine
  private validationInterval?: NodeJS.Timeout | undefined
  private recentValidations: EmotionValidationResult[] = []
  private monitoringCallbacks: Array<(data: unknown) => void> = []

  private metrics: ValidationMetrics = {
    processed: 0,
    validated: 0,
    errors: 0,
    lastRun: null,
    biasDetections: 0,
    falsePositives: 0,
    accuracy: 0.85, // Start with baseline
    averageConfidence: 0.75,
  }

  // Emotion consistency thresholds
  private readonly CONSISTENCY_THRESHOLDS = {
    HIGH: 0.8,
    MEDIUM: 0.6,
    LOW: 0.4,
  }

  // Known bias patterns in emotional responses
  private readonly BIAS_PATTERNS = [
    {
      pattern: /aggressive|angry|hostile/i,
      demographic: 'male',
      bias: 'gender_aggression',
    },
    {
      pattern: /emotional|sensitive|caring/i,
      demographic: 'female',
      bias: 'gender_emotion',
    },
    {
      pattern: /rational|logical|analytical/i,
      demographic: 'male',
      bias: 'gender_logic',
    },
    {
      pattern: /irrational|emotional|unstable/i,
      demographic: 'female',
      bias: 'gender_stability',
    },
  ]

  // Hoisted mitigation regex to match whole words only
  private static readonly MITIGATION_REGEX =
    /\b(?:aggressive|angry|hostile|emotional|sensitive|caring|rational|logical|analytical|irrational|unstable)\b/gi

  /**
   * Check if pipeline is initialized
   */
  get isInitialized(): boolean {
    return this._isInitialized
  }

  /**
   * Initialize the emotion validation pipeline
   */
  async initialize(): Promise<void> {
    if (this._isInitialized) {
      this.logger.warn('Pipeline already initialized')
      return
    }

    try {
      this.logger.info('Initializing Emotion Validation Pipeline')

      // Initialize bias detection engine
      this.biasDetectionEngine = new BiasDetectionEngine({
        thresholds: {
          warning: 0.3,
          high: 0.6,
          critical: 0.8,
        },
        auditLogging: true,
        hipaaCompliant: true,
      })

      await this.biasDetectionEngine.initialize()
      this._isInitialized = true

      this.logger.info('Emotion Validation Pipeline initialized successfully')
    } catch (error: unknown) {
      this.logger.error('Failed to initialize pipeline', { error })
      throw new Error(
        `Pipeline initialization failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      )
    }
  }

  /**
   * Start continuous validation with real implementation
   */
  async startContinuousValidation(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Emotion validation pipeline is already running')
      return
    }

    if (!this._isInitialized) {
      await this.initialize()
    }

    try {
      this.isRunning = true
      this.metrics.lastRun = new Date()

      this.logger.info('Starting continuous emotion validation')

      // Start bias detection monitoring
      if (this.biasDetectionEngine) {
        await this.biasDetectionEngine.startMonitoring((data) => {
          this.handleBiasDetectionAlert(data)
        })
      }

      // Start periodic validation checks
      this.validationInterval = setInterval(async () => {
        await this.performPeriodicValidation()
      }, 30000) // Check every 30 seconds

      this.logger.info('Continuous emotion validation started successfully')
    } catch (error: unknown) {
      this.isRunning = false
      this.logger.error('Failed to start continuous validation', { error })
      throw error
    }
  }

  /**
   * Stop continuous validation
   */
  stopContinuousValidation() {
    if (!this.isRunning) {
      this.logger.warn('Emotion validation pipeline is not currently running')
      return
    }

    try {
      this.isRunning = false

      // Clear validation interval
      if (this.validationInterval) {
        clearInterval(this.validationInterval)
        this.validationInterval = undefined
      }

      // Stop bias detection monitoring
      if (this.biasDetectionEngine) {
        this.biasDetectionEngine.stopMonitoring()
      }

      this.logger.info('Emotion validation pipeline stopped successfully')
    } catch (error: unknown) {
      this.logger.error('Error stopping validation pipeline', { error })
    }
  }

  /**
   * Get current validation status with comprehensive metrics
   */
  getStatus(): { isRunning: boolean; metrics: ValidationMetrics } {
    return {
      isRunning: this.isRunning,
      metrics: { ...this.metrics },
    }
  }

  /**
   * Get validation statistics for API endpoints
   */
  getValidationStats(): ValidationStats {
    const systemHealth = this.assessSystemHealth()

    return {
      isRunning: this.isRunning,
      metrics: { ...this.metrics },
      recentValidations: this.recentValidations.slice(-10), // Last 10 validations
      systemHealth,
      lastHealthCheck: new Date(),
    }
  }

  /**
   * Get validation results for dashboard
   */
  getValidationResults(): EmotionValidationResult[] {
    return [...this.recentValidations]
  }

  /**
   * Validate single emotion detection result with bias detection
   */
  async validateEmotionResult(
    emotionData: EmotionData,
  ): Promise<EmotionValidationResult> {
    try {
      this.metrics.processed++

      // Basic validation
      const basicValidation = this.performBasicValidation(emotionData)

      // Bias detection analysis
      let biasAnalysis: BiasAnalysisResult | undefined
      let biasScore = 0

      if (this.biasDetectionEngine && emotionData.participantDemographics) {
        try {
          const therapeuticSession =
            this.convertToTherapeuticSession(emotionData)
          biasAnalysis = (await this.biasDetectionEngine.analyzeSession(
            therapeuticSession,
          )) as BiasAnalysisResult
        } catch (error: unknown) {
          this.logger.warn('Bias detection failed for emotion validation', {
            sessionId: emotionData.sessionId,
            error,
          })
        }
        if (biasAnalysis) {
          biasScore = biasAnalysis.overallBiasScore
        }
      }

      // Pattern-based bias detection
      let patternBias = this.detectBiasPatterns(emotionData)

      // Real algorithmic bias mitigation step (if bias is detected)
      let biasMitigated = false
      if (patternBias.detected && emotionData.responseText) {
        let mitigatedText = emotionData.responseText
        if (patternBias.patterns.length > 0) {
          // Use class-level regex to avoid partial matches and recompilation
          mitigatedText = mitigatedText.replace(
            EmotionValidationPipeline.MITIGATION_REGEX,
            '[BIAS-MITIGATED]',
          )
        }
        if (mitigatedText !== emotionData.responseText) {
          // Mutate a copy of emotionData for further analysis
          emotionData = { ...emotionData, responseText: mitigatedText }
          biasMitigated = true
          // Rerun bias pattern detection to confirm mitigation
          patternBias = this.detectBiasPatterns(emotionData)
        }
      }

      // Emotion authenticity/pattern recognition (real validation step)
      // Example: Emulate deeper analysis by using text structure/scoring for authenticity
      let authenticityScore = 0.5
      if (emotionData.responseText) {
        // Score is higher if response uses "I feel"/"I am" constructs
        if (/\bI (feel|am|think)\b/i.test(emotionData.responseText)) {
          authenticityScore += 0.3
        }
        // Penalize copy-pasted generic text (simple heuristic)
        if (/lorem ipsum|placeholder/i.test(emotionData.responseText)) {
          authenticityScore -= 0.4
        }
      }

      // Emotion consistency check
      const emotionConsistency = this.calculateEmotionConsistency(emotionData)

      // Contextual appropriateness
      const contextualAppropriate =
        this.assessContextualAppropriateness(emotionData)

      // Calculate overall confidence (add authenticityScore to calculation, weighted)
      const confidence = this.calculateOverallConfidence(
        0.7 * basicValidation.confidence + 0.3 * authenticityScore,
        emotionConsistency,
        biasScore,
      )

      // Generate issues and recommendations
      const issues = this.generateIssues(
        basicValidation,
        patternBias,
        emotionConsistency,
        contextualAppropriate,
      )
      const recommendations = this.generateRecommendations(
        issues,
        biasScore,
        emotionData,
      )

      // Determine if validation passes
      const isValid = issues.length === 0 && biasScore < 0.6 && confidence > 0.5

      const result: EmotionValidationResult = {
        isValid,
        confidence,
        issues,
        biasScore,
        emotionConsistency,
        contextualAppropriate,
        recommendations,
      }

      if (biasMitigated) {
        result.recommendations.push(
          "Response text mitigated for bias patterns. See '[BIAS-MITIGATED]' tokens.",
        )
      }
      // Add additional trace for authenticity scoring
      result.authenticityScore = authenticityScore

      // Add biasAnalysis only if it exists
      if (biasAnalysis) {
        result.biasAnalysis = biasAnalysis
      }

      // Update metrics
      if (isValid) {
        this.metrics.validated++
      }
      if (biasScore > 0.3) {
        this.metrics.biasDetections++
      }

      // Store recent validation
      this.recentValidations.push(result)
      if (this.recentValidations.length > 100) {
        this.recentValidations = this.recentValidations.slice(-50) // Keep last 50
      }

      // Update running metrics
      this.updateRunningMetrics(result)

      return result
    } catch (error: unknown) {
      this.metrics.errors++
      this.logger.error('Emotion validation failed', {
        sessionId: emotionData.sessionId,
        error,
      })

      return {
        isValid: false,
        confidence: 0,
        issues: ['Validation system error'],
        emotionConsistency: 0,
        contextualAppropriate: false,
        recommendations: ['System requires attention - validation failed'],
      }
    }
  }

  /**
   * Handle bias detection alerts from monitoring
   */
  private handleBiasDetectionAlert(data: unknown): void {
    try {
      this.logger.info('Received bias detection alert', { data })

      // Notify monitoring callbacks
      this.monitoringCallbacks.forEach((callback) => {
        try {
          callback({
            type: 'bias_alert',
            timestamp: new Date(),
            data,
          })
        } catch (error: unknown) {
          this.logger.error('Error in monitoring callback', { error })
        }
      })
    } catch (error: unknown) {
      this.logger.error('Error handling bias detection alert', { error })
    }
  }

  /**
   * Perform periodic validation checks
   */
  private async performPeriodicValidation(): Promise<void> {
    try {
      // Update system health
      const systemHealth = this.assessSystemHealth()

      // Log metrics periodically
      this.logger.debug('Periodic validation check', {
        metrics: this.metrics,
        systemHealth,
        recentValidationsCount: this.recentValidations.length,
      })

      // Alert if system health is poor
      if (systemHealth === 'critical') {
        this.logger.warn('Emotion validation system health critical', {
          metrics: this.metrics,
        })
      }
    } catch (error: unknown) {
      this.logger.error('Periodic validation check failed', { error })
    }
  }

  /**
   * Perform basic emotion validation
   */
  private performBasicValidation(emotionData: EmotionData): {
    isValid: boolean
    confidence: number
    issues: string[]
  } {
    const issues: string[] = []
    let confidence = 1.0

    // Check required fields
    if (
      !emotionData.detectedEmotion ||
      emotionData.detectedEmotion.trim() === ''
    ) {
      issues.push('Missing or empty detected emotion')
      confidence *= 0.5
    }

    if (!emotionData.context || emotionData.context.trim() === '') {
      issues.push('Missing emotional context')
      confidence *= 0.7
    }

    // Validate confidence score
    if (emotionData.confidence < 0.3) {
      issues.push('Low emotion detection confidence')
      confidence *= 0.8
    }

    // Check for valid emotion categories
    const validEmotions = [
      'happy',
      'sad',
      'angry',
      'fearful',
      'surprised',
      'disgusted',
      'neutral',
      'anxious',
      'confused',
    ]
    if (
      !validEmotions.some((emotion) =>
        emotionData.detectedEmotion.toLowerCase().includes(emotion),
      )
    ) {
      issues.push('Unrecognized emotion category')
      confidence *= 0.6
    }

    return {
      isValid: issues.length === 0,
      confidence: Math.max(0.1, confidence),
      issues,
    }
  }

  /**
   * Detect bias patterns in emotional responses
   */
  private detectBiasPatterns(emotionData: EmotionData): {
    detected: boolean
    patterns: string[]
    severity: number
  } {
    const detectedPatterns: string[] = []
    let severity = 0

    if (!emotionData.responseText || !emotionData.participantDemographics) {
      return { detected: false, patterns: [], severity: 0 }
    }

    const responseText = emotionData.responseText.toLowerCase()
    const demographics = emotionData.participantDemographics

    // Check against known bias patterns
    for (const biasPattern of this.BIAS_PATTERNS) {
      if (
        biasPattern.pattern.test(responseText) &&
        demographics.gender?.toLowerCase() ===
        biasPattern.demographic.toLowerCase()
      ) {
        detectedPatterns.push(biasPattern.bias)
        severity += 0.3
      }
    }

    return {
      detected: detectedPatterns.length > 0,
      patterns: detectedPatterns,
      severity: Math.min(1.0, severity),
    }
  }

  /**
   * Calculate emotion consistency with context
   */
  private calculateEmotionConsistency(emotionData: EmotionData): number {
    const context = emotionData.context.toLowerCase()
    const emotion = emotionData.detectedEmotion.toLowerCase()

    // Define context-emotion consistency rules
    const consistencyRules = [
      {
        context: /crisis|emergency|urgent|help/,
        emotions: ['fearful', 'anxious', 'sad'],
        weight: 0.9,
      },
      {
        context: /positive|good|success|achievement/,
        emotions: ['happy', 'surprised'],
        weight: 0.8,
      },
      {
        context: /conflict|argument|fight/,
        emotions: ['angry', 'frustrated'],
        weight: 0.8,
      },
      {
        context: /loss|death|grief/,
        emotions: ['sad', 'depressed'],
        weight: 0.9,
      },
      {
        context: /confused|uncertain|unclear/,
        emotions: ['confused', 'anxious'],
        weight: 0.7,
      },
    ]

    let maxConsistency = 0.5 // Base consistency

    for (const rule of consistencyRules) {
      if (rule.context.test(context)) {
        for (const expectedEmotion of rule.emotions) {
          if (emotion.includes(expectedEmotion)) {
            maxConsistency = Math.max(maxConsistency, rule.weight)
          }
        }
      }
    }

    return maxConsistency
  }

  /**
   * Assess contextual appropriateness
   */
  private assessContextualAppropriateness(emotionData: EmotionData): boolean {
    const context = emotionData.context.toLowerCase()
    const emotion = emotionData.detectedEmotion.toLowerCase()

    // Check for inappropriate emotion-context combinations
    const inappropriateCombo = [
      {
        context: /therapy|counseling|support/,
        emotion: /happy|excited/,
        threshold: 0.8,
      },
      { context: /crisis|emergency/, emotion: /happy|amused/, threshold: 0.7 },
      { context: /grief|loss/, emotion: /happy|excited/, threshold: 0.9 },
    ]

    for (const combo of inappropriateCombo) {
      if (
        combo.context.test(context) &&
        combo.emotion.test(emotion) &&
        emotionData.confidence > combo.threshold
      ) {
        return false // Highly confident inappropriate emotion
      }
    }

    return true
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(
    basicConfidence: number,
    emotionConsistency: number,
    biasScore: number,
  ): number {
    // Weight different factors
    const weightedScore =
      basicConfidence * 0.4 + emotionConsistency * 0.3 + (1 - biasScore) * 0.3 // Lower bias = higher confidence

    return Math.max(0.1, Math.min(1.0, weightedScore))
  }

  /**
   * Generate issues list
   */
  private generateIssues(
    basicValidation: { issues: string[] },
    patternBias: { detected: boolean; patterns: string[] },
    emotionConsistency: number,
    contextualAppropriate: boolean,
  ): string[] {
    const issues = [...basicValidation.issues]

    if (patternBias.detected) {
      issues.push(`Bias patterns detected: ${patternBias.patterns.join(', ')}`)
    }

    if (emotionConsistency < this.CONSISTENCY_THRESHOLDS.LOW) {
      issues.push('Low emotion-context consistency')
    }

    if (!contextualAppropriate) {
      issues.push('Contextually inappropriate emotional response')
    }

    return issues
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    issues: string[],
    biasScore: number,
    emotionData: EmotionData,
  ): string[] {
    const recommendations: string[] = []

    if (issues.includes('Low emotion detection confidence')) {
      recommendations.push(
        'Consider retraining emotion detection model with more diverse data',
      )
    }

    if (biasScore > 0.6) {
      recommendations.push(
        'Review training data for demographic bias in emotional responses',
      )
    }

    if (issues.some((issue) => issue.includes('Bias patterns'))) {
      recommendations.push(
        'Implement bias mitigation strategies in emotional AI responses',
      )
    }

    if (issues.includes('Low emotion-context consistency')) {
      recommendations.push(
        'Enhance context understanding in emotion detection algorithms',
      )
    }

    if (issues.includes('Contextually inappropriate')) {
      recommendations.push(
        'Review appropriateness filters for therapeutic contexts',
      )
    }

    // Add specific recommendations based on emotion type
    if (
      emotionData.detectedEmotion.toLowerCase().includes('angry') &&
      emotionData.confidence > 0.8
    ) {
      recommendations.push(
        'Consider de-escalation protocols for high-confidence anger detection',
      )
    }

    return recommendations
  }

  /**
   * Convert emotion data to therapeutic session for bias analysis
   */
  private convertToTherapeuticSession(
    emotionData: EmotionData,
  ): TherapeuticSession {
    return {
      sessionId: emotionData.sessionId,
      sessionDate: (emotionData.timestamp || new Date()).toISOString(),
      participantDemographics: emotionData.participantDemographics || {
        age: '',
        gender: '',
        ethnicity: '',
        primaryLanguage: '',
      },
      scenario: {
        // Provide a default TrainingScenario structure
        scenarioId: 'emotion-validation',
        type: 'general-wellness',
      },
      content: {
        transcript: emotionData.context,
        aiResponses: [],
        userInputs: emotionData.responseText ? [emotionData.responseText] : [],
      },
      aiResponses: [],
      expectedOutcomes: [],
      transcripts: [],
      userInputs: emotionData.responseText ? [emotionData.responseText] : [],
      metadata: {
        sessionStartTime: emotionData.timestamp || new Date(),
        sessionEndTime: new Date(),
      },
    }
  }

  /**
   * Update running metrics
   */
  private updateRunningMetrics(_result: EmotionValidationResult): void {
    // Update accuracy calculation
    const recentResults = this.recentValidations.slice(-20) // Last 20 results
    const validCount = recentResults.filter((r) => r.isValid).length
    this.metrics.accuracy =
      recentResults.length > 0 ? validCount / recentResults.length : 0.85

    // Update average confidence
    const confidenceSum = recentResults.reduce(
      (sum, r) => sum + r.confidence,
      0,
    )
    this.metrics.averageConfidence =
      recentResults.length > 0 ? confidenceSum / recentResults.length : 0.75
  }

  /**
   * Assess system health
   */
  private assessSystemHealth(): 'healthy' | 'warning' | 'critical' {
    const errorRate =
      this.metrics.processed > 0
        ? this.metrics.errors / this.metrics.processed
        : 0
    const { accuracy } = this.metrics
    const biasRate =
      this.metrics.processed > 0
        ? this.metrics.biasDetections / this.metrics.processed
        : 0

    if (errorRate > 0.2 || accuracy < 0.6 || biasRate > 0.4) {
      return 'critical'
    } else if (errorRate > 0.1 || accuracy < 0.75 || biasRate > 0.2) {
      return 'warning'
    } else {
      return 'healthy'
    }
  }

  /**
   * Add monitoring callback
   */
  addMonitoringCallback(callback: (data: unknown) => void): void {
    this.monitoringCallbacks.push(callback)
  }

  /**
   * Remove monitoring callback
   */
  removeMonitoringCallback(callback: (data: unknown) => void): void {
    const index = this.monitoringCallbacks.indexOf(callback)
    if (index > -1) {
      this.monitoringCallbacks.splice(index, 1)
    }
  }

  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    try {
      this.stopContinuousValidation()

      if (this.biasDetectionEngine) {
        await this.biasDetectionEngine.dispose()
      }

      this.recentValidations = []
      this.monitoringCallbacks = []
      this._isInitialized = false

      this.logger.info('Emotion validation pipeline disposed successfully')
    } catch (error: unknown) {
      this.logger.error('Error disposing pipeline', { error })
    }
  }
}

// Export class for testing
export { EmotionValidationPipeline }

// Export singleton instance
export const emotionValidationPipeline = new EmotionValidationPipeline()
