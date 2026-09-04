/**
 * Predictive threat intelligence types — extracted from
 * predictive-threat-intelligence.ts.
 */

export interface ThreatData {
  threatId: string
  threatType: string
  severity: number
  confidence: number
  timestamp: Date
  indicators: ThreatIndicator[]
  context: ThreatContext
  attribution?: ThreatAttribution
}

export interface ThreatIndicator {
  indicatorId: string
  indicatorType: string
  value: string
  confidence: number
  source: string
  timestamp: Date
}

export interface ThreatContext {
  geographicLocation?: string
  affectedSystems?: string[]
  industrySector?: string
  timeWindow?: TimeWindow
  threatActor?: string
  campaign?: string
}

export interface ThreatAttribution {
  actor: string
  motivation: string
  sophistication: string
  resources: string
  attributionConfidence: number
}

export interface ModelPerformanceMetrics {
  accuracy: number
  precision: number
  recall: number
  f1Score: number
  mae: number
  mse: number
  rmse: number
}

export interface ThreatForecast {
  forecastId: string
  timeframe: TimeWindow
  predictedThreats: PredictedThreat[]
  confidenceIntervals: ConfidenceInterval[]
  trendAnalysis: TrendAnalysis
  seasonalPatterns: SeasonalPattern[]
  modelPerformance: ModelPerformanceMetrics
}

export interface PredictedThreat {
  threatType: string
  predictedSeverity: number
  confidence: number
  probability: number
  contributingFactors: string[]
  timeHorizon: string
}

export interface ThreatCharacteristics {
  attackVectors: string[]
  patterns: string[]
  signatures: string[]
  behavior: string[]
  indicators: string[]
}

export interface NovelThreat {
  threatId: string
  noveltyScore: number
  similarityToKnown: number
  potentialImpact: number
  detectionConfidence: number
  characteristics: ThreatCharacteristics
  recommendations: string[]
}

export interface PropagationModel {
  modelId: string
  initialThreat: Threat
  networkGraph: NetworkGraph
  propagationProbability: number
  affectedNodes: NetworkNode[]
  timeToPropagation: number
  containmentStrategies: ContainmentStrategy[]
}

export interface SeasonalPattern {
  patternId: string
  seasonalityType: 'daily' | 'weekly' | 'monthly' | 'yearly'
  amplitude: number
  phase: number
  frequency: number
  confidence: number
  statisticalSignificance: number
}

export interface RiskAssessment {
  assessmentId: string
  threats: Threat[]
  overallRiskScore: number
  riskBreakdown: RiskBreakdown
  uncertaintyQuantification: UncertaintyQuantification
  recommendations: RiskRecommendation[]
  confidenceLevel: number
}

export interface TimeSeriesPrediction {
  timestamp: Date
  predictedValue: number
  confidence: number
  lowerBound: number
  upperBound: number
}

export interface TimeSeriesForecast {
  forecastId: string
  series: ThreatTimeSeries[]
  predictions: TimeSeriesPrediction[]
  confidenceBands: ConfidenceBand[]
  modelParameters: ModelParameters
  validationMetrics: ValidationMetrics
}

export interface PredictiveThreatIntelligence {
  predictThreatTrends(
    historicalData: ThreatData[],
    timeframe: TimeWindow,
  ): Promise<ThreatForecast>
  detectEmergingThreats(
    currentData: ThreatData[],
    baseline: ThreatData[],
  ): Promise<NovelThreat[]>
  modelThreatPropagation(
    initialThreat: Threat,
    network: NetworkGraph,
  ): Promise<PropagationModel>
  identifySeasonalPatterns(data: ThreatData[]): Promise<SeasonalPattern[]>
  assessRisk(
    threats: Threat[],
    context: SecurityContext,
  ): Promise<RiskAssessment>
  forecastThreatTimeSeries(
    series: ThreatTimeSeries[],
  ): Promise<TimeSeriesForecast>
}


export interface ModelRegistry {
  registerModel(_id: string, _model: unknown): Promise<void>
  getModel(_id: string): Promise<unknown>
}

export interface PropagationSimulation {
  simulationId: string
  results: Array<Record<string, unknown>>
}

export interface TimeWindow {
  start: Date
  end: Date
}

export interface Threat {
  threatId: string
  threatType: string
  severity: number
  confidence: number
  timestamp: Date
}

export interface NetworkGraph {
  nodes: NetworkNode[]
  edges: NetworkEdge[]
}

export interface NetworkNode {
  nodeId: string
  nodeType: string
  properties: Record<string, unknown>
}

export interface NetworkEdge {
  edgeId: string
  sourceId: string
  targetId: string
  edgeType: string
  properties: Record<string, unknown>
}

export interface SecurityContext {
  organizationSize: string
  industry: string
  geographicRegion: string
  securityMaturity: string
  complianceRequirements: string[]
}

export interface ThreatTimeSeries {
  seriesId: string
  threatType: string
  dataPoints: TimeSeriesDataPoint[]
}

export interface TimeSeriesDataPoint {
  timestamp: Date
  value: number
  confidence: number
  metadata?: Record<string, unknown>
}

export interface ForecastingConfig {
  modelType: 'lstm' | 'arima' | 'ensemble'
  lookbackWindow: number
  predictionHorizon: number
  updateFrequency: number
  confidenceLevel: number
}

export interface NoveltyConfig {
  detectionThreshold: number
  similarityThreshold: number
  clusteringAlgorithm: string
  featureExtractionMethod: string
}

export interface PropagationConfig {
  modelType: 'sir' | 'seir' | 'network'
  transmissionRate: number
  recoveryRate: number
  timeStep: number
  simulationDuration: number
}

export interface ForecastingModel {
  threatType: string
  predict(_timeframe: TimeWindow): Promise<PredictionResult>
}

export interface PredictionResult {
  value: number
  confidence: number
  probability: number
  factors: string[]
}

export interface ConfidenceInterval {
  intervalId: string
  threatType: string
  lowerBound: number
  upperBound: number
  confidenceLevel: number
  predictionHorizon: string
}

export interface TrendAnalysis {
  trendDirection: 'increasing' | 'decreasing' | 'stable'
  trendStrength: number
  changePoints: ChangePoint[]
  seasonalityStrength: number
  noiseLevel: number
}

export interface ChangePoint {
  timestamp: Date
  changeMagnitude: number
  changeType: 'abrupt' | 'gradual'
  confidence: number
}

export interface ConfidenceBand {
  bandId: string
  upperBand: number[]
  lowerBand: number[]
  confidenceLevel: number
  timestamps: Date[]
}

export interface ModelParameters {
  modelType: string
  parameters: Record<string, unknown>
  trainingMetrics: TrainingMetrics
}

export interface TrainingMetrics {
  loss: number
  accuracy: number
  epochs: number
  trainingTime: number
}

export interface ValidationMetrics {
  mae: number
  mse: number
  rmse: number
  mape: number
  r2: number
}

export interface PropagationGraph extends NetworkGraph {
  graphId: string
  nodes: PropagationNode[]
  edges: PropagationEdge[]
}

export interface PropagationNode extends NetworkNode {
  infectionProbability: number
  recoveryRate: number
  vulnerabilityScore: number
}

export interface PropagationEdge extends NetworkEdge {
  transmissionProbability: number
  transmissionRate: number
}

export interface PropagationProbabilities {
  overallProbability: number
  nodeProbabilities: Map<string, number>
  edgeProbabilities: Map<string, number>
  timeDependentProbabilities: TimeDependentProbability[]
}

export interface TimeDependentProbability {
  timestamp: Date
  probabilities: Record<string, number>
}

export interface ContainmentStrategy {
  strategyId: string
  strategyType: 'isolation' | 'vaccination' | 'patching' | 'monitoring'
  targetNodes: string[]
  effectiveness: number
  cost: number
  implementationTime: number
  sideEffects: string[]
}

export interface SeasonalComponents {
  trend?: TimeSeriesComponent
  seasonal?: TimeSeriesComponent
  residual?: TimeSeriesComponent
  daily?: TimeSeriesComponent
  weekly?: TimeSeriesComponent
  monthly?: TimeSeriesComponent
}

export interface TimeSeriesComponent {
  timestamps: Date[]
  values: number[]
  componentType: string
}

export interface RiskBreakdown {
  byThreatType: Record<string, number>
  bySeverity: Record<string, number>
  byLikelihood: Record<string, number>
  byImpact: Record<string, number>
}

export interface UncertaintyQuantification {
  epistemic: number
  aleatory: number
  total: number
  confidenceIntervals: {
    lower: number
    upper: number
  }
}

export interface RiskRecommendation {
  recommendationId: string
  recommendationType: 'mitigation' | 'prevention' | 'detection' | 'response'
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  implementationCost: number
  expectedEffectiveness: number
  timeToImplement: number
}

export interface ThreatFeatures {
  statistical: StatisticalFeatures
  temporal: TemporalFeatures
  spatial: SpatialFeatures
  categorical: CategoricalFeatures
}

export interface StatisticalFeatures {
  mean: number
  variance: number
  skewness: number
  kurtosis: number
  percentiles: Record<string, number>
}

export interface TemporalFeatures {
  trend: number
  seasonality: number
  autocorrelation: number
  changeRate: number
}

export interface SpatialFeatures {
  geographicSpread: number
  clustering: number
  distanceMetrics: Record<string, number>
}

export interface CategoricalFeatures {
  threatTypeDistribution: Record<string, number>
  severityDistribution: Record<string, number>
  attributionDistribution: Record<string, number>
}
