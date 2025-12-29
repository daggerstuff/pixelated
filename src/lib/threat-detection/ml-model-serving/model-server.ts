/**
 * ML Model Serving Infrastructure
 * Provides scalable TensorFlow.js model serving with ensemble learning capabilities
 */

import * as tf from '@tensorflow/tfjs'
import crypto from 'crypto'
import { Redis } from 'ioredis'
import { MongoClient } from 'mongodb'
import { EventEmitter } from 'events'

export interface ModelConfig {
  modelId: string
  modelPath: string
  modelType: 'classification' | 'regression' | 'anomaly' | 'ensemble'
  inputShape: number[]
  outputShape: number[]
  preprocessing?: PreprocessingConfig
  postprocessing?: PostprocessingConfig
  performanceTargets?: PerformanceTargets
}

export interface PreprocessingConfig {
  normalization?: {
    method: 'min-max' | 'z-score' | 'robust'
    parameters: Record<string, number>
  }
  featureEngineering?: {
    techniques: string[]
    parameters: Record<string, number>
  }
  dataValidation?: {
    requiredFields: string[]
    validationRules: ValidationRule[]
  }
}

export interface PostprocessingConfig {
  thresholding?: {
    method: 'static' | 'dynamic' | 'adaptive'
    threshold: number
  }
  ensembleAggregation?: {
    method: 'voting' | 'averaging' | 'weighted'
    weights?: number[]
  }
  confidenceCalibration?: {
    method: 'platt' | 'isotonic' | 'temperature'
    calibrationData?: unknown[]
  }
}

export interface PerformanceTargets {
  maxLatency: number // milliseconds
  minThroughput: number // requests per second
  maxMemoryUsage: number // MB
  targetAccuracy: number
}

export interface ModelPrediction {
  predictionId: string
  modelId: string
  input: unknown
  output: unknown
  confidence: number
  latency: number
  timestamp: Date
  metadata?: Record<string, unknown>
}

export interface EnsemblePrediction extends ModelPrediction {
  individualPredictions: ModelPrediction[]
  aggregationMethod: string
  uncertainty: number
}

export interface ModelRegistry {
  registerModel(config: ModelConfig): Promise<void>
  getModel(modelId: string): Promise<ModelConfig | null>
  updateModel(modelId: string, updates: Partial<ModelConfig>): Promise<void>
  listModels(): Promise<ModelConfig[]>
  validateModel(config: ModelConfig): Promise<ValidationResult>
}

export interface FeatureStore {
  getFeatures(featureSetId: string): Promise<FeatureSet>
  updateFeatures(featureSetId: string, features: FeatureSet): Promise<void>
  validateFeatures(features: unknown[]): Promise<ValidationResult>
  getFeatureHistory(
    featureSetId: string,
    timeframe: TimeWindow,
  ): Promise<FeatureHistory>
}

export interface ModelMonitoring {
  trackPrediction(prediction: ModelPrediction): Promise<void>
  detectDrift(modelId: string): Promise<DriftDetectionResult>
  monitorPerformance(modelId: string): Promise<PerformanceMetrics>
  generateHealthReport(modelId: string): Promise<ModelHealthReport>
}

export interface DriftDetectionResult {
  driftDetected: boolean
  driftType: 'concept' | 'data' | 'performance'
  severity: 'low' | 'medium' | 'high'
  affectedFeatures: string[]
  recommendations: string[]
  timestamp: Date
}

export interface PerformanceMetrics {
  modelId: string
  avgLatency: number
  throughput: number
  accuracy: number
  memoryUsage: number
  errorRate: number
  timestamp: Date
}

export class ModelServingServer extends EventEmitter {
  private models: Map<string, tf.LayersModel>
  private modelConfigs: Map<string, ModelConfig>
  private redis: Redis
  private mongoClient: MongoClient
  private featureStore: FeatureStore
  private modelRegistry: ModelRegistry
  private monitoring: ModelMonitoring
  private performanceCache: Map<string, PerformanceMetrics>

  constructor(
    private config: {
      redisUrl: string
      mongoUrl: string
      modelRegistryUrl: string
      featureStoreUrl: string
      maxConcurrentModels: number
      cacheExpiry: number
    },
  ) {
    super()
    this.models = new Map()
    this.modelConfigs = new Map()
    this.performanceCache = new Map()
    this.initializeServices()
  }

  private async initializeServices(): Promise<void> {
    this.redis = new Redis(this.config.redisUrl)
    this.mongoClient = new MongoClient(this.config.mongoUrl)

    // Initialize feature store and model registry
    this.featureStore = new RedisFeatureStore(this.redis)
    this.modelRegistry = new MongoModelRegistry(this.mongoClient)
    this.monitoring = new ComprehensiveModelMonitoring(
      this.redis,
      this.mongoClient,
    )

    await this.mongoClient.connect()
    this.emit('services_initialized')
  }

  async loadModel(modelConfig: ModelConfig): Promise<void> {
    try {
      // Validate model configuration
      const validation = await this.modelRegistry.validateModel(modelConfig)
      if (!validation.isValid) {
        throw new Error(
          `Model validation failed: ${validation.errors.join(', ')}`,
        )
      }

      // Load TensorFlow model
      const model = await tf.loadLayersModel(modelConfig.modelPath)

      // Warm up the model
      const warmupInput = tf.zeros([1, ...modelConfig.inputShape])
      await model.predict(warmupInput)
      warmupInput.dispose()

      // Store model and configuration
      this.models.set(modelConfig.modelId, model)
      this.modelConfigs.set(modelConfig.modelId, modelConfig)

      // Register model in registry
      await this.modelRegistry.registerModel(modelConfig)

      this.emit('model_loaded', { modelId: modelConfig.modelId })
    } catch (error) {
      this.emit('model_load_error', { modelId: modelConfig.modelId, error })
      throw error
    }
  }

  async predict(modelId: string, input: unknown): Promise<ModelPrediction> {
    const startTime = Date.now()
    const predictionId = this.generatePredictionId()

    try {
      const model = this.models.get(modelId)
      const config = this.modelConfigs.get(modelId)

      if (!model || !config) {
        throw new Error(`Model ${modelId} not found`)
      }

      // Preprocess input
      const processedInput = await this.preprocessInput(
        input,
        config.preprocessing,
      )

      // Run prediction inside tf.tidy so tensors are disposed automatically
      const output = await tf.tidy(async () => {
        const inputTensor = tf.tensor(processedInput, [1, ...config.inputShape])
        const outputTensor = (await model.predict(inputTensor)) as tf.Tensor
        const arr = await outputTensor.array()
        return arr as unknown
      })

      // Postprocess output
      const processedOutput = await this.postprocessOutput(
        output,
        config.postprocessing,
      )

      // Calculate confidence
      const confidence = this.calculateConfidence(output, config)

      const latency = Date.now() - startTime
      const prediction: ModelPrediction = {
        predictionId,
        modelId,
        input,
        output: processedOutput,
        confidence,
        latency,
        timestamp: new Date(),
      }

      // Track prediction for monitoring
      await this.monitoring.trackPrediction(prediction)

      // Cache performance metrics
      this.updatePerformanceCache(modelId, latency)

      this.emit('prediction_made', prediction)
      return prediction
    } catch (error) {
      this.emit('prediction_error', { predictionId, modelId, error })
      throw error
    }
  }

  async ensemblePredict(
    modelIds: string[],
    input: unknown,
  ): Promise<EnsemblePrediction> {
    const startTime = Date.now()
    const predictionId = this.generatePredictionId()

    try {
      // Get individual predictions
      const individualPredictions = await Promise.all(
        modelIds.map((modelId) => this.predict(modelId, input)),
      )

      // Aggregate predictions
      const ensembleOutput = this.aggregatePredictions(individualPredictions)
      const uncertainty = this.calculateUncertainty(individualPredictions)

      const latency = Date.now() - startTime
      const ensemblePrediction: EnsemblePrediction = {
        predictionId,
        modelId: `ensemble_${modelIds.join('_')}`,
        input,
        output: ensembleOutput,
        confidence: this.calculateEnsembleConfidence(individualPredictions),
        latency,
        timestamp: new Date(),
        individualPredictions,
        aggregationMethod: 'weighted_average',
        uncertainty,
      }

      this.emit('ensemble_prediction_made', ensemblePrediction)
      return ensemblePrediction
    } catch (error) {
      this.emit('ensemble_prediction_error', { predictionId, modelIds, error })
      throw error
    }
  }

  private async preprocessInput(
    input: unknown,
    config?: PreprocessingConfig,
  ): Promise<unknown> {
    if (!config) {
      return input
    }

    let processed = input

    // Apply normalization
    if (config.normalization) {
      processed = this.applyNormalization(processed, config.normalization)
    }

    // Apply feature engineering
    if (config.featureEngineering) {
      processed = await this.applyFeatureEngineering(
        processed,
        config.featureEngineering,
      )
    }

    // Validate data
    if (config.dataValidation) {
      const validation = await this.validateData(
        processed,
        config.dataValidation,
      )
      if (!validation.isValid) {
        throw new Error(
          `Data validation failed: ${validation.errors.join(', ')}`,
        )
      }
    }

    return processed
  }

  private async postprocessOutput(
    output: unknown,
    config?: PostprocessingConfig,
  ): Promise<unknown> {
    if (!config) {
      return output
    }

    let processed = output

    // Apply thresholding
    if (config.thresholding) {
      processed = this.applyThresholding(processed, config.thresholding)
    }

    // Apply ensemble aggregation
    if (config.ensembleAggregation) {
      processed = this.applyEnsembleAggregation(
        processed,
        config.ensembleAggregation,
      )
    }

    // Apply confidence calibration
    if (config.confidenceCalibration) {
      processed = await this.applyConfidenceCalibration(
        processed,
        config.confidenceCalibration,
      )
    }

    return processed
  }

  private applyNormalization(
    data: unknown,
    config: PreprocessingConfig['normalization'],
  ): unknown {
    switch (config.method) {
      case 'min-max':
        return this.minMaxNormalize(data, config.parameters)
      case 'z-score':
        return this.zScoreNormalize(data, config.parameters)
      case 'robust':
        return this.robustNormalize(data, config.parameters)
      default:
        return data
    }
  }

  private async applyFeatureEngineering(
    data: unknown,
    config: PreprocessingConfig['featureEngineering'],
  ): Promise<unknown> {
    // Implement feature engineering techniques
    let engineered = data

    for (const technique of config.techniques) {
      switch (technique) {
        case 'polynomial':
          engineered = this.createPolynomialFeatures(
            engineered,
            config.parameters.degree,
          )
          break
        case 'interaction':
          engineered = this.createInteractionFeatures(engineered)
          break
        case 'binning':
          engineered = this.createBinnedFeatures(
            engineered,
            config.parameters.bins,
          )
          break
        default:
          console.warn(`Unknown feature engineering technique: ${technique}`)
      }
    }

    return engineered
  }

  private aggregatePredictions(predictions: ModelPrediction[]): unknown {
    // Support both regression (scalar outputs) and classification (vector outputs)
    if (!predictions || predictions.length === 0) {
      return null
    }

    const weights = predictions.map((p) => p.confidence || 0)
    const totalWeight = weights.reduce((sum, w) => sum + w, 0)

    // If total weight is zero, fall back to simple averaging to avoid division by zero
    if (totalWeight === 0) {
      const outputs = predictions.map((p) => p.output)
      if (outputs.length === 0) {
        return null
      }

      const first = outputs[0]
      if (Array.isArray(first)) {
        // Average each class probability across predictions
        const { length } = first as number[]
        const sumVec = Array.from({ length }, () => 0)
        outputs.forEach((out) => {
          ;(out as number[]).forEach((v, i) => {
            sumVec[i] += v
          })
        })
        return sumVec.map((v) => v / outputs.length)
      }

      // Scalar outputs: simple mean
      return outputs.reduce((a, b) => a + b, 0) / outputs.length
    }

    const firstOutput = predictions[0].output
    if (Array.isArray(firstOutput)) {
      // Weighted average for vector outputs (classification probabilities)
      const { length } = firstOutput as number[]
      const weightedSum = predictions.reduce((sum, pred, index) => {
        const w = weights[index]
        ;(pred.output as number[]).forEach((val, i) => {
          sum[i] = (sum[i] || 0) + val * w
        })
        return sum
      }, Array.from({ length }, () => 0))

      return weightedSum.map((v) => v / totalWeight)
    } else {
      // Weighted average for scalar outputs (regression)
      const weightedSum = predictions.reduce((sum, pred, index) => {
        return sum + (pred.output as number) * weights[index]
      }, 0)

      return weightedSum / totalWeight
    }
  }

  private calculateUncertainty(predictions: ModelPrediction[]): number {
    const outputs = predictions.map((p) => p.output)
    const mean = outputs.reduce((sum, val) => sum + val, 0) / outputs.length
    const variance =
      outputs.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      outputs.length
    return Math.sqrt(variance)
  }

  private calculateConfidence(output: unknown, _config: ModelConfig): number {
    // Simple confidence calculation based on output distribution
    if (Array.isArray(output)) {
      const arr = output as number[]
      const maxValue = Math.max(...arr)
      const sum = arr.reduce((acc, val) => acc + val, 0)
      return maxValue / sum
    }
    const val = typeof output === 'number' ? output : 0
    return Math.abs(val)
  }

  private calculateEnsembleConfidence(predictions: ModelPrediction[]): number {
    const confidences = predictions.map((p) => p.confidence)
    return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length
  }

  private updatePerformanceCache(modelId: string, latency: number): void {
    const cacheKey = `perf_${modelId}`
    const existing = this.performanceCache.get(cacheKey) || {
      modelId,
      avgLatency: 0,
      throughput: 0,
      accuracy: 0,
      memoryUsage: 0,
      errorRate: 0,
      timestamp: new Date(),
    }

    existing.avgLatency = (existing.avgLatency + latency) / 2
    existing.timestamp = new Date()

    this.performanceCache.set(cacheKey, existing)
  }

  private generatePredictionId(): string {
    try {
      // node:crypto typings differ across versions; narrow at runtime
      const maybeCrypto = crypto as unknown as {
        randomUUID?: () => string
        randomBytes?: (n: number) => Buffer
      }
      if (typeof maybeCrypto.randomUUID === 'function') {
        return `pred_${maybeCrypto.randomUUID()}`
      }
      if (typeof maybeCrypto.randomBytes === 'function') {
        return `pred_${maybeCrypto.randomBytes(16).toString('hex')}`
      }
    } catch (_e) {
      // ignore errors generating crypto bytes; fallback below
    }
    return `pred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  async getHealth(): Promise<ModelHealthReport> {
    const modelStatuses = await Promise.all(
      Array.from(this.models.keys()).map(async (modelId) => {
        const metrics = this.performanceCache.get(`perf_${modelId}`)
        const drift = await this.monitoring.detectDrift(modelId)

        return {
          modelId,
          status: metrics ? 'healthy' : 'unknown',
          metrics: metrics || null,
          drift,
        }
      }),
    )

    return {
      serverStatus: 'healthy',
      loadedModels: this.models.size,
      modelStatuses,
      timestamp: new Date(),
    }
  }

  async shutdown(): Promise<void> {
    // Clean up models
    for (const [modelId, model] of this.models) {
      model.dispose()
      this.models.delete(modelId)
    }

    // Close connections
    await this.redis.quit()
    await this.mongoClient.close()

    this.emit('shutdown')
  }
}

// Helper classes for dependencies
class RedisFeatureStore implements FeatureStore {
  constructor(private redis: Redis) {}

  async getFeatures(featureSetId: string): Promise<FeatureSet> {
    const data = await this.redis.get(`features:${featureSetId}`)
    return data ? JSON.parse(data) : null
  }

  async updateFeatures(
    featureSetId: string,
    features: FeatureSet,
  ): Promise<void> {
    await this.redis.set(
      `features:${featureSetId}`,
      JSON.stringify(features),
      'EX',
      3600,
    )
  }

  async validateFeatures(_features: unknown[]): Promise<ValidationResult> {
    // Implement feature validation logic
    return { isValid: true, errors: [] }
  }

  async getFeatureHistory(
    featureSetId: string,
    timeframe: TimeWindow,
  ): Promise<FeatureHistory> {
    // Implement feature history retrieval
    return { features: [], timeframe }
  }
}

class MongoModelRegistry implements ModelRegistry {
  constructor(private mongoClient: MongoClient) {}

  async registerModel(config: ModelConfig): Promise<void> {
    const db = this.mongoClient.db('threat_detection')
    const collection = db.collection('models')
    await collection.insertOne({ ...config, registeredAt: new Date() })
  }

  async getModel(modelId: string): Promise<ModelConfig | null> {
    const db = this.mongoClient.db('threat_detection')
    const collection = db.collection('models')
    const result = await collection.findOne({ modelId })
    return result as ModelConfig | null
  }

  async updateModel(
    modelId: string,
    updates: Partial<ModelConfig>,
  ): Promise<void> {
    const db = this.mongoClient.db('threat_detection')
    const collection = db.collection('models')
    await collection.updateOne({ modelId }, { $set: updates })
  }

  async listModels(): Promise<ModelConfig[]> {
    const db = this.mongoClient.db('threat_detection')
    const collection = db.collection('models')
    return (await collection.find().toArray()) as ModelConfig[]
  }

  async validateModel(config: ModelConfig): Promise<ValidationResult> {
    const errors: string[] = []

    if (!config.modelId || config.modelId.length < 3) {
      errors.push('Model ID must be at least 3 characters')
    }

    if (!config.modelPath || !config.modelPath.startsWith('file://')) {
      errors.push('Model path must be a valid file URL')
    }

    if (
      !['classification', 'regression', 'anomaly', 'ensemble'].includes(
        config.modelType,
      )
    ) {
      errors.push('Invalid model type')
    }

    return { isValid: errors.length === 0, errors }
  }
}

class ComprehensiveModelMonitoring implements ModelMonitoring {
  constructor(
    private redis: Redis,
    private mongoClient: MongoClient,
  ) {}

  async trackPrediction(prediction: ModelPrediction): Promise<void> {
    const db = this.mongoClient.db('threat_detection')
    const collection = db.collection('predictions')
    await collection.insertOne(prediction)
  }

  async detectDrift(_modelId: string): Promise<DriftDetectionResult> {
    // Implement drift detection logic
    return {
      driftDetected: false,
      driftType: 'concept',
      severity: 'low',
      affectedFeatures: [],
      recommendations: [],
      timestamp: new Date(),
    }
  }

  async monitorPerformance(modelId: string): Promise<PerformanceMetrics> {
    // Implement performance monitoring
    return {
      modelId,
      avgLatency: 50,
      throughput: 100,
      accuracy: 0.95,
      memoryUsage: 512,
      errorRate: 0.01,
      timestamp: new Date(),
    }
  }

  async generateHealthReport(modelId: string): Promise<ModelHealthReport> {
    const drift = await this.detectDrift(modelId)
    const performance = await this.monitorPerformance(modelId)

    return {
      modelId,
      status: drift.driftDetected ? 'degraded' : 'healthy',
      lastCheck: new Date(),
      performance,
      drift,
    }
  }
}

// Type definitions
interface FeatureSet {
  features: unknown[]
  metadata: Record<string, unknown>
}

interface FeatureHistory {
  features: unknown[]
  timeframe: TimeWindow
}

interface ValidationResult {
  isValid: boolean
  errors: string[]
}

interface TimeWindow {
  start: Date
  end: Date
}

interface ModelHealthReport {
  modelId: string
  status: 'healthy' | 'degraded' | 'failed'
  lastCheck: Date
  performance: PerformanceMetrics
  drift: DriftDetectionResult
}

interface ValidationRule {
  field: string
  type: 'required' | 'range' | 'format'
  parameters?: unknown
}
