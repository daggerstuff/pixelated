/**
 * Edge Threat Detection System with AI Models
 * Provides real-time threat detection at the edge with ML-powered analysis
 */

import { EventEmitter } from 'events'
import { Redis } from 'ioredis'
import * as tf from '@tensorflow/tfjs'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'

import {
  EdgeDetectionConfig,
  EdgeDetectionResult,
  EdgeNodeStatus,
  AIModelConfig,
  ThreatIndicator,
  RealTimeThreatData,
} from '../global/types'

const logger = createBuildSafeLogger('edge-threat-detection')

export interface EdgeThreatDetectionSystem {
  initialize(): Promise<void>
  detectThreat(threatData: RealTimeThreatData): Promise<EdgeDetectionResult>
  getEdgeNodeStatus(nodeId: string): Promise<EdgeNodeStatus>
  deployAIModel(modelConfig: AIModelConfig, nodeIds: string[]): Promise<boolean>
  updateDetectionThresholds(thresholds: DetectionThresholds): Promise<boolean>
  getHealthStatus(): Promise<HealthStatus>
  shutdown(): Promise<void>
}

export interface DetectionThresholds {
  anomaly: number
  threat: number
  confidence: number
  severity: {
    low: number
    medium: number
    high: number
    critical: number
  }
}

export interface HealthStatus {
  healthy: boolean
  message: string
  responseTime?: number
  activeNodes?: number
  totalNodes?: number
}

export interface ModelPerformance {
  modelId: string
  accuracy: number
  precision: number
  recall: number
  f1Score: number
  inferenceTime: number
  memoryUsage: number
}

export class EdgeThreatDetectionSystemCore
  extends EventEmitter
  implements EdgeThreatDetectionSystem {
  private redis: Redis
  private models: Map<string, tf.GraphModel | tf.Sequential> = new Map()
  private nodeStatus: Map<string, EdgeNodeStatus> = new Map()
  private detectionThresholds: DetectionThresholds
  private modelPerformance: Map<string, ModelPerformance> = new Map()

  constructor(private config: EdgeDetectionConfig) {
    super()
    this.detectionThresholds = config.detectionThresholds
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Edge Threat Detection System')

      // Initialize Redis connection
      await this.initializeRedis()

      // Load AI models
      await this.loadAIModels()

      // Initialize edge node tracking
      await this.initializeEdgeNodes()

      // Start model monitoring
      await this.startModelMonitoring()

      this.emit('system_initialized')
      logger.info('Edge Threat Detection System initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize Edge Threat Detection System:', {
        error,
      })
      this.emit('initialization_error', { error })
      throw error
    }
  }

  private async initializeRedis(): Promise<void> {
    try {
      this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
      await this.redis.ping()
      logger.info('Redis connection established for edge detection')
    } catch (error) {
      logger.error('Failed to connect to Redis:', { error })
      throw new Error('Redis connection failed', { cause: error })
    }
  }

  private async loadAIModels(): Promise<void> {
    try {
      for (const modelConfig of this.config.aiModels) {
        await this.loadModel(modelConfig)
      }
      logger.info(`Loaded ${this.config.aiModels.length} AI models`)
    } catch (error) {
      logger.error('Failed to load AI models:', { error })
      throw error
    }
  }

  private async loadModel(modelConfig: AIModelConfig): Promise<void> {
    try {
      logger.info(`Loading AI model: ${modelConfig.modelId}`)

      let model: tf.GraphModel | tf.Sequential

      switch (modelConfig.framework) {
        case 'tensorflow':
          model = await this.loadTensorFlowModel(modelConfig)
          break
        default:
          throw new Error(`Unsupported framework: ${modelConfig.framework}`)
      }

      this.models.set(modelConfig.modelId, model)

      // Initialize performance tracking
      this.modelPerformance.set(modelConfig.modelId, {
        modelId: modelConfig.modelId,
        accuracy: modelConfig.performance.accuracy,
        precision: modelConfig.performance.precision,
        recall: modelConfig.performance.recall,
        f1Score: modelConfig.performance.f1Score,
        inferenceTime: 0,
        memoryUsage: 0,
      })

      logger.info(`AI model loaded successfully: ${modelConfig.modelId}`)
    } catch (error) {
      logger.error(`Failed to load AI model ${modelConfig.modelId}:`, { error })
      throw error
    }
  }

  private async loadTensorFlowModel(
    modelConfig: AIModelConfig,
  ): Promise<tf.GraphModel | tf.Sequential> {
    try {
      // In a real implementation, this would load a pre-trained model
      // For now, create a dummy model based on the configuration

      const model = tf.sequential()

      // Add layers based on model type
      switch (modelConfig.modelType) {
        case 'anomaly':
          this.buildAnomalyDetectionModel(model, modelConfig)
          break
        case 'classification':
          this.buildClassificationModel(model, modelConfig)
          break
        case 'clustering':
          this.buildClusteringModel(model, modelConfig)
          break
        case 'prediction':
          this.buildPredictionModel(model, modelConfig)
          break
        default:
          throw new Error(`Unsupported model type: ${modelConfig.modelType}`)
      }

      // Compile the model
      model.compile({
        optimizer: tf.train.adam(0.001),
        loss: this.getLossFunction(modelConfig.modelType),
        metrics: ['accuracy'],
      })

      return model
    } catch (error) {
      logger.error(`Failed to build TensorFlow model ${modelConfig.modelId}:`, {
        error,
      })
      throw error
    }
  }

  private buildAnomalyDetectionModel(
    model: tf.Sequential,
    _modelConfig: AIModelConfig,
  ): void {
    // Autoencoder architecture for anomaly detection
    model.add(
      tf.layers.dense({
        units: 64,
        activation: 'relu',
        inputShape: [10],
      }),
    )

    model.add(
      tf.layers.dense({
        units: 32,
        activation: 'relu',
      }),
    )

    model.add(
      tf.layers.dense({
        units: 16,
        activation: 'relu',
      }),
    )

    model.add(
      tf.layers.dense({
        units: 8,
        activation: 'relu',
      }),
    )

    // Decoder
    model.add(
      tf.layers.dense({
        units: 16,
        activation: 'relu',
      }),
    )

    model.add(
      tf.layers.dense({
        units: 32,
        activation: 'relu',
      }),
    )

    model.add(
      tf.layers.dense({
        units: 64,
        activation: 'relu',
      }),
    )

    model.add(
      tf.layers.dense({
        units: 10,
        activation: 'sigmoid',
      }),
    )
  }

  private buildClassificationModel(
    model: tf.Sequential,
    _modelConfig: AIModelConfig,
  ): void {
    // Classification model for threat categorization
    model.add(
      tf.layers.dense({
        units: 128,
        activation: 'relu',
        inputShape: [10],
      }),
    )

    model.add(tf.layers.dropout({ rate: 0.3 }))

    model.add(
      tf.layers.dense({
        units: 64,
        activation: 'relu',
      }),
    )

    model.add(tf.layers.dropout({ rate: 0.2 }))

    model.add(
      tf.layers.dense({
        units: 32,
        activation: 'relu',
      }),
    )

    model.add(
      tf.layers.dense({
        units: 4, // 4 threat categories: low, medium, high, critical
        activation: 'softmax',
      }),
    )
  }

  private buildClusteringModel(
    model: tf.Sequential,
    _modelConfig: AIModelConfig,
  ): void {
    // Clustering model for threat grouping
    model.add(
      tf.layers.dense({
        units: 64,
        activation: 'relu',
        inputShape: [10],
      }),
    )

    model.add(
      tf.layers.dense({
        units: 32,
        activation: 'relu',
      }),
    )

    model.add(
      tf.layers.dense({
        units: 16,
        activation: 'relu',
      }),
    )

    model.add(
      tf.layers.dense({
        units: 8,
        activation: 'relu',
      }),
    )
  }

  private buildPredictionModel(
    model: tf.Sequential,
    _modelConfig: AIModelConfig,
  ): void {
    // Prediction model for threat forecasting
    model.add(
      tf.layers.dense({
        units: 100,
        activation: 'relu',
        inputShape: [10],
      }),
    )

    model.add(tf.layers.dropout({ rate: 0.2 }))

    model.add(
      tf.layers.dense({
        units: 50,
        activation: 'relu',
      }),
    )

    model.add(tf.layers.dropout({ rate: 0.2 }))

    model.add(
      tf.layers.dense({
        units: 25,
        activation: 'relu',
      }),
    )

    model.add(
      tf.layers.dense({
        units: 1,
        activation: 'sigmoid',
      }),
    )
  }

  private getLossFunction(modelType: string): string {
    switch (modelType) {
      case 'anomaly':
        return 'meanSquaredError'
      case 'classification':
        return 'categoricalCrossentropy'
      case 'clustering':
        return 'meanSquaredError'
      case 'prediction':
        return 'binaryCrossentropy'
      default:
        return 'meanSquaredError'
    }
  }

  private async initializeEdgeNodes(): Promise<void> {
    try {
      // Initialize status for configured edge nodes
      for (const region of this.config.regions || []) {
        for (const node of region.edgeNodes || []) {
          this.nodeStatus.set(node.nodeId, {
            nodeId: node.nodeId,
            region: region.regionId,
            status: 'online',
            load: 0,
            memoryUsage: 0,
            cpuUsage: 0,
            activeModels: node.aiModels || [],
            lastHeartbeat: new Date(),
          })
        }
      }

      logger.info(`Initialized ${this.nodeStatus.size} edge nodes`)
    } catch (error) {
      logger.error('Failed to initialize edge nodes:', { error })
      throw error
    }
  }

  private async startModelMonitoring(): Promise<void> {
    // Start periodic model performance monitoring
    setInterval(async () => {
      await this.monitorModelPerformance()
    }, 60000) // Every minute
  }

  private async monitorModelPerformance(): Promise<void> {
    try {
      for (const [modelId, _model] of this.models) {
        const performance = this.modelPerformance.get(modelId)
        if (performance) {
          // Simulate performance monitoring
          // In a real implementation, this would collect actual metrics
          performance.inferenceTime = Math.random() * 100 + 50 // 50-150ms
          performance.memoryUsage = Math.random() * 100 + 100 // 100-200MB

          // Check for performance degradation
          if (
            performance.inferenceTime > 200 ||
            performance.memoryUsage > 500
          ) {
            this.emit('model_performance_degraded', { modelId, performance })
          }
        }
      }
    } catch (error) {
      logger.error('Model monitoring error:', { error })
    }
  }

  async detectThreat(
    threatData: RealTimeThreatData,
  ): Promise<EdgeDetectionResult> {
    try {
      logger.info('Detecting threat at edge', {
        threatId: threatData.threatId,
        region: threatData.region,
      })

      const startTime = Date.now()

      // Step 1: Preprocess threat data
      const processedData = await this.preprocessThreatData(threatData)

      // Step 2: Extract features for ML models
      const features = await this.extractFeatures(processedData)

      // Step 3: Run anomaly detection
      const anomalyScore = await this.detectAnomaly(features)

      // Step 4: Run threat classification
      const classificationResult = await this.classifyThreat(features)

      // Step 5: Run threat prediction
      const predictionScore = await this.predictThreat(features)

      // Step 6: Combine results and make final decision
      const finalResult = await this.combineResults(
        anomalyScore,
        classificationResult,
        predictionScore,
        features,
      )

      // Step 7: Create detection result
      const detectionResult: EdgeDetectionResult = {
        detectionId: this.generateDetectionId(),
        edgeNodeId: this.selectOptimalEdgeNode(threatData.region),
        region: threatData.region,
        threatType: finalResult.threatType,
        severity: finalResult.severity,
        confidence: finalResult.confidence,
        indicators: this.extractIndicators(threatData, finalResult),
        aiModel: finalResult.primaryModel,
        processingTime: Date.now() - startTime,
        timestamp: new Date(),
      }

      // Step 8: Cache result for real-time access
      await this.cacheDetectionResult(detectionResult)

      // Step 9: Update edge node status
      await this.updateEdgeNodeStatus(
        detectionResult.edgeNodeId,
        detectionResult.processingTime,
      )

      this.emit('threat_detected', {
        detectionId: detectionResult.detectionId,
        threatId: threatData.threatId,
        severity: detectionResult.severity,
      })

      return detectionResult
    } catch (error) {
      logger.error('Failed to detect threat at edge:', {
        error,
        threatId: threatData.threatId,
      })
      this.emit('detection_error', { error, threatId: threatData.threatData })
      throw error
    }
  }

  private async preprocessThreatData(
    threatData: RealTimeThreatData,
  ): Promise<ProcessedThreatData> {
    // Normalize and validate threat data
    return {
      threatId: threatData.threatId,
      timestamp: threatData.timestamp,
      region: threatData.region,
      severity: threatData.severity,
      confidence: threatData.confidence,
      indicators: threatData.indicators,
      context: threatData.context,
      normalizedSeverity: this.normalizeSeverity(threatData.severity),
      featureVector: this.createFeatureVector(threatData),
    }
  }

  private normalizeSeverity(severity: number): number {
    // Normalize severity to 0-1 range
    return Math.max(0, Math.min(1, severity))
  }

  private createFeatureVector(threatData: RealTimeThreatData): number[] {
    // Create numerical feature vector for ML models
    const features: number[] = []

    // Threat severity
    features.push(threatData.severity)

    // Confidence level
    features.push(threatData.confidence)

    // Number of indicators
    features.push(threatData.indicators.length / 10) // Normalize to 0-1

    // Time-based features
    const hour = threatData.timestamp.getHours()
    features.push(hour / 24) // Hour of day (0-1)
    features.push(hour >= 9 && hour <= 17 ? 1 : 0) // Business hours

    // Indicator type distribution
    const indicatorTypes = new Set(
      threatData.indicators.map((i) => i.indicatorType),
    )
    features.push(indicatorTypes.size / 5) // Normalize to 0-1

    // Geographic features (if available)
    if (threatData.context?.geographicLocation) {
      features.push(1) // Has location
    } else {
      features.push(0) // No location
    }

    // Pad or truncate to fixed size (10 features)
    while (features.length < 10) {
      features.push(0)
    }

    return features.slice(0, 10)
  }

  private async extractFeatures(
    processedData: ProcessedThreatData,
  ): Promise<number[]> {
    return processedData.featureVector
  }

  private async detectAnomaly(features: number[]): Promise<number> {
    try {
      const anomalyModel = this.models.get('anomaly_detection')
      if (!anomalyModel) {
        logger.warn('Anomaly detection model not found, using fallback')
        return this.fallbackAnomalyDetection(features)
      }

      const input = tf.tensor2d([features])
      const prediction = (await anomalyModel.predict(input)) as tf.Tensor
      const anomalyScore = await prediction.data()

      input.dispose()
      prediction.dispose()

      return anomalyScore[0]
    } catch (error) {
      logger.error('Anomaly detection failed:', { error })
      return this.fallbackAnomalyDetection(features)
    }
  }

  private fallbackAnomalyDetection(features: number[]): number {
    // Simple statistical anomaly detection
    const mean = features.reduce((sum, val) => sum + val, 0) / features.length
    const variance =
      features.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      features.length
    const stdDev = Math.sqrt(variance)

    // Calculate z-score for the most anomalous feature
    const maxDeviation = Math.max(...features.map((f) => Math.abs(f - mean)))
    const zScore = maxDeviation / (stdDev || 1)

    // Normalize to 0-1 range
    return Math.min(zScore / 3, 1)
  }

  private async classifyThreat(
    features: number[],
  ): Promise<ClassificationResult> {
    try {
      const classificationModel = this.models.get('threat_classification')
      if (!classificationModel) {
        logger.warn('Classification model not found, using fallback')
        return this.fallbackClassification(features)
      }

      const input = tf.tensor2d([features])
      const prediction = (await classificationModel.predict(input)) as tf.Tensor
      const probabilities = await prediction.data()

      input.dispose()
      prediction.dispose()

      // Map probabilities to threat types
      const threatTypes = ['low', 'medium', 'high', 'critical']
      const maxIndex = probabilities.indexOf(
        Math.max(...Array.from(probabilities)),
      )

      return {
        threatType: threatTypes[maxIndex],
        confidence: probabilities[maxIndex],
        probabilities: Array.from(probabilities),
      }
    } catch (error) {
      logger.error('Threat classification failed:', { error })
      return this.fallbackClassification(features)
    }
  }

  private fallbackClassification(features: number[]): ClassificationResult {
    // Simple rule-based classification
    const avgFeature =
      features.reduce((sum, val) => sum + val, 0) / features.length

    if (avgFeature > 0.7) {
      return {
        threatType: 'critical',
        confidence: 0.8,
        probabilities: [0.1, 0.2, 0.3, 0.4],
      }
    } else if (avgFeature > 0.5) {
      return {
        threatType: 'high',
        confidence: 0.7,
        probabilities: [0.2, 0.3, 0.4, 0.1],
      }
    } else if (avgFeature > 0.3) {
      return {
        threatType: 'medium',
        confidence: 0.6,
        probabilities: [0.3, 0.4, 0.2, 0.1],
      }
    } else {
      return {
        threatType: 'low',
        confidence: 0.5,
        probabilities: [0.4, 0.3, 0.2, 0.1],
      }
    }
  }

  private async predictThreat(features: number[]): Promise<number> {
    try {
      const predictionModel = this.models.get('threat_prediction')
      if (!predictionModel) {
        logger.warn('Prediction model not found, using fallback')
        return this.fallbackPrediction(features)
      }

      const input = tf.tensor2d([features])
      const prediction = (await predictionModel.predict(input)) as tf.Tensor
      const threatProbability = await prediction.data()

      input.dispose()
      prediction.dispose()

      return threatProbability[0]
    } catch (error) {
      logger.error('Threat prediction failed:', { error })
      return this.fallbackPrediction(features)
    }
  }

  private fallbackPrediction(features: number[]): number {
    // Simple linear prediction based on feature average
    const avgFeature =
      features.reduce((sum, val) => sum + val, 0) / features.length
    return Math.min(avgFeature * 1.2, 1) // Scale up slightly and cap at 1
  }

  private async combineResults(
    anomalyScore: number,
    classificationResult: ClassificationResult,
    predictionScore: number,
    _features: number[],
  ): Promise<CombinedResult> {
    try {
      // Weighted combination of results
      const weights = {
        anomaly: 0.3,
        classification: 0.4,
        prediction: 0.3,
      }

      // Calculate weighted severity score
      const severityScore =
        anomalyScore * weights.anomaly +
        this.mapThreatTypeToScore(classificationResult.threatType) *
        weights.classification +
        predictionScore * weights.prediction

      // Determine final threat type based on combined score
      const finalThreatType = this.determineFinalThreatType(
        severityScore,
        classificationResult,
      )

      // Calculate final confidence
      const finalConfidence = this.calculateFinalConfidence(
        classificationResult.confidence,
        anomalyScore,
        predictionScore,
      )

      // Select primary model based on highest confidence
      const primaryModel = this.selectPrimaryModel(
        anomalyScore,
        classificationResult,
        predictionScore,
      )

      return {
        threatType: finalThreatType,
        severity: this.mapScoreToSeverity(severityScore),
        confidence: finalConfidence,
        primaryModel,
        scores: {
          anomaly: anomalyScore,
          classification: classificationResult.confidence,
          prediction: predictionScore,
          combined: severityScore,
        },
      }
    } catch (error) {
      logger.error('Failed to combine detection results:', { error })
      throw error
    }
  }

  private mapThreatTypeToScore(threatType: string): number {
    const scores = {
      low: 0.2,
      medium: 0.5,
      high: 0.8,
      critical: 1.0,
    }
    return scores[threatType as keyof typeof scores] || 0.5
  }

  private determineFinalThreatType(
    severityScore: number,
    _classificationResult: ClassificationResult,
  ): string {
    // Use classification result as primary, but adjust based on combined score
    if (severityScore > 0.8) return 'critical'
    if (severityScore > 0.6) return 'high'
    if (severityScore > 0.4) return 'medium'
    return 'low'
  }

  private calculateFinalConfidence(
    classificationConfidence: number,
    anomalyScore: number,
    predictionScore: number,
  ): number {
    // Weighted average of confidences
    return (
      classificationConfidence * 0.5 +
      anomalyScore * 0.3 +
      predictionScore * 0.2
    )
  }

  private selectPrimaryModel(
    anomalyScore: number,
    classificationResult: ClassificationResult,
    predictionScore: number,
  ): string {
    const scores = {
      anomaly_detection: anomalyScore,
      threat_classification: classificationResult.confidence,
      threat_prediction: predictionScore,
    }

    let maxScore = 0
    let primaryModel = 'threat_classification' // Default

    for (const [model, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score
        primaryModel = model
      }
    }

    return primaryModel
  }

  private mapScoreToSeverity(
    score: number,
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 0.8) return 'critical'
    if (score >= 0.6) return 'high'
    if (score >= 0.4) return 'medium'
    return 'low'
  }

  private extractIndicators(
    threatData: RealTimeThreatData,
    finalResult: CombinedResult,
  ): ThreatIndicator[] {
    // Extract and enhance indicators based on detection results
    const enhancedIndicators: ThreatIndicator[] = []

    for (const indicator of threatData.indicators) {
      enhancedIndicators.push({
        ...indicator,
        confidence: Math.min(indicator.confidence * finalResult.confidence, 1),
        metadata: {
          ...indicator.metadata,
          edgeDetectionScore: finalResult.scores.combined,
          primaryModel: finalResult.primaryModel,
        },
      })
    }

    return enhancedIndicators
  }

  private selectOptimalEdgeNode(region: string): string {
    // Select the edge node with the lowest load and highest availability
    const nodes = Array.from(this.nodeStatus.values()).filter(
      (node) => node.region === region,
    )

    if (nodes.length === 0) {
      return 'default_node'
    }

    // Sort by load (ascending) and select the first one
    nodes.sort((a, b) => a.load - b.load)
    return nodes[0].nodeId
  }

  private async cacheDetectionResult(
    result: EdgeDetectionResult,
  ): Promise<void> {
    const cacheKey = `edge_detection:${result.detectionId}`
    const cacheData = {
      detectionId: result.detectionId,
      threatType: result.threatType,
      severity: result.severity,
      confidence: result.confidence,
      region: result.region,
      timestamp: result.timestamp,
    }

    await this.redis.setex(cacheKey, 1800, JSON.stringify(cacheData)) // 30 minutes TTL
  }

  private async updateEdgeNodeStatus(
    nodeId: string,
    processingTime: number,
  ): Promise<void> {
    const status = this.nodeStatus.get(nodeId)
    if (status) {
      status.lastHeartbeat = new Date()
      status.load = Math.min(status.load + processingTime / 1000, 100) // Simple load calculation
      status.memoryUsage = Math.random() * 80 + 10 // Simulate memory usage
      status.cpuUsage = Math.random() * 70 + 10 // Simulate CPU usage
    }
  }

  async getEdgeNodeStatus(nodeId: string): Promise<EdgeNodeStatus> {
    const status = this.nodeStatus.get(nodeId)
    if (!status) {
      throw new Error(`Edge node not found: ${nodeId}`)
    }
    return status
  }

  async deployAIModel(
    modelConfig: AIModelConfig,
    nodeIds: string[],
  ): Promise<boolean> {
    try {
      logger.info('Deploying AI model to edge nodes', {
        modelId: modelConfig.modelId,
        nodeCount: nodeIds.length,
      })

      // Load the model first
      await this.loadModel(modelConfig)

      // Deploy to specified nodes
      for (const nodeId of nodeIds) {
        await this.deployModelToNode(modelConfig.modelId, nodeId)
      }

      this.emit('model_deployed', { modelId: modelConfig.modelId, nodeIds })
      return true
    } catch (error) {
      logger.error('Failed to deploy AI model:', {
        error,
        modelId: modelConfig.modelId,
      })
      this.emit('model_deployment_error', {
        error,
        modelId: modelConfig.modelId,
      })
      return false
    }
  }

  private async deployModelToNode(
    modelId: string,
    nodeId: string,
  ): Promise<void> {
    try {
      const status = this.nodeStatus.get(nodeId)
      if (!status) {
        throw new Error(`Edge node not found: ${nodeId}`)
      }

      // Add model to node's active models
      if (!status.activeModels.includes(modelId)) {
        status.activeModels.push(modelId)
      }

      // Update node status
      status.lastHeartbeat = new Date()

      logger.info(`Model ${modelId} deployed to node ${nodeId}`)
    } catch (error) {
      logger.error(`Failed to deploy model to node ${nodeId}:`, { error })
      throw error
    }
  }

  async updateDetectionThresholds(
    thresholds: DetectionThresholds,
  ): Promise<boolean> {
    try {
      logger.info('Updating detection thresholds', { thresholds })

      // Validate thresholds
      this.validateThresholds(thresholds)

      // Update thresholds
      this.detectionThresholds = thresholds

      // Cache new thresholds
      await this.redis.setex(
        'edge_detection_thresholds',
        3600,
        JSON.stringify(thresholds),
      )

      this.emit('thresholds_updated', { thresholds })
      return true
    } catch (error) {
      logger.error('Failed to update detection thresholds:', { error })
      return false
    }
  }

  private validateThresholds(thresholds: DetectionThresholds): void {
    if (thresholds.anomaly < 0 || thresholds.anomaly > 1) {
      throw new Error('Anomaly threshold must be between 0 and 1')
    }

    if (thresholds.threat < 0 || thresholds.threat > 1) {
      throw new Error('Threat threshold must be between 0 and 1')
    }

    if (thresholds.confidence < 0 || thresholds.confidence > 1) {
      throw new Error('Confidence threshold must be between 0 and 1')
    }

    // Validate severity thresholds
    const severityThresholds = thresholds.severity
    if (
      severityThresholds.low < 0 ||
      severityThresholds.low > 1 ||
      severityThresholds.medium < 0 ||
      severityThresholds.medium > 1 ||
      severityThresholds.high < 0 ||
      severityThresholds.high > 1 ||
      severityThresholds.critical < 0 ||
      severityThresholds.critical > 1
    ) {
      throw new Error('Severity thresholds must be between 0 and 1')
    }
  }

  async getHealthStatus(): Promise<HealthStatus> {
    try {
      const startTime = Date.now()

      // Check Redis connection
      const redisHealthy = await this.checkRedisHealth()
      if (!redisHealthy) {
        return {
          healthy: false,
          message: 'Redis connection failed',
        }
      }

      // Check model availability
      const modelCount = this.models.size
      if (modelCount === 0) {
        return {
          healthy: false,
          message: 'No AI models available',
        }
      }

      // Check edge node availability
      const activeNodes = Array.from(this.nodeStatus.values()).filter(
        (node) => node.status === 'online',
      ).length
      const totalNodes = this.nodeStatus.size

      if (activeNodes === 0) {
        return {
          healthy: false,
          message: 'No active edge nodes',
        }
      }

      const responseTime = Date.now() - startTime

      return {
        healthy: true,
        message: 'Edge threat detection system is healthy',
        responseTime,
        activeNodes,
        totalNodes,
      }
    } catch (error) {
      logger.error('Health check failed:', { error })
      return {
        healthy: false,
        message: `Health check failed: ${error}`,
      }
    }
  }

  private async checkRedisHealth(): Promise<boolean> {
    try {
      const result = await this.redis.ping()
      return result === 'PONG'
    } catch (error) {
      logger.error('Redis health check failed:', { error })
      return false
    }
  }

  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down Edge Threat Detection System')

      // Dispose of TensorFlow models
      for (const [modelId, model] of this.models) {
        if (model instanceof tf.Sequential) {
          model.dispose()
        }
        logger.info(`Disposed model: ${modelId}`)
      }

      this.models.clear()
      this.modelPerformance.clear()

      // Close Redis connection
      if (this.redis) {
        await this.redis.quit()
      }

      this.emit('system_shutdown')
      logger.info('Edge Threat Detection System shutdown completed')
    } catch (error) {
      logger.error('Error during shutdown:', { error })
      throw error
    }
  }

  private generateDetectionId(): string {
    return `edge_det_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  }
}

// Supporting interfaces
interface ProcessedThreatData {
  threatId: string
  timestamp: Date
  region: string
  severity: number
  confidence: number
  indicators: ThreatIndicator[]
  context: ThreatContext
  normalizedSeverity: number
  featureVector: number[]
}

interface ClassificationResult {
  threatType: string
  confidence: number
  probabilities: number[]
}

interface CombinedResult {
  threatType: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
  primaryModel: string
  scores: {
    anomaly: number
    classification: number
    prediction: number
    combined: number
  }
}
