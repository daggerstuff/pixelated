/**
 * Predictive threat intelligence pure helpers — extracted from
 * predictive-threat-intelligence.ts (no instance state).
 */

export function combineRiskComponents(
  likelihood: number,
  impact: number,
  vulnerability: number,
): number {
  // Use a weighted combination or more sophisticated risk model
  const weights = { likelihood: 0.4, impact: 0.4, vulnerability: 0.2 }
  return (
    likelihood * weights.likelihood +
    impact * weights.impact +
    vulnerability * weights.vulnerability
  )
}


export async function quantifyUncertainty(
  _threats: Threat[],
  _context: SecurityContext,
  riskScore: number,
): Promise<UncertaintyQuantification> {
  // Use Bayesian methods or other uncertainty quantification techniques
  const uncertainty: UncertaintyQuantification = {
    epistemic: 0.2, // Uncertainty due to lack of knowledge
    aleatory: 0.1, // Uncertainty due to inherent randomness
    total: 0.3,
    confidenceIntervals: {
      lower: riskScore * (1 - 0.3),
      upper: riskScore * (1 + 0.3),
    },
  }

  return uncertainty
}


export function generateForecastId(): string {
  return `forecast_${(crypto as unknown as { randomUUID: () => string }).randomUUID()}`
}


export function generateModelId(): string {
  return `model_${(crypto as unknown as { randomUUID: () => string }).randomUUID()}`
}


export function generateAssessmentId(): string {
  return `assessment_${(crypto as unknown as { randomUUID: () => string }).randomUUID()}`
}


export function generateGraphId(): string {
  return `graph_${(crypto as unknown as { randomUUID: () => string }).randomUUID()}`
}


export async function generateContainmentStrategies(
  _simulation: PropagationSimulation,
  _affectedNodes: NetworkNode[],
): Promise<ContainmentStrategy[]> {
  return []
}


export async function calculateTimeToPropagation(
  _simulation: PropagationSimulation,
): Promise<number> {
  return 0
}


export async function generateNovelThreatRecommendations(
  _significantNovelThreats: NovelThreat[],
): Promise<NovelThreat[]> {
  return []
}


export async function extractThreatFeatures(
  _data: ThreatData[],
): Promise<ThreatFeatures> {
  return {
    statistical: {
      mean: 0,
      variance: 0,
      skewness: 0,
      kurtosis: 0,
      percentiles: {},
    },
    temporal: { trend: 0, seasonality: 0, autocorrelation: 0, changeRate: 0 },
    spatial: { geographicSpread: 0, clustering: 0, distanceMetrics: {} },
    categorical: {
      threatTypeDistribution: {},
      severityDistribution: {},
      attributionDistribution: {},
    },
  }
}


export async function analyzeTrends(
  _timeSeries: ThreatTimeSeries[],
  _predictions: PredictedThreat[],
): Promise<TrendAnalysis> {
  return {
    trendDirection: 'stable',
    trendStrength: 0,
    changePoints: [],
    seasonalityStrength: 0,
    noiseLevel: 0,
  }
}


export async function evaluateModelPerformance(
  _models: ForecastingModel[],
  _timeSeries: ThreatTimeSeries[],
): Promise<ModelPerformanceMetrics> {
  return {
    accuracy: 0,
    precision: 0,
    recall: 0,
    f1Score: 0,
    mae: 0,
    mse: 0,
    rmse: 0,
  }
}


export async function identifyAffectedNodes(
  _simulation: PropagationSimulation,
): Promise<NetworkNode[]> {
  return []
}

// Missing method implementations

export async function identifyDailyPattern(
  _components: SeasonalComponents,
): Promise<SeasonalPattern | null> {
  return null
}


export async function identifyWeeklyPattern(
  _components: SeasonalComponents,
): Promise<SeasonalPattern | null> {
  return null
}


export async function identifyMonthlyPattern(
  _components: SeasonalComponents,
): Promise<SeasonalPattern | null> {
  return null
}


export async function identifyYearlyPattern(
  _components: SeasonalComponents,
): Promise<SeasonalPattern | null> {
  return null
}


export async function validateStatisticalSignificance(
  patterns: SeasonalPattern[],
): Promise<SeasonalPattern[]> {
  return patterns.filter((p) => p.statisticalSignificance < 0.05)
}


export async function preprocessThreats(threats: Threat[]): Promise<Threat[]> {
  return threats
}


export async function extractRiskFactors(
  _threats: Threat[],
  _context: SecurityContext,
): Promise<void> {
  // Implementation placeholder
}


export async function calculateThreatLikelihood(
  _threats: Threat[],
  _context: SecurityContext,
): Promise<number> {
  return 0.5
}


export async function calculateThreatImpact(
  _threats: Threat[],
  _context: SecurityContext,
): Promise<number> {
  return 0.5
}


export async function calculateVulnerability(
  _threats: Threat[],
  _context: SecurityContext,
): Promise<number> {
  return 0.5
}


export async function calculateRiskBreakdown(
  _threats: Threat[],
  _context: SecurityContext,
): Promise<RiskBreakdown> {
  return { byThreatType: {}, bySeverity: {}, byLikelihood: {}, byImpact: {} }
}


export async function generateRiskRecommendations(
  _threats: Threat[],
  _context: SecurityContext,
  _breakdown: RiskBreakdown,
): Promise<RiskRecommendation[]> {
  return []
}


export function calculateRiskConfidence(
  _likelihood: number,
  _impact: number,
  _vulnerability: number,
  _uncertainty: UncertaintyQuantification,
): number {
  return 0.8
}


export async function preprocessTimeSeries(
  series: ThreatTimeSeries[],
): Promise<ThreatTimeSeries[]> {
  return series
}


export async function extractTimeSeriesFeatures(
  _series: ThreatTimeSeries[],
): Promise<ThreatFeatures> {
  return {
    statistical: {
      mean: 0,
      variance: 0,
      skewness: 0,
      kurtosis: 0,
      percentiles: {},
    },
    temporal: { trend: 0, seasonality: 0, autocorrelation: 0, changeRate: 0 },
    spatial: { geographicSpread: 0, clustering: 0, distanceMetrics: {} },
    categorical: {
      threatTypeDistribution: {},
      severityDistribution: {},
      attributionDistribution: {},
    },
  }
}


export async function calculateTimeSeriesConfidenceBands(
  _predictions: PredictionResult[],
): Promise<ConfidenceBand[]> {
  return []
}


export async function extractModelParameters(
  _model: ForecastingModel,
): Promise<ModelParameters> {
  return {
    modelType: 'unknown',
    parameters: {},
    trainingMetrics: { loss: 0, accuracy: 0, epochs: 0, trainingTime: 0 },
  }
}


export async function calculateValidationMetrics(
  _model: ForecastingModel,
  _series: ThreatTimeSeries[],
): Promise<ValidationMetrics> {
  return { mae: 0, mse: 0, rmse: 0, mape: 0, r2: 0 }
}


export function removeDuplicateThreats(threats: ThreatData[]): ThreatData[] {
  const seen = new Set<string>()
  return threats.filter((t) => {
    if (seen.has(t.threatId)) return false
    seen.add(t.threatId)
    return true
  })
}


export async function imputeMissingValues(
  threats: ThreatData[],
): Promise<ThreatData[]> {
  return threats
}


export async function normalizeThreatData(
  threats: ThreatData[],
): Promise<ThreatData[]> {
  return threats
}


export function groupByThreatType(
  threats: ThreatData[],
): Record<string, ThreatData[]> {
  return threats.reduce<Record<string, ThreatData[]>>((acc, threat) => {
    acc[threat.threatType] ??= []
    acc?.[threat.threatType].push(threat)
    return acc
  }, {})
}


export async function trainLSTMModel(
  _series: ThreatTimeSeries,
  _components: SeasonalComponents,
): Promise<ForecastingModel> {
  return {
    threatType: 'unknown',
    predict: async () => ({
      value: 0,
      confidence: 0,
      probability: 0,
      factors: [],
    }),
  }
}


export async function trainARIMAModel(
  _series: ThreatTimeSeries,
  _components: SeasonalComponents,
): Promise<ForecastingModel> {
  return {
    threatType: 'unknown',
    predict: async () => ({
      value: 0,
      confidence: 0,
      probability: 0,
      factors: [],
    }),
  }
}


export async function trainEnsembleModel(
  _lstm: ForecastingModel,
  _arima: ForecastingModel,
): Promise<ForecastingModel> {
  return {
    threatType: 'unknown',
    predict: async () => ({
      value: 0,
      confidence: 0,
      probability: 0,
      factors: [],
    }),
  }
}


export function calculateTimeHorizon(timeframe: TimeWindow): string {
  const days = Math.ceil(
    (timeframe.end.getTime() - timeframe.start.getTime()) /
      (1000 * 60 * 60 * 24),
  )
  return `${days} days`
}


export async function calculatePredictionInterval(
  _prediction: PredictedThreat,
): Promise<ConfidenceInterval> {
  return {
    intervalId: 'interval_1',
    threatType: 'unknown',
    lowerBound: 0,
    upperBound: 1,
    confidenceLevel: 0.95,
    predictionHorizon: '1 day',
  }
}


export async function calculateSimilarityToKnownThreats(
  _threat: NovelThreat,
  _baselineFeatures: ThreatFeatures,
): Promise<number> {
  return 0.5
}


export async function calculateInfectionProbability(
  _node: NetworkNode,
  _threat: Threat,
): Promise<number> {
  return 0.5
}


export async function calculateRecoveryRate(_node: NetworkNode): Promise<number> {
  return 0.1
}


export async function calculateVulnerabilityScore(
  _node: NetworkNode,
): Promise<number> {
  return 0.5
}


export async function calculateTransmissionProbability(
  _edge: NetworkEdge,
  _threat: Threat,
): Promise<number> {
  return 0.5
}


export async function calculateTransmissionRate(_edge: NetworkEdge): Promise<number> {
  return 0.1
}


export async function calculateBasicReproductionNumber(
  _graph: PropagationGraph,
  _threat: Threat,
): Promise<number> {
  return 1.0
}


export async function calculateNodeInfectionProbability(
  _node: PropagationNode,
  _graph: PropagationGraph,
): Promise<number> {
  return 0.5
}


export async function calculateEdgeTransmissionProbability(
  _edge: PropagationEdge,
  _graph: PropagationGraph,
): Promise<number> {
  return 0.5
}

