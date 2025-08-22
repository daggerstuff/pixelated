/**
 * Python Bias Detection Service Bridge
 *
 * Handles communication with the Python Flask service for bias detection analysis.
 * Extracted from BiasDetectionEngine.ts for better separation of concerns.
 */

import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import { ConnectionPool, ConnectionPoolConfig, PooledConnection } from './connection-pool'
import type {
  TherapeuticSession,
  PreprocessingAnalysisResult,
  ModelLevelAnalysisResult,
  InteractiveAnalysisResult,
  EvaluationAnalysisResult,
  BiasReport,
  BiasDetectionConfig,
  BiasAnalysisResult,
  DemographicGroup,
} from './types'
import type {
  PythonSessionData,
  PythonAnalysisResult,
  PythonHealthResponse,
  MetricData,
  MetricsBatchResponse,
  DashboardOptions,
  DashboardMetrics,
  PerformanceMetrics,
  AlertData,
  AlertRegistration,
  AlertResponse,
  AlertAcknowledgment,
  AlertEscalation,
  AlertStatistics,
  NotificationData,
  SystemNotificationData,
  TimeRange,
  ReportGenerationOptions,
  FallbackAnalysisResult,
  AlertLevel,
} from './bias-detection-interfaces'

const logger = createBuildSafeLogger('PythonBiasDetectionBridge')

/**
 * Production HTTP client for Python Bias Detection Service
 * Connects to Flask service running on localhost:5000 (configurable)
 */
export class PythonBiasDetectionBridge {
  private baseUrl: string
  private timeout: number
  private authToken?: string | undefined
  private retryAttempts: number = 3
  private retryDelay: number = 1000 // ms
  private requestQueue: Array<{
    id: string
    request: () => Promise<unknown>
    resolve: (value: unknown) => void
    reject: (error: Error) => void
    priority: number
  }> = []
  private processingQueue = false
  private maxConcurrentRequests = 5
  private activeRequests = 0
  private healthStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
  private lastHealthCheck = new Date()
  private healthCheckInterval = 30000 // 30 seconds
  private consecutiveFailures = 0
  private pendingRequests = new Map<string, Promise<unknown>>()
  private metrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    cacheHits: 0,
    cacheMisses: 0,
    deduplicatedRequests: 0,
  }
  private connectionPool: ConnectionPool

  constructor(
    public url: string = 'http://localhost:5000',
    public timeoutMs: number = 30000,
    connectionPool?: ConnectionPool,
    poolConfig?: Partial<ConnectionPoolConfig>
  ) {
    this.baseUrl = url.replace(/\/$/, '') // Remove trailing slash
    this.timeout = timeoutMs
    this.authToken = process.env['BIAS_DETECTION_AUTH_TOKEN']
    this.connectionPool = connectionPool || new ConnectionPool(poolConfig)
    // Start queue processor
    this.processQueue()
    // Start health monitoring
    this.startHealthMonitoring()
  }

  async initialize(): Promise<void> {
    try {
      // Check service health
      const response = (await this.makeRequest(
        '/health',
        'GET',
      )) as PythonHealthResponse
      if (response.status !== 'healthy') {
        throw new Error(
          `Python service not healthy: ${response.message || 'Unknown error'}`,
        )
      }
      logger.info('PythonBiasDetectionBridge initialized successfully', {
        serviceUrl: this.baseUrl,
        serviceStatus: response.status,
      })
    } catch (error: unknown) {
      logger.error('Failed to initialize PythonBiasDetectionBridge', { error })
      throw new Error(
        `Python service initialization failed: ${error instanceof Error ? String(error) : String(error)}`,
      )
    }
  }

  private async queueRequest<T>(
    requestFn: () => Promise<T>,
    priority: number = 1
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      this.requestQueue.push({
        id,
        request: requestFn as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
        priority,
      })
      
      // Sort by priority (higher numbers = higher priority)
      this.requestQueue.sort((a, b) => b.priority - a.priority)
    })
  }

  private async processQueue(): Promise<void> {
    if (this.processingQueue) return
    this.processingQueue = true

    while (this.requestQueue.length > 0 || this.activeRequests > 0) {
      // Process requests up to the concurrent limit
      while (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrentRequests) {
        const queuedRequest = this.requestQueue.shift()!
        this.activeRequests++

        // Execute request asynchronously
        queuedRequest.request()
          .then(result => {
            queuedRequest.resolve(result)
          })
          .catch(error => {
            queuedRequest.reject(error)
          })
          .finally(() => {
            this.activeRequests--
          })
      }

      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 10))
    }

    this.processingQueue = false
  }

  private async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' = 'POST',
    data?: unknown,
    priority: number = 1,
  ): Promise<unknown> {
    return this.queueRequest(async () => {
      return this.executeRequest(endpoint, method, data)
    }, priority)
  }

  private async executeRequest(
    endpoint: string,
    method: 'GET' | 'POST' = 'POST',
    data?: unknown,
  ): Promise<unknown> {
    const url = `${this.baseUrl}${endpoint}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Pixelated-Empathy-TypeScript-Client/1.0',
    }

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(this.timeout),
    }

    if (data && method === 'POST') {
      fetchOptions.body = JSON.stringify(data)
    }

    let lastError: Error | null = null
    let pooledConnection: PooledConnection | null = null

    // Retry logic
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        // Acquire a pooled connection for this request
        pooledConnection = await this.connectionPool.acquireConnection()
        logger.debug(
          `Making request to ${url} (attempt ${attempt}/${this.retryAttempts})`,
        )

        const response = await fetch(url, fetchOptions)

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`HTTP ${response.status}: ${errorText}`)
        }

        const result = await response.json()
        logger.debug(`Request successful: ${method} ${endpoint}`)
        return result
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error))
        logger.warn(`Request attempt ${attempt} failed: ${lastError.message}`, {
          url,
          method,
          attempt,
          error: lastError.message,
        })

        if (attempt < this.retryAttempts) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.retryDelay * attempt),
          )
        }
      } finally {
        // Always release the connection if it was acquired
        if (pooledConnection) {
          this.connectionPool.releaseConnection(pooledConnection)
          pooledConnection = null
        }
      }
    }

    throw new Error(
      `Request failed after ${this.retryAttempts} attempts: ${lastError?.message || 'Unknown error'}`,
    )
  }

  async runPreprocessingAnalysis(
    sessionData: TherapeuticSession,
  ): Promise<PreprocessingAnalysisResult> {
    try {
      const result = (await this.analyze_session(
        sessionData,
      )) as PythonAnalysisResult
      const layerResult = result.layer_results?.preprocessing

      if (layerResult) {
        // Map Python response structure to TypeScript expectations
        return {
          biasScore: layerResult.bias_score,
          linguisticBias: {
            genderBiasScore:
              layerResult.metrics?.linguistic_bias?.gender_bias_score ||
              layerResult.bias_score * 0.5,
            racialBiasScore:
              layerResult.metrics?.linguistic_bias?.racial_bias_score ||
              layerResult.bias_score * 0.4,
            ageBiasScore:
              layerResult.metrics?.linguistic_bias?.age_bias_score ||
              layerResult.bias_score * 0.3,
            culturalBiasScore:
              layerResult.metrics?.linguistic_bias?.cultural_bias_score ||
              layerResult.bias_score * 0.4,
            biasedTerms: [],
            sentimentAnalysis: {
              overallSentiment: 0.5,
              emotionalValence: 0.5,
              subjectivity: 0.5,
              demographicVariations: {},
            },
          },
          representationAnalysis: {
            demographicDistribution: {},
            underrepresentedGroups: [],
            overrepresentedGroups: [],
            diversityIndex: 0.5,
            intersectionalityAnalysis: [],
          },
          dataQualityMetrics: {
            completeness: 0.8,
            consistency: 0.8,
            accuracy: 0.8,
            timeliness: 0.8,
            validity: 0.8,
            missingDataByDemographic: {},
          },
          recommendations: layerResult.recommendations || [],
        }
      }

      // Fallback for missing layer result
      return {
        biasScore: result.overall_bias_score * 0.8,
        linguisticBias: {
          genderBiasScore: result.overall_bias_score * 0.5,
          racialBiasScore: result.overall_bias_score * 0.4,
          ageBiasScore: result.overall_bias_score * 0.3,
          culturalBiasScore: result.overall_bias_score * 0.4,
          biasedTerms: [],
          sentimentAnalysis: {
            overallSentiment: 0.5,
            emotionalValence: 0.5,
            subjectivity: 0.5,
            demographicVariations: {},
          },
        },
        representationAnalysis: {
          demographicDistribution: {},
          underrepresentedGroups: [],
          overrepresentedGroups: [],
          diversityIndex: 0.5,
          intersectionalityAnalysis: [],
        },
        dataQualityMetrics: {
          completeness: 0.8,
          consistency: 0.8,
          accuracy: 0.8,
          timeliness: 0.8,
          validity: 0.8,
          missingDataByDemographic: {},
        },
        recommendations: [],
      }
    } catch (error: unknown) {
      logger.error('Preprocessing analysis failed', {
        error,
        sessionId: sessionData?.sessionId,
      })
      throw error
    }
  }

  async runModelLevelAnalysis(
    sessionData: TherapeuticSession,
  ): Promise<ModelLevelAnalysisResult> {
    try {
      const result = (await this.analyze_session(
        sessionData,
      )) as PythonAnalysisResult
      const layerResult = result.layer_results?.model_level

      if (layerResult) {
        // Map Python response structure to TypeScript expectations
        return {
          biasScore: layerResult.bias_score,
          fairnessMetrics: {
            demographicParity:
              layerResult.metrics?.fairness?.demographic_parity || 0.75,
            equalizedOdds: layerResult.metrics?.fairness?.equalized_odds || 0.8,
            equalOpportunity:
              layerResult.metrics?.fairness?.equal_opportunity || 0.8,
            calibration: layerResult.metrics?.fairness?.calibration || 0.8,
            individualFairness:
              layerResult.metrics?.fairness?.individual_fairness || 0.8,
            counterfactualFairness:
              layerResult.metrics?.fairness?.counterfactual_fairness || 0.8,
          },
          performanceMetrics: {
            accuracy: 0.8,
            precision: 0.8,
            recall: 0.8,
            f1Score: 0.8,
            auc: 0.8,
            calibrationError: 0.1,
            demographicBreakdown: {},
          },
          groupPerformanceComparison: [],
          recommendations: layerResult.recommendations || [],
        }
      }

      // Fallback for missing layer result
      return {
        biasScore: result.overall_bias_score * 1.1,
        fairnessMetrics: {
          demographicParity: 0.75,
          equalizedOdds: 0.8,
          equalOpportunity: 0.8,
          calibration: 0.8,
          individualFairness: 0.8,
          counterfactualFairness: 0.8,
        },
        performanceMetrics: {
          accuracy: 0.8,
          precision: 0.8,
          recall: 0.8,
          f1Score: 0.8,
          auc: 0.8,
          calibrationError: 0.1,
          demographicBreakdown: {},
        },
        groupPerformanceComparison: [],
        recommendations: [],
      }
    } catch (error: unknown) {
      logger.error('Model-level analysis failed', {
        error,
        sessionId: sessionData?.sessionId,
      })
      throw error
    }
  }

  async runInteractiveAnalysis(
    sessionData: TherapeuticSession,
  ): Promise<InteractiveAnalysisResult> {
    try {
      const result = (await this.analyze_session(
        sessionData,
      )) as PythonAnalysisResult
      const layerResult = result.layer_results?.interactive

      if (layerResult) {
        // Map Python response structure to TypeScript expectations
        return {
          biasScore: layerResult.bias_score,
          counterfactualAnalysis: {
            scenariosAnalyzed:
              layerResult.metrics?.interaction_patterns?.pattern_consistency ||
              3,
            biasDetected: layerResult.bias_score > 0.5,
            consistencyScore: Math.max(
              0.15,
              (1 - layerResult.bias_score) * 0.2,
            ),
            problematicScenarios: [],
          },
          featureImportance: [],
          whatIfScenarios: [],
          recommendations: layerResult.recommendations || [],
        }
      }

      // Fallback for missing layer result
      return {
        biasScore: result.overall_bias_score * 0.9,
        counterfactualAnalysis: {
          scenariosAnalyzed: 3,
          biasDetected: result.overall_bias_score > 0.5,
          consistencyScore: 0.15,
          problematicScenarios: [],
        },
        featureImportance: [],
        whatIfScenarios: [],
        recommendations: [],
      }
    } catch (error: unknown) {
      logger.error('Interactive analysis failed', {
        error,
        sessionId: sessionData?.sessionId,
      })
      throw error
    }
  }

  async runEvaluationAnalysis(
    sessionData: TherapeuticSession,
  ): Promise<EvaluationAnalysisResult> {
    try {
      const result = (await this.analyze_session(
        sessionData,
      )) as PythonAnalysisResult
      const layerResult = result.layer_results?.evaluation

      if (layerResult) {
        // Map Python response structure to TypeScript expectations
        return {
          biasScore: layerResult.bias_score,
          huggingFaceMetrics: {
            toxicity:
              layerResult.metrics?.performance_disparities?.bias_score || 0.05,
            bias: layerResult.bias_score,
            regard: {},
            stereotype: layerResult.bias_score * 0.8,
            fairness: 1 - layerResult.bias_score,
          },
          customMetrics: {
            therapeuticBias: layerResult.bias_score * 0.9,
            culturalSensitivity: 1 - layerResult.bias_score * 0.7,
            professionalEthics: 1 - layerResult.bias_score * 0.8,
            patientSafety: 1 - layerResult.bias_score * 0.6,
          },
          temporalAnalysis: {
            trendDirection: 'stable',
            changeRate: 0,
            seasonalPatterns: [],
            interventionEffectiveness: [],
          },
          recommendations: layerResult.recommendations || [],
        }
      }

      // Fallback for missing layer result
      return {
        biasScore: result.overall_bias_score * 1.0,
        huggingFaceMetrics: {
          toxicity: 0.05,
          bias: result.overall_bias_score,
          regard: {},
          stereotype: result.overall_bias_score * 0.8,
          fairness: 1 - result.overall_bias_score,
        },
        customMetrics: {
          therapeuticBias: result.overall_bias_score * 0.9,
          culturalSensitivity: 1 - result.overall_bias_score * 0.7,
          professionalEthics: 1 - result.overall_bias_score * 0.8,
          patientSafety: 1 - result.overall_bias_score * 0.6,
        },
        temporalAnalysis: {
          trendDirection: 'stable',
          changeRate: 0,
          seasonalPatterns: [],
          interventionEffectiveness: [],
        },
        recommendations: [],
      }
    } catch (error: unknown) {
      logger.error('Evaluation analysis failed', {
        error,
        sessionId: sessionData?.sessionId,
      })
      throw error
    }
  }

  async generateComprehensiveReport(
    sessions: TherapeuticSession[],
    timeRange: TimeRange,
    options: ReportGenerationOptions,
  ): Promise<BiasReport> {
    try {
      const requestData = {
        sessions: sessions.map((session) => ({
          session_id: session.sessionId,
          participant_demographics: session.participantDemographics,
          training_scenario: session.scenario,
          content: session.content,
          ai_responses: session.aiResponses || [],
          expected_outcomes: session.expectedOutcomes || [],
          transcripts: session.transcripts || [],
          metadata: session.metadata || {},
        })),
        time_range: timeRange,
        options: {
          format: options?.format || 'json',
          include_raw_data: options?.includeRawData || false,
          include_trends: options?.includeTrends || true,
          include_recommendations: options?.includeRecommendations || true,
        },
      }

      return (await this.makeRequest(
        '/export',
        'POST',
        requestData,
      )) as BiasReport
    } catch (error: unknown) {
      logger.error('Report generation failed', {
        error,
        sessionCount: sessions.length,
      })
      throw error
    }
  }

  async updateConfiguration(
    config: Partial<BiasDetectionConfig>,
  ): Promise<void> {
    try {
      await this.makeRequest('/config', 'POST', config)
      logger.info('Python service configuration updated successfully')
    } catch (error: unknown) {
      logger.error('Configuration update failed', { error })
      throw error
    }
  }

  async explainBiasDetection(
    result: BiasAnalysisResult,
    demographic?: DemographicGroup,
    includeCounterfactuals: boolean = true,
  ): Promise<unknown> {
    try {
      const requestData = {
        analysis_result: result,
        demographic_group: demographic,
        include_counterfactuals: includeCounterfactuals,
      }

      return await this.makeRequest('/explain', 'POST', requestData)
    } catch (error: unknown) {
      logger.error('Bias explanation failed', { error })
      throw error
    }
  }

  async analyze_session(
    sessionData: TherapeuticSession,
  ): Promise<PythonAnalysisResult> {
    // Create a unique key for deduplication
    const requestKey = this.generateRequestKey(sessionData)
    
    // Check if the same request is already pending
    if (this.pendingRequests.has(requestKey)) {
      logger.debug(`Deduplicating request for session: ${sessionData.sessionId}`)
      this.metrics.deduplicatedRequests++
      return this.pendingRequests.get(requestKey) as Promise<PythonAnalysisResult>
    }

    const requestPromise = this.executeAnalysis(sessionData)
    this.pendingRequests.set(requestKey, requestPromise)
    
    try {
      const result = await requestPromise
      return result
    } finally {
      this.pendingRequests.delete(requestKey)
    }
  }

  private generateRequestKey(sessionData: TherapeuticSession): string {
    // Create a hash of the session data for deduplication
    const keyData = {
      sessionId: sessionData.sessionId,
      demographics: sessionData.participantDemographics,
      content: sessionData.content,
      scenario: sessionData.scenario,
    }
    
    const jsonString = JSON.stringify(keyData)
    // Simple hash function (in production, use a proper hash library)
    let hash = 0
    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return `analysis_${Math.abs(hash).toString(36)}`
  }

  private async executeAnalysis(
    sessionData: TherapeuticSession,
  ): Promise<PythonAnalysisResult> {
    const startTime = Date.now()
    this.metrics.totalRequests++
    
    try {
      // Convert TypeScript session format to Python service format
      // Validate that demographics are properly provided - don't mask missing data
      if (!sessionData.participantDemographics) {
        throw new Error(
          `Missing participant demographics for session ${sessionData.sessionId}. ` +
            'Demographics are required for bias detection analysis.',
        )
      }

      const requestData: PythonSessionData = {
        session_id: sessionData.sessionId,
        participant_demographics: sessionData.participantDemographics,
        training_scenario:
          (sessionData.scenario as unknown as Record<string, unknown>) || {},
        content: sessionData.content || {
          patientPresentation: 'Not provided',
          therapeuticInterventions: [],
          patientResponses: [],
          sessionNotes: '',
        },
        ai_responses: sessionData.aiResponses || [],
        expected_outcomes: sessionData.expectedOutcomes || [],
        transcripts: sessionData.transcripts || [],
        metadata: {
          ...sessionData.metadata,
          timestamp: new Date().toISOString(),
          client: 'typescript-engine',
          analysis_layers: [
            'preprocessing',
            'model_level',
            'interactive',
            'evaluation',
          ],
        },
      }

      const result = (await this.makeRequest(
        '/analyze',
        'POST',
        requestData,
      )) as PythonAnalysisResult

      // Ensure result has expected structure
      const normalizedResult: PythonAnalysisResult = {
        overall_bias_score: result.overall_bias_score || 0.5,
        confidence: result.confidence || 0.7,
        alert_level: (result.alert_level ||
          this.calculateAlertLevel(
            result.overall_bias_score || 0.5,
          )) as AlertLevel,
        layer_results: result.layer_results || {
          preprocessing: {
            bias_score: 0.4,
            metrics: {},
            detected_biases: [],
            recommendations: [],
            layer: 'preprocessing',
          },
          model_level: {
            bias_score: 0.5,
            metrics: {},
            detected_biases: [],
            recommendations: [],
            layer: 'model_level',
          },
          interactive: {
            bias_score: 0.6,
            metrics: {},
            detected_biases: [],
            recommendations: [],
            layer: 'interactive',
          },
          evaluation: {
            bias_score: 0.3,
            metrics: {},
            detected_biases: [],
            recommendations: [],
            layer: 'evaluation',
          },
        },
        recommendations: result.recommendations || [],
        timestamp: new Date().toISOString(),
        session_id: sessionData.sessionId,
      }

      const responseTime = Date.now() - startTime
      this.updateMetrics(responseTime, true)
      
      logger.info('Session analysis completed', {
        sessionId: sessionData.sessionId,
        biasScore: normalizedResult.overall_bias_score,
        alertLevel: normalizedResult.alert_level,
        responseTime,
      })

      return normalizedResult
    } catch (error: unknown) {
      const responseTime = Date.now() - startTime
      this.updateMetrics(responseTime, false)
      
      logger.error('Session analysis failed', {
        error,
        sessionId: sessionData?.sessionId,
        responseTime,
      })

      // Return fallback analysis result instead of throwing
      return this.generateFallbackAnalysisResult(sessionData, error)
    }
  }

  private calculateAlertLevel(biasScore: number): AlertLevel {
    if (biasScore >= 0.8) {
      return 'critical'
    }
    if (biasScore >= 0.6) {
      return 'high'
    }
    if (biasScore >= 0.4) {
      return 'medium'
    }
    return 'low'
  }

  private generateFallbackAnalysisResult(
    sessionData: TherapeuticSession | unknown,
    error: Error | unknown,
  ): FallbackAnalysisResult {
    logger.warn('Generating fallback analysis result due to service failure', {
      sessionId: (sessionData as TherapeuticSession)?.sessionId,
      error: error instanceof Error ? String(error) : String(error),
    })

    return {
      overall_bias_score: 0.5, // Neutral fallback score
      confidence: 0.3, // Low confidence for fallback
      alert_level: 'medium' as AlertLevel,
      layer_results: {
        preprocessing: {
          bias_score: 0.4,
          metrics: { linguistic_bias: { overall_bias_score: 0.4 } },
          detected_biases: ['service_unavailable'],
          recommendations: [
            'Python service unavailable - using fallback analysis',
          ],
          layer: 'preprocessing',
        },
        model_level: {
          bias_score: 0.5,
          metrics: {
            fairness: { equalized_odds: 0.7, demographic_parity: 0.6 },
          },
          detected_biases: ['service_unavailable'],
          recommendations: [
            'Python service unavailable - using fallback analysis',
          ],
          layer: 'model_level',
        },
        interactive: {
          bias_score: 0.6,
          metrics: { interaction_patterns: { pattern_consistency: 3 } },
          detected_biases: ['service_unavailable'],
          recommendations: [
            'Python service unavailable - using fallback analysis',
          ],
          layer: 'interactive',
        },
        evaluation: {
          bias_score: 0.3,
          metrics: {
            outcome_fairness: { bias_score: 0.3 },
            performance_disparities: { bias_score: 0.2 },
          },
          detected_biases: ['service_unavailable'],
          recommendations: [
            'Python service unavailable - using fallback analysis',
          ],
          layer: 'evaluation',
        },
      },
      recommendations: [
        'Python bias detection service is currently unavailable',
        'Results are based on fallback analysis with limited accuracy',
        'Please retry analysis when service is restored',
      ],
      timestamp: new Date().toISOString(),
      session_id: (sessionData as TherapeuticSession)?.sessionId || 'unknown',
      fallback_mode: true,
      service_error: error instanceof Error ? String(error) : String(error),
    }
  }

  // Metrics-specific public methods
  async sendMetricsBatch(metrics: MetricData[]): Promise<MetricsBatchResponse> {
    try {
      return (await this.makeRequest('/metrics/batch', 'POST', {
        metrics,
      })) as MetricsBatchResponse
    } catch (error: unknown) {
      logger.warn('Failed to send metrics batch to Python service', {
        error,
        metricsCount: metrics.length,
      })
      return {
        success: false,
        processed: 0,
        errors: [error instanceof Error ? String(error) : String(error)],
      }
    }
  }

  async sendAnalysisMetric(metricData: MetricData): Promise<void> {
    await this.makeRequest('/metrics/analysis', 'POST', metricData)
  }

  async getDashboardMetrics(
    options?: DashboardOptions,
  ): Promise<DashboardMetrics> {
    // Always use GET method for dashboard data retrieval
    // Convert options to query parameters for consistent REST API design
    if (options) {
      const queryParams = new URLSearchParams({
        time_range: options.time_range || '24h',
        include_details: options.include_details?.toString() || 'false',
        aggregation_type: options.aggregation_type || 'hourly',
      }).toString()
      return (await this.makeRequest(
        `/dashboard?${queryParams}`,
        'GET',
      )) as DashboardMetrics
    }
    return (await this.makeRequest('/dashboard', 'GET')) as DashboardMetrics
  }

  async recordReportMetric(reportData: MetricData): Promise<void> {
    await this.makeRequest('/metrics/report', 'POST', reportData)
  }

  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    return (await this.makeRequest(
      '/metrics/performance',
      'GET',
    )) as PerformanceMetrics
  }

  async getSessionData(sessionId: string): Promise<TherapeuticSession> {
    return (await this.makeRequest(
      `/sessions/${sessionId}`,
      'GET',
    )) as TherapeuticSession
  }

  async storeMetrics(storeData: MetricData[]): Promise<void> {
    await this.makeRequest('/metrics/store', 'POST', { metrics: storeData })
  }

  // Alert-specific public methods
  async registerAlertSystem(
    registrationData: AlertRegistration,
  ): Promise<AlertResponse> {
    return (await this.makeRequest(
      '/alerts/register',
      'POST',
      registrationData,
    )) as AlertResponse
  }

  async checkAlerts(alertData: AlertData): Promise<AlertResponse[]> {
    return (await this.makeRequest(
      '/alerts/check',
      'POST',
      alertData,
    )) as AlertResponse[]
  }

  async storeAlerts(alertsData: AlertData[]): Promise<void> {
    await this.makeRequest('/alerts/store', 'POST', { alerts: alertsData })
  }

  async escalateAlert(escalationData: AlertEscalation): Promise<AlertResponse> {
    return (await this.makeRequest(
      '/alerts/escalate',
      'POST',
      escalationData,
    )) as AlertResponse
  }

  async getActiveAlerts(): Promise<AlertData[]> {
    return (await this.makeRequest('/alerts/active', 'GET')) as AlertData[]
  }

  async acknowledgeAlert(
    acknowledgeData: AlertAcknowledgment,
  ): Promise<AlertResponse> {
    return (await this.makeRequest(
      '/alerts/acknowledge',
      'POST',
      acknowledgeData,
    )) as AlertResponse
  }

  async getRecentAlerts(timeRangeData: TimeRange): Promise<AlertData[]> {
    return (await this.makeRequest(
      '/alerts/recent',
      'POST',
      timeRangeData,
    )) as AlertData[]
  }

  async getAlertStatistics(
    statisticsData: TimeRange,
  ): Promise<AlertStatistics> {
    return (await this.makeRequest(
      '/alerts/statistics',
      'POST',
      statisticsData,
    )) as AlertStatistics
  }

  async unregisterAlertSystem(unregisterData: {
    system_id: string
  }): Promise<AlertResponse> {
    return (await this.makeRequest(
      '/alerts/unregister',
      'POST',
      unregisterData,
    )) as AlertResponse
  }

  // Notification-specific public methods
  async sendNotification(notificationData: NotificationData): Promise<void> {
    await this.makeRequest('/notifications/send', 'POST', notificationData)
  }

  async sendSystemNotification(
    systemNotificationData: SystemNotificationData,
  ): Promise<void> {
    await this.makeRequest(
      '/notifications/system',
      'POST',
      systemNotificationData,
    )
  }

  private startHealthMonitoring() {
    setInterval(async () => {
      try {
        const startTime = Date.now()
        const response = await this.executeRequest('/health', 'GET')
        const responseTime = Date.now() - startTime
        
        if (response && typeof response === 'object' && response !== null && 'status' in response && (response as { status: string }).status === 'healthy') {
          this.consecutiveFailures = 0
          this.healthStatus = responseTime > 5000 ? 'degraded' : 'healthy'
        } else {
          this.consecutiveFailures++
          this.healthStatus = this.consecutiveFailures > 3 ? 'unhealthy' : 'degraded'
        }
        
        this.lastHealthCheck = new Date()
        
        logger.debug('Health check completed', {
          status: this.healthStatus,
          responseTime,
          consecutiveFailures: this.consecutiveFailures,
        })
      } catch (error: unknown) {
        this.consecutiveFailures++
        this.healthStatus = this.consecutiveFailures > 3 ? 'unhealthy' : 'degraded'
        this.lastHealthCheck = new Date()
        
        logger.warn('Health check failed', {
          error: error instanceof Error ? String(error) : String(error),
          consecutiveFailures: this.consecutiveFailures,
          status: this.healthStatus,
        })
      }
    }, this.healthCheckInterval)
  }

  private updateMetrics(responseTime: number, success: boolean): void {
    if (success) {
      this.metrics.successfulRequests++
    } else {
      this.metrics.failedRequests++
    }
    
    // Update average response time using exponential moving average
    const alpha = 0.1 // Smoothing factor
    this.metrics.averageResponseTime = 
      this.metrics.averageResponseTime * (1 - alpha) + responseTime * alpha
  }

  getMetrics(): typeof this.metrics {
    return { ...this.metrics }
  }

  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy'
    lastCheck: Date
    consecutiveFailures: number
    queueLength: number
    activeRequests: number
  } {
    return {
      status: this.healthStatus,
      lastCheck: this.lastHealthCheck,
      consecutiveFailures: this.consecutiveFailures,
      queueLength: this.requestQueue.length,
      activeRequests: this.activeRequests,
    }
  }

  async dispose(): Promise<void> {
    // Clear the request queue
    this.requestQueue.forEach(req => {
      req.reject(new Error('Service is being disposed'))
    })
    this.requestQueue.length = 0
    
    logger.info('PythonBiasDetectionBridge disposed')
  }
}
