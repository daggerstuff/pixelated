/**
 * Edge Threat Detection System
 * AI-powered threat detection with models deployed at 50+ edge locations
 * Integrates with Pixelated's AI infrastructure and bias detection
 */

import { EventEmitter } from 'events'
import * as tf from '@tensorflow/tfjs'
import { Redis } from 'ioredis'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '../../logger'

import { auditLog } from '../audit-logging'
import { BiasDetectionEngine } from '../../ai/bias-detection/BiasDetectionEngine'

// Types
export interface EdgeDetectionConfig {
  location: string
  region: string
  coordinates: {
    latitude: number
    longitude: number
  }
  capabilities: string[]
  model_config: {
    anomaly_detection: ModelConfig
    classification: ModelConfig
    clustering: ModelConfig
    prediction: ModelConfig
  }
  thresholds: {
    anomaly_score: number
    threat_confidence: number
    bias_threshold: number
  }
  performance: {
    max_processing_time: number
    batch_size: number
    cache_size: number
  }
}

export interface ModelConfig {
  name: string
  version: string
  input_shape: number[]
  output_shape: number[]
  preprocessing: string[]
  postprocessing: string[]
  update_frequency: number
}

export interface ThreatDetection {
  id: string
  timestamp: Date
  location: string
  region: string
  input_data: DetectionInput
  models: {
    anomaly: ModelResult
    classification: ModelResult
    clustering: ModelResult
    prediction: ModelResult
  }
  bias_analysis: BiasAnalysis
  final_result: DetectionResult
  processing_time: number
  metadata: Record<string, unknown>
}

export interface DetectionInput {
  type: 'network' | 'behavioral' | 'content' | 'system'
  data: Record<string, unknown>
  context: Record<string, unknown>
  source: string
}

export interface ModelResult {
  model_name: string
  version: string
  predictions: number[]
  confidence: number
  features: string[]
  processing_time: number
  status: 'success' | 'failed' | 'timeout'
}

export interface BiasAnalysis {
  detected: boolean
  score: number
  types: string[]
  explanation: string
  mitigation_suggested: string[]
}

export interface DetectionResult {
  is_threat: boolean
  threat_type: string
  confidence: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  indicators: ThreatIndicator[]
  explanation: string
  recommended_actions: string[]
}

export interface ThreatIndicator {
  type: string
  value: string
  confidence: number
  source: string
}

export class EdgeThreatDetectionSystem extends EventEmitter {
  private redis: Redis
  private models: Map<string, tf.LayersModel> = new Map()
  private biasDetector: BiasDetectionEngine
  private isInitialized = false
  private processingQueue: DetectionInput[] = []
  private isProcessing = false
  private cache: Map<string, ThreatDetection> = new Map()
  private performanceMetrics: Map<string, number[]> = new Map()

  constructor(
    private config: EdgeDetectionConfig,
    redis: Redis,
  ) {
    super()
    this.redis = redis
    this.biasDetector = new BiasDetectionEngine()
    this.setMaxListeners(0)
  }

  /**
   * Initialize the edge threat detection system
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Edge Threat Detection System', {
        location: this.config.location,
        region: this.config.region,
      })

      // Initialize bias detection engine
      await this.biasDetector.initialize()

      // Load AI models
      await this.loadModels()

      // Set up Redis pub/sub for real-time processing
      await this.setupRedisPubSub()

      // Start processing queue
      this.startProcessingQueue()

      this.isInitialized = true
      logger.info('Edge Threat Detection System initialized successfully', {
        location: this.config.location,
        region: this.config.region,
      })

      this.emit('initialized', {
        location: this.config.location,
        region: this.config.region,
        timestamp: new Date(),
      })
    } catch (error) {
      logger.error('Failed to initialize Edge Threat Detection System', {
        error: error.message,
        location: this.config.location,
        region: this.config.region,
      })
      throw new Error(
        `Failed to initialize edge threat detection: ${error.message}`,
        { cause: error },
      )
    }
  }

  /**
   * Load AI models for threat detection
   */
  private async loadModels(): Promise<void> {
    try {
      const modelConfigs = [
        {
          name: 'anomaly_detection',
          config: this.config.model_config.anomaly_detection,
        },
        {
          name: 'classification',
          config: this.config.model_config.classification,
        },
        { name: 'clustering', config: this.config.model_config.clustering },
        { name: 'prediction', config: this.config.model_config.prediction },
      ]

      for (const { name, config } of modelConfigs) {
        try {
          const model = await this.loadModel(config)
          this.models.set(name, model)
          logger.info(`Model loaded successfully`, {
            model: name,
            version: config.version,
            location: this.config.location,
          })
        } catch (error) {
          logger.error(`Failed to load model`, {
            model: name,
            error: error.message,
            location: this.config.location,
          })
        }
      }

      logger.info('All models loaded', {
        count: this.models.size,
        location: this.config.location,
      })
    } catch (error) {
      logger.error('Failed to load models', {
        error: error.message,
        location: this.config.location,
      })
      throw error
    }
  }

  /**
   * Load individual model
   */
  private async loadModel(config: ModelConfig): Promise<tf.LayersModel> {
    try {
      // In a real implementation, this would load from model registry
      // For now, create a simple model architecture
      const model = tf.sequential({
        layers: [
          tf.layers.dense({
            inputShape: config.input_shape,
            units: 128,
            activation: 'relu',
          }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({ units: 64, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({
            units: config.output_shape[0],
            activation: 'sigmoid',
          }),
        ],
      })

      // Compile model
      model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy'],
      })

      return model
    } catch (error) {
      logger.error('Failed to create model', {
        error: error.message,
        model: config.name,
        location: this.config.location,
      })
      throw error
    }
  }

  /**
   * Set up Redis pub/sub for real-time threat detection
   */
  private async setupRedisPubSub(): Promise<void> {
    try {
      const subscriber = this.redis.duplicate()
      await subscriber.connect()

      // Subscribe to detection requests
      await subscriber.subscribe(
        `edge-detection-${this.config.location}`,
        async (message) => {
          try {
            const request = JSON.parse(message)
            await this.processDetectionRequest(request)
          } catch (error) {
            logger.error('Failed to process detection request', {
              error: error.message,
              location: this.config.location,
            })
          }
        },
      )

      // Subscribe to model updates
      await subscriber.subscribe('model-updates', async (message) => {
        try {
          const update = JSON.parse(message)
          await this.handleModelUpdate(update)
        } catch (error) {
          logger.error('Failed to handle model update', {
            error: error.message,
            location: this.config.location,
          })
        }
      })

      logger.info('Redis pub/sub setup completed', {
        location: this.config.location,
      })
    } catch (error) {
      logger.error('Failed to setup Redis pub/sub', {
        error: error.message,
        location: this.config.location,
      })
      throw error
    }
  }

  /**
   * Process detection request
   */
  async processDetectionRequest(request: {
    id: string
    input: DetectionInput
    priority?: 'low' | 'medium' | 'high'
  }): Promise<ThreatDetection> {
    if (!this.isInitialized) {
      throw new Error('Edge threat detection system not initialized')
    }

    const startTime = Date.now()
    const detectionId = request.id || uuidv4()

    try {
      logger.info('Processing threat detection request', {
        detectionId,
        inputType: request.input.type,
        location: this.config.location,
      })

      // Check cache first
      const cacheKey = this.generateCacheKey(request.input)
      const cachedResult = this.cache.get(cacheKey)
      if (cachedResult) {
        logger.debug('Returning cached detection result', {
          detectionId,
          location: this.config.location,
        })
        return cachedResult
      }

      // Preprocess input data
      const preprocessedData = await this.preprocessInput(request.input)

      // Run AI models
      const modelResults = await this.runModels(preprocessedData)

      // Perform bias analysis
      const biasAnalysis = await this.analyzeBias(request.input, modelResults)

      // Generate final result
      const finalResult = await this.generateFinalResult(
        request.input,
        modelResults,
        biasAnalysis,
      )

      // Create detection record
      const detection: ThreatDetection = {
        id: detectionId,
        timestamp: new Date(),
        location: this.config.location,
        region: this.config.region,
        input_data: request.input,
        models: modelResults,
        bias_analysis: biasAnalysis,
        final_result: finalResult,
        processing_time: Date.now() - startTime,
        metadata: {
          priority: request.priority || 'medium',
          cache_hit: false,
          model_versions: this.getModelVersions(),
        },
      }

      // Cache result
      this.cacheResult(cacheKey, detection)

      // Update performance metrics
      this.updatePerformanceMetrics(detection)

      // Emit detection event
      this.emit('threat:detected', detection)

      // Audit log
      await auditLog({
        action: 'threat_detection',
        resource: `detection:${detectionId}`,
        details: {
          location: this.config.location,
          is_threat: finalResult.is_threat,
          threat_type: finalResult.threat_type,
          confidence: finalResult.confidence,
        },
        userId: 'system',
        ip: request.input.source || 'unknown',
      })

      logger.info('Threat detection completed', {
        detectionId,
        isThreat: finalResult.is_threat,
        confidence: finalResult.confidence,
        processingTime: detection.processing_time,
        location: this.config.location,
      })

      return detection
    } catch (error) {
      logger.error('Failed to process detection request', {
        error: error.message,
        detectionId,
        location: this.config.location,
      })
      throw error
    }
  }

  /**
   * Preprocess input data for AI models
   */
  private async preprocessInput(input: DetectionInput): Promise<number[]> {
    try {
      // Convert input data to numerical features
      const features: number[] = []

      switch (input.type) {
        case 'network':
          features.push(...this.extractNetworkFeatures(input.data))
          break
        case 'behavioral':
          features.push(...this.extractBehavioralFeatures(input.data))
          break
        case 'content':
          features.push(...this.extractContentFeatures(input.data))
          break
        case 'system':
          features.push(...this.extractSystemFeatures(input.data))
          break
        default:
          throw new Error(`Unsupported input type: ${input.type}`)
      }

      // Normalize features
      return this.normalizeFeatures(features)
    } catch (error) {
      logger.error('Failed to preprocess input', {
        error: error.message,
        inputType: input.type,
        location: this.config.location,
      })
      throw error
    }
  }

  /**
   * Extract network-related features
   */
  private extractNetworkFeatures(data: Record<string, unknown>): number[] {
    const features = [
      data.packet_count || 0,
      data.bytes_transferred || 0,
      data.unique_destinations || 0,
      data.connection_duration || 0,
      data.protocol_type || 0,
      data.port_number || 0,
      data.flag_count || 0,
      data.error_rate || 0,
    ]

    return features.slice(0, 10) // Ensure consistent length
  }

  /**
   * Extract behavioral features
   */
  private extractBehavioralFeatures(data: Record<string, unknown>): number[] {
    const features = [
      data.login_attempts || 0,
      data.failed_logins || 0,
      data.access_frequency || 0,
      data.time_of_access || 0,
      data.resource_access_count || 0,
      data.privilege_escalation_attempts || 0,
      data.anomalous_actions || 0,
      data.session_duration || 0,
    ]

    return features.slice(0, 10)
  }

  /**
   * Extract content features
   */
  private extractContentFeatures(data: Record<string, unknown>): number[] {
    const features = [
      data.content_length || 0,
      data.keyword_density || 0,
      data.suspicious_keywords || 0,
      data.encoding_type || 0,
      data.attachment_count || 0,
      data.link_count || 0,
      data.script_count || 0,
      data.obfuscation_level || 0,
    ]

    return features.slice(0, 10)
  }

  /**
   * Extract system features
   */
  private extractSystemFeatures(data: Record<string, unknown>): number[] {
    const features = [
      data.cpu_usage || 0,
      data.memory_usage || 0,
      data.disk_io || 0,
      data.network_io || 0,
      data.process_count || 0,
      data.thread_count || 0,
      data.handle_count || 0,
      data.error_count || 0,
    ]

    return features.slice(0, 10)
  }

  /**
   * Normalize features to 0-1 range
   */
  private normalizeFeatures(features: number[]): number[] {
    const maxValues = [1000, 1000000, 100, 3600, 10, 65535, 100, 1] // Example max values
    return features.map((value, index) => {
      const max = maxValues[index] || 100
      return Math.min(value / max, 1)
    })
  }

  /**
   * Run AI models for threat detection
   */
  private async runModels(features: number[]): Promise<{
    anomaly: ModelResult
    classification: ModelResult
    clustering: ModelResult
    prediction: ModelResult
  }> {
    const results: Record<string, ModelResult> = {}

    for (const [modelName, model] of this.models) {
      try {
        const startTime = Date.now()

        // Prepare input tensor
        const inputTensor = tf.tensor2d([features])

        // Run model prediction
        const prediction = (await model.predict(inputTensor)) as tf.Tensor
        const predictions = await prediction.data()

        // Clean up tensors
        inputTensor.dispose()
        prediction.dispose()

        results[modelName] = {
          model_name: modelName,
          version:
            this.config.model_config[
              modelName as keyof typeof this.config.model_config
            ].version,
          predictions: Array.from(predictions),
          confidence: Math.max(...Array.from(predictions)),
          features: this.getFeatureNames(modelName),
          processing_time: Date.now() - startTime,
          status: 'success' as const,
        }

        logger.debug('Model prediction completed', {
          model: modelName,
          confidence: results[modelName].confidence,
          location: this.config.location,
        })
      } catch (error) {
        logger.error('Model prediction failed', {
          model: modelName,
          error: error.message,
          location: this.config.location,
        })

        results[modelName] = {
          model_name: modelName,
          version:
            this.config.model_config[
              modelName as keyof typeof this.config.model_config
            ].version,
          predictions: [],
          confidence: 0,
          features: [],
          processing_time: Date.now() - startTime,
          status: 'failed' as const,
        }
      }
    }

    return results
  }

  /**
   * Get feature names for a model
   */
  private getFeatureNames(modelName: string): string[] {
    const featureMap = {
      anomaly_detection: [
        'packet_count',
        'bytes_transferred',
        'unique_destinations',
        'connection_duration',
        'protocol_type',
        'port_number',
        'flag_count',
        'error_rate',
        'cpu_usage',
        'memory_usage',
      ],
      classification: [
        'login_attempts',
        'failed_logins',
        'access_frequency',
        'time_of_access',
        'resource_access_count',
        'privilege_escalation_attempts',
        'anomalous_actions',
        'session_duration',
        'content_length',
        'keyword_density',
      ],
      clustering: [
        'suspicious_keywords',
        'encoding_type',
        'attachment_count',
        'link_count',
        'script_count',
        'obfuscation_level',
        'disk_io',
        'network_io',
        'process_count',
        'thread_count',
      ],
      prediction: [
        'handle_count',
        'error_count',
        'historical_threats',
        'user_behavior_score',
        'system_anomalies',
        'network_anomalies',
        'content_risk_score',
        'temporal_patterns',
        'seasonal_patterns',
        'trend_analysis',
      ],
    }

    return featureMap[modelName as keyof typeof featureMap] || []
  }

  /**
   * Analyze bias in detection results
   */
  private async analyzeBias(
    input: DetectionInput,
    modelResults: Record<string, ModelResult>,
  ): Promise<BiasAnalysis> {
    try {
      // Combine all model predictions for bias analysis
      const allPredictions = Object.values(modelResults).flatMap(
        (result: ModelResult) => result.predictions || [],
      )

      const biasResult = await this.biasDetector.analyze({
        input: input.data,
        predictions: allPredictions,
        context: input.context,
        source: input.source,
      })

      return {
        detected: biasResult.bias_detected,
        score: biasResult.bias_score,
        types: biasResult.bias_types,
        explanation: biasResult.explanation,
        mitigation_suggested: biasResult.mitigation_steps,
      }
    } catch (error) {
      logger.error('Bias analysis failed', {
        error: error.message,
        location: this.config.location,
      })

      return {
        detected: false,
        score: 0,
        types: [],
        explanation: 'Bias analysis failed',
        mitigation_suggested: [],
      }
    }
  }

  /**
   * Generate final detection result
   */
  private async generateFinalResult(
    input: DetectionInput,
    modelResults: Record<string, ModelResult>,
    biasAnalysis: BiasAnalysis,
  ): Promise<DetectionResult> {
    try {
      // Combine model results using weighted ensemble
      const ensembleResult = this.ensemblePredictions(modelResults)

      // Apply bias correction if needed
      let finalConfidence = ensembleResult.confidence
      if (
        biasAnalysis.detected &&
        biasAnalysis.score > this.config.thresholds.bias_threshold
      ) {
        finalConfidence = Math.max(
          0,
          finalConfidence - biasAnalysis.score * 0.2,
        )
      }

      // Determine if threat based on confidence and thresholds
      const isThreat =
        finalConfidence > this.config.thresholds.threat_confidence

      // Generate threat type and severity
      const threatType = this.determineThreatType(modelResults, input.type)
      const severity = this.determineSeverity(
        finalConfidence,
        ensembleResult.anomaly_score,
      )

      // Extract indicators
      const indicators = this.extractThreatIndicators(
        input,
        modelResults,
        isThreat,
      )

      // Generate explanation
      const explanation = this.generateExplanation(
        input,
        modelResults,
        biasAnalysis,
        isThreat,
      )

      // Generate recommended actions
      const recommendedActions = this.generateRecommendedActions(
        isThreat,
        severity,
        threatType,
      )

      return {
        is_threat: isThreat,
        threat_type: threatType,
        confidence: finalConfidence,
        severity,
        indicators,
        explanation,
        recommended_actions: recommendedActions,
      }
    } catch (error) {
      logger.error('Failed to generate final result', {
        error: error.message,
        location: this.config.location,
      })
      throw error
    }
  }

  /**
   * Ensemble predictions from multiple models
   */
  private ensemblePredictions(modelResults: Record<string, ModelResult>): {
    confidence: number
    anomaly_score: number
  } {
    const weights = {
      anomaly_detection: 0.3,
      classification: 0.25,
      clustering: 0.2,
      prediction: 0.25,
    }

    let weightedConfidence = 0
    let weightedAnomalyScore = 0
    let totalWeight = 0

    for (const [modelName, result] of Object.entries(modelResults)) {
      const weight = weights[modelName as keyof typeof weights] || 0
      const confidence = result.confidence || 0
      const anomalyScore = result.predictions?.[0] || 0

      weightedConfidence += confidence * weight
      weightedAnomalyScore += anomalyScore * weight
      totalWeight += weight
    }

    return {
      confidence: totalWeight > 0 ? weightedConfidence / totalWeight : 0,
      anomaly_score: totalWeight > 0 ? weightedAnomalyScore / totalWeight : 0,
    }
  }

  /**
   * Determine threat type based on model results
   */
  private determineThreatType(
    modelResults: Record<string, ModelResult>,
    inputType: string,
  ): string {
    const classificationResult = modelResults.classification
    if (classificationResult && classificationResult.predictions.length > 0) {
      const maxIndex = classificationResult.predictions.indexOf(
        Math.max(...classificationResult.predictions),
      )
      const threatTypes = [
        'malware',
        'phishing',
        'ddos',
        'data_breach',
        'insider_threat',
        'ai_bias',
        'privacy_violation',
      ]
      return threatTypes[maxIndex] || 'unknown'
    }

    // Fallback to input type
    const typeMap = {
      network: 'network_intrusion',
      behavioral: 'insider_threat',
      content: 'malicious_content',
      system: 'system_compromise',
    }

    return typeMap[inputType as keyof typeof typeMap] || 'unknown'
  }

  /**
   * Determine severity based on confidence and anomaly score
   */
  private determineSeverity(
    confidence: number,
    anomalyScore: number,
  ): 'low' | 'medium' | 'high' | 'critical' {
    const combinedScore = (confidence + anomalyScore) / 2

    if (combinedScore >= 0.9) return 'critical'
    if (combinedScore >= 0.7) return 'high'
    if (combinedScore >= 0.5) return 'medium'
    return 'low'
  }

  /**
   * Extract threat indicators
   */
  private extractThreatIndicators(
    input: DetectionInput,
    modelResults: Record<string, ModelResult>,
    isThreat: boolean,
  ): ThreatIndicator[] {
    const indicators: ThreatIndicator[] = []

    if (isThreat) {
      // Extract indicators based on input type and model results
      switch (input.type) {
        case 'network':
          if (input.data.ip_address) {
            indicators.push({
              type: 'ip_address',
              value: input.data.ip_address,
              confidence: modelResults.anomaly.confidence,
              source: 'anomaly_detection',
            })
          }
          break
        case 'behavioral':
          if (input.data.user_id) {
            indicators.push({
              type: 'user_id',
              value: input.data.user_id,
              confidence: modelResults.classification.confidence,
              source: 'classification',
            })
          }
          break
        case 'content':
          if (input.data.hash) {
            indicators.push({
              type: 'file_hash',
              value: input.data.hash,
              confidence: modelResults.clustering.confidence,
              source: 'clustering',
            })
          }
          break
        case 'system':
          if (input.data.process_id) {
            indicators.push({
              type: 'process_id',
              value: input.data.process_id,
              confidence: modelResults.prediction.confidence,
              source: 'prediction',
            })
          }
          break
      }
    }

    return indicators
  }

  /**
   * Generate explanation for detection result
   */
  private generateExplanation(
    input: DetectionInput,
    modelResults: Record<string, ModelResult>,
    biasAnalysis: BiasAnalysis,
    isThreat: boolean,
  ): string {
    let explanation = `Based on ${input.type} analysis, `

    if (isThreat) {
      explanation += `potential threat detected with high confidence. `

      // Add model-specific explanations
      if (modelResults.anomaly.confidence > 0.7) {
        explanation += `Anomaly detection identified unusual patterns. `
      }
      if (modelResults.classification.confidence > 0.7) {
        explanation += `Classification model confirmed threat category. `
      }
    } else {
      explanation += `no significant threats identified. `
    }

    // Add bias information if detected
    if (biasAnalysis.detected) {
      explanation += `Bias analysis flagged potential fairness issues. `
    }

    return explanation.trim()
  }

  /**
   * Generate recommended actions
   */
  private generateRecommendedActions(
    isThreat: boolean,
    severity: string,
    threatType: string,
  ): string[] {
    const actions: string[] = []

    if (isThreat) {
      actions.push('Investigate the detected threat immediately')

      switch (severity) {
        case 'critical':
          actions.push('Isolate affected systems')
          actions.push('Activate incident response team')
          actions.push('Notify security operations center')
          break
        case 'high':
          actions.push('Monitor affected systems closely')
          actions.push('Review access logs')
          actions.push('Consider temporary access restrictions')
          break
        case 'medium':
          actions.push('Increase monitoring frequency')
          actions.push('Review security policies')
          break
        case 'low':
          actions.push('Continue normal monitoring')
          actions.push('Document for trend analysis')
          break
      }

      // Add threat-specific actions
      switch (threatType) {
        case 'malware':
          actions.push('Run antivirus scan')
          actions.push('Check for file integrity')
          break
        case 'phishing':
          actions.push('Educate users about phishing')
          actions.push('Review email filters')
          break
        case 'insider_threat':
          actions.push('Review user access permissions')
          actions.push('Monitor user behavior')
          break
      }
    } else {
      actions.push('Continue normal operations')
      actions.push('Maintain regular monitoring')
    }

    return actions
  }

  /**
   * Generate cache key for detection input
   */
  private generateCacheKey(input: DetectionInput): string {
    const dataHash = JSON.stringify(input.data)
    const contextHash = JSON.stringify(input.context)
    return `${input.type}:${this.hashString(dataHash + contextHash)}`
  }

  /**
   * Simple hash function for cache keys
   */
  private hashString(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }

  /**
   * Cache detection result
   */
  private cacheResult(cacheKey: string, detection: ThreatDetection): void {
    if (this.cache.size >= this.config.performance.cache_size) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }
    this.cache.set(cacheKey, detection)
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(detection: ThreatDetection): void {
    const metric = `processing_time_${detection.final_result.severity}`
    const times = this.performanceMetrics.get(metric) || []
    times.push(detection.processing_time)

    // Keep only last 100 measurements
    if (times.length > 100) {
      times.shift()
    }

    this.performanceMetrics.set(metric, times)
  }

  /**
   * Start processing queue
   */
  private startProcessingQueue(): void {
    setInterval(async () => {
      if (this.processingQueue.length > 0 && !this.isProcessing) {
        await this.processQueue()
      }
    }, 100) // Check every 100ms
  }

  /**
   * Process detection queue
   */
  private async processQueue(): Promise<void> {
    this.isProcessing = true

    try {
      const batch = this.processingQueue.splice(
        0,
        this.config.performance.batch_size,
      )

      const processingPromises = batch.map(async (input) => {
        try {
          return await this.processDetectionRequest({ input })
        } catch (error) {
          logger.error('Queue processing failed for input', {
            error: error.message,
            location: this.config.location,
          })
          return null
        }
      })

      await Promise.all(processingPromises)
    } catch (error) {
      logger.error('Queue processing batch failed', {
        error: error.message,
        location: this.config.location,
      })
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Handle model updates
   */
  private async handleModelUpdate(update: {
    model_name: string
    version: string
  }): Promise<void> {
    try {
      logger.info('Processing model update', {
        model: update.model_name,
        version: update.version,
        location: this.config.location,
      })

      // Reload the specific model
      const modelConfig =
        this.config.model_config[
          update.model_name as keyof typeof this.config.model_config
        ]
      if (modelConfig) {
        const newModel = await this.loadModel(modelConfig)
        this.models.set(update.model_name, newModel)

        logger.info('Model updated successfully', {
          model: update.model_name,
          version: update.version,
          location: this.config.location,
        })
      }
    } catch (error) {
      logger.error('Failed to handle model update', {
        error: error.message,
        location: this.config.location,
      })
    }
  }

  /**
   * Get model versions
   */
  private getModelVersions(): Record<string, string> {
    const versions: Record<string, string> = {}
    for (const [name, config] of Object.entries(this.config.model_config)) {
      versions[name] = config.version
    }
    return versions
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): Record<
    string,
    { avg: number; min: number; max: number; count: number }
  > {
    const metrics: Record<
      string,
      { avg: number; min: number; max: number; count: number }
    > = {}

    for (const [metric, times] of this.performanceMetrics) {
      if (times.length > 0) {
        metrics[metric] = {
          avg: times.reduce((a, b) => a + b, 0) / times.length,
          min: Math.min(...times),
          max: Math.max(...times),
          count: times.length,
        }
      }
    }

    return metrics
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hit_rate: number; miss_rate: number } {
    // This is a simplified implementation
    // In a real system, you'd track actual hits and misses
    return {
      size: this.cache.size,
      hit_rate: 0.85, // Placeholder
      miss_rate: 0.15, // Placeholder
    }
  }

  /**
   * Submit detection request to queue
   */
  async submitDetectionRequest(
    input: DetectionInput,
    priority: 'low' | 'medium' | 'high' = 'medium',
  ): Promise<string> {
    const requestId = uuidv4()

    this.processingQueue.push({
      ...input,
      metadata: { ...input.context, priority, requestId },
    })

    // Sort queue by priority
    this.processingQueue.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      const aPriority = priorityOrder[a.metadata?.priority || 'medium']
      const bPriority = priorityOrder[b.metadata?.priority || 'medium']
      return bPriority - aPriority
    })

    logger.info('Detection request queued', {
      requestId,
      priority,
      location: this.config.location,
    })

    return requestId
  }

  /**
   * Shutdown the system
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down Edge Threat Detection System', {
        location: this.config.location,
      })

      // Dispose of TensorFlow models
      for (const [name, model] of this.models) {
        model.dispose()
        logger.debug('Model disposed', {
          model: name,
          location: this.config.location,
        })
      }

      // Shutdown bias detector
      await this.biasDetector.shutdown()

      this.isInitialized = false
      this.emit('shutdown', {
        location: this.config.location,
        timestamp: new Date(),
      })

      logger.info('Edge Threat Detection System shutdown completed', {
        location: this.config.location,
      })
    } catch (error) {
      logger.error('Error during shutdown', {
        error: error.message,
        location: this.config.location,
      })
      throw error
    }
  }

  /**
   * Get initialization status
   */
  get isReady(): boolean {
    return this.isInitialized
  }

  /**
   * Get current configuration
   */
  get config(): EdgeDetectionConfig {
    return this.config
  }
}

export default EdgeThreatDetectionSystem
