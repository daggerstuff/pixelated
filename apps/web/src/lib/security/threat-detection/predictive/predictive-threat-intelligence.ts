import crypto from 'crypto'
/**
 * Predictive Threat Intelligence System
 * Provides time series forecasting, emerging threat detection, and threat propagation modeling
 */
import { EventEmitter } from 'events'

import * as tf from '@tensorflow/tfjs'
import Redis from 'ioredis'
import { MongoClient } from 'mongodb'
import {
  ThreatModelRegistry,
  MLNoveltyDetector,
  LSTMTimeSeriesForecaster,
  GraphPropagationModeler,
  StatisticalSeasonalAnalyzer,
  ProbabilisticRiskAssessor,
} from './predictive-threat-intelligence.models'
import {
  combineRiskComponents,
  quantifyUncertainty,
  generateForecastId,
  generateModelId,
  generateAssessmentId,
  generateGraphId,
  generateContainmentStrategies,
  calculateTimeToPropagation,
  generateNovelThreatRecommendations,
  extractThreatFeatures,
  analyzeTrends,
  evaluateModelPerformance,
  identifyAffectedNodes,
  identifyDailyPattern,
  identifyWeeklyPattern,
  identifyMonthlyPattern,
  identifyYearlyPattern,
  validateStatisticalSignificance,
  preprocessThreats,
  extractRiskFactors,
  calculateThreatLikelihood,
  calculateThreatImpact,
  calculateVulnerability,
  calculateRiskBreakdown,
  generateRiskRecommendations,
  calculateRiskConfidence,
  preprocessTimeSeries,
  extractTimeSeriesFeatures,
  calculateTimeSeriesConfidenceBands,
  extractModelParameters,
  calculateValidationMetrics,
  removeDuplicateThreats,
  imputeMissingValues,
  normalizeThreatData,
  groupByThreatType,
  trainLSTMModel,
  trainARIMAModel,
  trainEnsembleModel,
  calculateTimeHorizon,
  calculatePredictionInterval,
  calculateSimilarityToKnownThreats,
  calculateInfectionProbability,
  calculateRecoveryRate,
  calculateVulnerabilityScore,
  calculateTransmissionProbability,
  calculateTransmissionRate,
  calculateBasicReproductionNumber,
  calculateNodeInfectionProbability,
  calculateEdgeTransmissionProbability,
} from './predictive-threat-intelligence.utils'
export type {
  ThreatData,
  ThreatIndicator,
  ThreatContext,
  ThreatAttribution,
  ModelPerformanceMetrics,
  ThreatForecast,
  PredictedThreat,
  ThreatCharacteristics,
  NovelThreat,
  PropagationModel,
  SeasonalPattern,
  RiskAssessment,
  TimeSeriesPrediction,
  TimeSeriesForecast,
  PredictiveThreatIntelligence,
} from './predictive-threat-intelligence.types'

import { createBuildSafeLogger } from '../../logging/build-safe-logger'
const logger = createBuildSafeLogger('predictive-threat-intelligence')

export class AdvancedPredictiveThreatIntelligence
  extends EventEmitter
  implements PredictiveThreatIntelligence
{
  private redis!: Redis
  private mongoClient!: MongoClient
  private timeSeriesForecaster!: TimeSeriesForecaster
  private noveltyDetector!: NoveltyDetector
  private propagationModeler!: PropagationModeler
  seasonalAnalyzer!: SeasonalAnalyzer
  private _riskAssessor!: ProbabilisticRiskAssessor
  private _modelRegistry!: ThreatModelRegistry

  constructor(
    private readonly config: {
      redisUrl: string
      mongoUrl: string
      modelRegistryUrl: string
      forecastingConfig: ForecastingConfig
      noveltyConfig: NoveltyConfig
      propagationConfig: PropagationConfig
    },
  ) {
    super()
    // Initialize services - note: this is fire-and-forget
    this.initializeServices().catch((error) => {
      this.emit('initialization_error', { error })
    })
  }

  private async initializeServices(): Promise<void> {
    this.redis = new Redis(this.config.redisUrl)
    this.mongoClient = new MongoClient(this.config.mongoUrl)

    this.timeSeriesForecaster = new LSTMTimeSeriesForecaster(
      this.config.forecastingConfig,
    )
    this.noveltyDetector = new MLNoveltyDetector(this.config.noveltyConfig)
    this.propagationModeler = new GraphPropagationModeler(
      this.config.propagationConfig,
    )
    this.seasonalAnalyzer = new StatisticalSeasonalAnalyzer()
    this._riskAssessor = new ProbabilisticRiskAssessor()
    this._modelRegistry = new ThreatModelRegistry(this.mongoClient)

    await this.mongoClient.connect()
    this.emit('services_initialized')
  }

  async predictThreatTrends(
    historicalData: ThreatData[],
    timeframe: TimeWindow,
  ): Promise<ThreatForecast> {
    try {
      // Validate input data
      if (!historicalData || historicalData.length === 0) {
        throw new Error(
          'Historical data is required for threat trend prediction',
        )
      }

      // Preprocess historical data
      const processedData = await this.preprocessThreatData(historicalData)

      // Extract time series features
      const timeSeries = this.extractTimeSeries(processedData)

      // Apply seasonal decomposition
      const seasonalComponents =
        await this.seasonalAnalyzer.decompose(timeSeries)

      // Train forecasting models
      const models = await this.trainForecastingModels(
        timeSeries,
        seasonalComponents,
      )

      // Generate predictions
      const predictions = await this.generatePredictions(models, timeframe)

      // Calculate confidence intervals
      const confidenceIntervals =
        await this.calculateConfidenceIntervals(predictions)

      // Analyze trends
      const trendAnalysis = await analyzeTrends(timeSeries, predictions)

      // Identify seasonal patterns
      const seasonalPatterns =
        await this.identifySeasonalPatterns(processedData)

      // Evaluate model performance
      const modelPerformance = await evaluateModelPerformance(
        models,
        timeSeries,
      )

      const forecast: ThreatForecast = {
        forecastId: generateForecastId(),
        timeframe,
        predictedThreats: predictions,
        confidenceIntervals,
        trendAnalysis,
        seasonalPatterns,
        modelPerformance,
      }

      // Cache forecast for future reference
      await this.cacheForecast(forecast)

      this.emit('threat_forecast_generated', {
        forecastId: forecast.forecastId,
      })
      return forecast
    } catch (error: unknown) {
      this.emit('threat_forecast_error', { error })
      throw error
    }
  }

  async detectEmergingThreats(
    currentData: ThreatData[],
    baseline: ThreatData[],
  ): Promise<NovelThreat[]> {
    try {
      // Validate input data
      if (!currentData || !baseline) {
        throw new Error(
          'Both current and baseline data are required for emerging threat detection',
        )
      }

      // Preprocess data
      const processedCurrent = await this.preprocessThreatData(currentData)
      const processedBaseline = await this.preprocessThreatData(baseline)

      // Extract features
      const currentFeatures = await extractThreatFeatures(processedCurrent)
      const baselineFeatures =
        await extractThreatFeatures(processedBaseline)

      // Apply novelty detection algorithms
      const novelThreats = await this.noveltyDetector.detectNovelThreats(
        processedCurrent,
        processedBaseline,
      )

      // Calculate novelty scores
      const scoredNovelThreats = await this.calculateNoveltyScores(
        novelThreats,
        currentFeatures,
        baselineFeatures,
      )

      // Filter by significance
      const significantNovelThreats = scoredNovelThreats.filter(
        (threat) =>
          threat.noveltyScore > 0.7 && threat.detectionConfidence > 0.8,
      )

      // Generate recommendations
      const threatsWithRecommendations =
        await generateNovelThreatRecommendations(significantNovelThreats)

      // Store detected novel threats
      await this.storeNovelThreats(threatsWithRecommendations)

      this.emit('emerging_threats_detected', {
        threatCount: threatsWithRecommendations.length,
      })

      return threatsWithRecommendations
    } catch (error: unknown) {
      this.emit('emerging_threat_detection_error', { error })
      throw error
    }
  }

  async modelThreatPropagation(
    initialThreat: Threat,
    network: NetworkGraph,
  ): Promise<PropagationModel> {
    try {
      // Validate inputs
      if (!initialThreat || !network) {
        throw new Error(
          'Initial threat and network graph are required for propagation modeling',
        )
      }

      // Build propagation graph
      const propagationGraph = await this.buildPropagationGraph(
        initialThreat,
        network,
      )

      // Calculate propagation probabilities
      const propagationProbabilities =
        await this.calculatePropagationProbabilities(
          propagationGraph,
          initialThreat,
        )

      // Simulate propagation
      const simulation = await this.propagationModeler.simulatePropagation(
        propagationGraph,
        propagationProbabilities,
        initialThreat,
      )

      // Identify affected nodes
      const affectedNodes = await identifyAffectedNodes(simulation)

      // Calculate time to propagation
      const timeToPropagation =
        await calculateTimeToPropagation(simulation)

      // Generate containment strategies
      const containmentStrategies = await generateContainmentStrategies(
        simulation,
        affectedNodes,
      )

      const propagationModel: PropagationModel = {
        modelId: generateModelId(),
        initialThreat,
        networkGraph: network,
        propagationProbability: propagationProbabilities.overallProbability,
        affectedNodes,
        timeToPropagation,
        containmentStrategies,
      }

      // Store propagation model
      await this.storePropagationModel(propagationModel)

      this.emit('threat_propagation_modeled', {
        modelId: propagationModel.modelId,
      })
      return propagationModel
    } catch (error: unknown) {
      this.emit('threat_propagation_modeling_error', { error })
      throw error
    }
  }

  async identifySeasonalPatterns(
    data: ThreatData[],
  ): Promise<SeasonalPattern[]> {
    try {
      // Validate input data
      if (!data || data.length === 0) {
        throw new Error(
          'Threat data is required for seasonal pattern identification',
        )
      }

      // Preprocess data
      const processedData = await this.preprocessThreatData(data)

      // Extract time series
      const timeSeries = this.extractTimeSeries(processedData)

      // Apply seasonal decomposition
      const seasonalComponents =
        await this.seasonalAnalyzer.decompose(timeSeries)

      // Identify patterns at different time scales
      const patterns: SeasonalPattern[] = []

      // Daily patterns
      const dailyPattern = await identifyDailyPattern(seasonalComponents)
      if (dailyPattern) {
        patterns.push(dailyPattern)
      }

      // Weekly patterns
      const weeklyPattern = await identifyWeeklyPattern(seasonalComponents)
      if (weeklyPattern) {
        patterns.push(weeklyPattern)
      }

      // Monthly patterns
      const monthlyPattern =
        await identifyMonthlyPattern(seasonalComponents)
      if (monthlyPattern) {
        patterns.push(monthlyPattern)
      }

      // Yearly patterns
      const yearlyPattern = await identifyYearlyPattern(seasonalComponents)
      if (yearlyPattern) {
        patterns.push(yearlyPattern)
      }

      // Validate statistical significance
      const significantPatterns =
        await validateStatisticalSignificance(patterns)

      // Store identified patterns
      await this.storeSeasonalPatterns(significantPatterns)

      this.emit('seasonal_patterns_identified', {
        patternCount: significantPatterns.length,
      })
      return significantPatterns
    } catch (error: unknown) {
      this.emit('seasonal_pattern_identification_error', { error })
      throw error
    }
  }

  async assessRisk(
    threats: Threat[],
    context: SecurityContext,
  ): Promise<RiskAssessment> {
    try {
      // Validate inputs
      if (!threats || threats.length === 0) {
        throw new Error('Threats are required for risk assessment')
      }

      // Preprocess threats
      const processedThreats = await preprocessThreats(threats)

      // Extract risk factors
      await extractRiskFactors(processedThreats, context)

      // Calculate individual risk components
      const likelihood = await calculateThreatLikelihood(
        processedThreats,
        context,
      )
      const impact = await calculateThreatImpact(processedThreats, context)
      const vulnerability = await calculateVulnerability(
        processedThreats,
        context,
      )

      // Combine risk components
      const overallRiskScore = combineRiskComponents(
        likelihood,
        impact,
        vulnerability,
      )

      // Calculate risk breakdown
      const riskBreakdown = await calculateRiskBreakdown(
        processedThreats,
        context,
      )

      // Quantify uncertainty
      const uncertaintyQuantification = await quantifyUncertainty(
        processedThreats,
        context,
        overallRiskScore,
      )

      // Generate recommendations
      const recommendations = await generateRiskRecommendations(
        processedThreats,
        context,
        riskBreakdown,
      )

      // Calculate confidence level
      const confidenceLevel = calculateRiskConfidence(
        likelihood,
        impact,
        vulnerability,
        uncertaintyQuantification,
      )

      const riskAssessment: RiskAssessment = {
        assessmentId: generateAssessmentId(),
        threats: processedThreats,
        overallRiskScore,
        riskBreakdown,
        uncertaintyQuantification,
        recommendations,
        confidenceLevel,
      }

      // Store risk assessment
      await this.storeRiskAssessment(riskAssessment)

      this.emit('risk_assessment_completed', {
        assessmentId: riskAssessment.assessmentId,
      })
      return riskAssessment
    } catch (error: unknown) {
      this.emit('risk_assessment_error', { error })
      throw error
    }
  }

  async forecastThreatTimeSeries(
    series: ThreatTimeSeries[],
  ): Promise<TimeSeriesForecast> {
    try {
      // Validate input
      if (!series || series.length === 0) {
        throw new Error('Time series data is required for forecasting')
      }

      // Preprocess time series
      const processedSeries = await preprocessTimeSeries(series)

      // Extract features
      const features = await extractTimeSeriesFeatures(processedSeries)

      // Train forecasting model
      const model = await this.timeSeriesForecaster.train(
        processedSeries,
        features,
      )

      // Generate predictions
      const predictionResults = await this.timeSeriesForecaster.forecast(
        model,
        features,
      )

      // Convert PredictionResult[] to TimeSeriesPrediction[]
      const predictions: TimeSeriesPrediction[] = predictionResults.map(
        (pred, idx) => ({
          timestamp: new Date(Date.now() + idx * 24 * 60 * 60 * 1000),
          predictedValue: pred.value,
          confidence: pred.confidence,
          lowerBound: pred.value - pred.value * 0.1,
          upperBound: pred.value + pred.value * 0.1,
        }),
      )

      // Calculate confidence bands
      const confidenceBands =
        await calculateTimeSeriesConfidenceBands(predictionResults)

      // Extract model parameters
      const modelParameters = await extractModelParameters(model)

      // Calculate validation metrics
      const validationMetrics = await calculateValidationMetrics(
        model,
        processedSeries,
      )

      const forecast: TimeSeriesForecast = {
        forecastId: generateForecastId(),
        series: processedSeries,
        predictions,
        confidenceBands,
        modelParameters,
        validationMetrics,
      }

      // Store forecast
      await this.storeTimeSeriesForecast(forecast)

      this.emit('time_series_forecast_generated', {
        forecastId: forecast.forecastId,
      })
      return forecast
    } catch (error: unknown) {
      this.emit('time_series_forecast_error', { error })
      throw error
    }
  }

  private async preprocessThreatData(
    data: ThreatData[],
  ): Promise<ThreatData[]> {
    // Remove duplicates
    const uniqueData = removeDuplicateThreats(data)

    // Sort by timestamp
    const sortedData = uniqueData.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    )

    // Handle missing values
    const imputedData = await imputeMissingValues(sortedData)

    // Normalize data
    return await normalizeThreatData(imputedData)
  }

  private extractTimeSeries(data: ThreatData[]): ThreatTimeSeries[] {
    // Group by threat type
    const groupedData = groupByThreatType(data)

    // Convert to time series format
    const timeSeries: ThreatTimeSeries[] = []

    for (const [threatType, threats] of Object.entries(groupedData)) {
      const series: ThreatTimeSeries = {
        seriesId: `series_${threatType}`,
        threatType,
        dataPoints: threats.map((threat) => ({
          timestamp: threat.timestamp,
          value: threat.severity,
          confidence: threat.confidence,
          metadata: {
            threatId: threat.threatId,
            indicators: threat.indicators.length,
            context: threat.context,
          },
        })),
      }

      timeSeries.push(series)
    }

    return timeSeries
  }

  private async trainForecastingModels(
    timeSeries: ThreatTimeSeries[],
    seasonalComponents: SeasonalComponents,
  ): Promise<ForecastingModel[]> {
    const models: ForecastingModel[] = []

    for (const series of timeSeries) {
      // Train LSTM model
      const lstmModel = await trainLSTMModel(series, seasonalComponents)

      // Train ARIMA model for comparison
      const arimaModel = await trainARIMAModel(series, seasonalComponents)

      // Train ensemble model
      const ensembleModel = await trainEnsembleModel(lstmModel, arimaModel)

      models.push(ensembleModel)
    }

    return models
  }

  private async generatePredictions(
    models: ForecastingModel[],
    timeframe: TimeWindow,
  ): Promise<PredictedThreat[]> {
    const predictions: PredictedThreat[] = []

    for (const model of models) {
      const prediction = await model.predict(timeframe)

      predictions.push({
        threatType: model.threatType,
        predictedSeverity: prediction.value,
        confidence: prediction.confidence,
        probability: prediction.probability,
        contributingFactors: prediction.factors,
        timeHorizon: calculateTimeHorizon(timeframe),
      })
    }

    return predictions
  }

  private async calculateConfidenceIntervals(
    predictions: PredictedThreat[],
  ): Promise<ConfidenceInterval[]> {
    const intervals: ConfidenceInterval[] = []

    for (const prediction of predictions) {
      const interval = await calculatePredictionInterval(prediction)
      intervals.push(interval)
    }

    return intervals
  }

  private async calculateNoveltyScores(
    novelThreats: NovelThreat[],
    _currentFeatures: ThreatFeatures,
    baselineFeatures: ThreatFeatures,
  ): Promise<NovelThreat[]> {
    const scoredThreats: NovelThreat[] = []

    for (const threat of novelThreats) {
      // Calculate similarity to known threats
      const similarity = await calculateSimilarityToKnownThreats(
        threat,
        baselineFeatures,
      )

      // Calculate novelty score
      const noveltyScore = 1 - similarity // Higher novelty = lower similarity

      // Update threat with scores
      scoredThreats.push({
        ...threat,
        similarityToKnown: similarity,
        noveltyScore: noveltyScore,
        detectionConfidence: Math.min(noveltyScore * 1.2, 1.0), // Cap at 1.0
      })
    }

    return scoredThreats
  }

  private async buildPropagationGraph(
    initialThreat: Threat,
    network: NetworkGraph,
  ): Promise<PropagationGraph> {
    // Create propagation graph based on threat characteristics and network topology
    const propagationGraph: PropagationGraph = {
      graphId: generateGraphId(),
      nodes: network.nodes.map((node) => ({
        ...node,
        infectionProbability: 0,
        recoveryRate: 0,
        vulnerabilityScore: 0,
      })),
      edges: network.edges.map((edge) => ({
        ...edge,
        transmissionProbability: 0,
        transmissionRate: 0,
      })),
    }

    // Calculate probabilities asynchronously
    for (const node of propagationGraph.nodes) {
      node.infectionProbability = await calculateInfectionProbability(
        node,
        initialThreat,
      )
      node.recoveryRate = await calculateRecoveryRate(node)
      node.vulnerabilityScore = await calculateVulnerabilityScore(node)
    }

    for (const edge of propagationGraph.edges) {
      edge.transmissionProbability =
        await calculateTransmissionProbability(edge, initialThreat)
      edge.transmissionRate = await calculateTransmissionRate(edge)
    }

    return propagationGraph
  }

  private async calculatePropagationProbabilities(
    propagationGraph: PropagationGraph,
    initialThreat: Threat,
  ): Promise<PropagationProbabilities> {
    // Use epidemic modeling techniques (SIR, SEIR, etc.)
    const probabilities: PropagationProbabilities = {
      overallProbability: 0,
      nodeProbabilities: new Map(),
      edgeProbabilities: new Map(),
      timeDependentProbabilities: [],
    }

    // Calculate basic reproduction number (R0)
    const r0 = await calculateBasicReproductionNumber(
      propagationGraph,
      initialThreat,
    )
    probabilities.overallProbability = Math.min(r0 / 10, 1.0) // Normalize

    // Calculate individual node and edge probabilities
    for (const node of propagationGraph.nodes) {
      const nodeProb = await calculateNodeInfectionProbability(
        node,
        propagationGraph,
      )
      probabilities.nodeProbabilities.set(node.nodeId, nodeProb)
    }

    for (const edge of propagationGraph.edges) {
      const edgeProb = await calculateEdgeTransmissionProbability(
        edge,
        propagationGraph,
      )
      probabilities.edgeProbabilities.set(edge.edgeId, edgeProb)
    }

    return probabilities
  }

  private async cacheForecast(forecast: ThreatForecast): Promise<void> {
    await this.redis.setex(
      `threat_forecast:${forecast.forecastId}`,
      7200, // 2 hours TTL
      JSON.stringify(forecast),
    )
  }

  private async storeNovelThreats(threats: NovelThreat[]): Promise<void> {
    if (threats.length === 0) {
      return
    }

    const db = this.mongoClient.db('threat_detection')
    const collection = db.collection('novel_threats')

    await collection.insertMany(threats)
  }

  private async storePropagationModel(model: PropagationModel): Promise<void> {
    const db = this.mongoClient.db('threat_detection')
    const collection = db.collection('propagation_models')

    await collection.insertOne(model)
  }

  private async storeSeasonalPatterns(
    patterns: SeasonalPattern[],
  ): Promise<void> {
    if (patterns.length === 0) {
      return
    }

    const db = this.mongoClient.db('threat_detection')
    const collection = db.collection('seasonal_patterns')

    await collection.insertMany(patterns)
  }

  private async storeRiskAssessment(assessment: RiskAssessment): Promise<void> {
    const db = this.mongoClient.db('threat_detection')
    const collection = db.collection('risk_assessments')

    await collection.insertOne(assessment)
  }

  private async storeTimeSeriesForecast(
    forecast: TimeSeriesForecast,
  ): Promise<void> {
    const db = this.mongoClient.db('threat_detection')
    const collection = db.collection('time_series_forecasts')

    await collection.insertOne(forecast)
  }

  async shutdown(): Promise<void> {
    await this.redis.quit()
    await this.mongoClient.close()
    this.emit('shutdown')
  }
}

// Supporting interfaces and types
