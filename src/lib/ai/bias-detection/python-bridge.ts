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
} from './types'
import type {
  PythonAnalysisResult,
  PythonHealthResponse,
  MetricsBatchResponse,
  DashboardMetrics,
  PerformanceMetrics,
  AlertData,
  AlertResponse,
  AlertStatistics,
  DashboardOptions,
  MetricData,
  AlertRegistration,
  AlertEscalation,
  AlertAcknowledgment,
  NotificationData,
  SystemNotificationData,
  TimeRange,
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
    if (this.processingQueue) {
      return
    }
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
      // Should call another method, like makeRequest, to get the analysis from Python service
      const result = (await this.makeRequest('/analyze/preprocessing', 'POST', sessionData)) as PythonAnalysisResult
      const layerResult = result?.layer_results?.preprocessing
      if (layerResult) {
        // Map Python response structure to TypeScript expectations
        // Ensure all expected properties and TypeScript fields are filled
        // Defensively hydrate all intermediate metric objects to avoid undefined access errors
        const metrics = (layerResult.metrics ?? {}) as Record<string, any>;
        const ling = (metrics['linguistic_bias'] ?? {}) as Record<string, any>;
        const sentiment = (ling['sentiment_analysis'] ?? {}) as Record<string, any>;
        const rep = (metrics['representation_analysis'] ?? {}) as Record<string, any>;
        const dq = (metrics['data_quality_metrics'] ?? {}) as Record<string, any>;
        return {
          biasScore: typeof layerResult.bias_score === 'number' ? layerResult.bias_score : 0.5,
          linguisticBias: {
            genderBiasScore: ling['gender_bias_score'] ?? 0.5,
            racialBiasScore: ling['racial_bias_score'] ?? 0.5,
            ageBiasScore: ling['age_bias_score'] ?? 0.5,
            culturalBiasScore: ling['cultural_bias_score'] ?? 0.5,
            overallBiasScore: ling['overall_bias_score'] ?? 0.5,
            biasedTerms: ling['biased_terms'] ?? [],
            sentimentAnalysis: {
              positive: sentiment['positive'] ?? 0,
              neutral: sentiment['neutral'] ?? 1,
              negative: sentiment['negative'] ?? 0,
              overallSentiment: sentiment['overallSentiment'] ?? 0,
              emotionalValence: sentiment['emotionalValence'] ?? 0,
              subjectivity: sentiment['subjectivity'] ?? 0,
              demographicVariations: sentiment['demographicVariations'] ?? {},
            },
          },
          representationAnalysis: {
            representationParity: rep['representation_parity'] ?? 0.5,
            minorityGroupScore: rep['minority_group_score'] ?? 0.5,
            demographicDistribution: rep['demographic_distribution'] ?? {},
            underrepresentedGroups: rep['underrepresented_groups'] ?? [],
            overrepresentedGroups: rep['overrepresented_groups'] ?? [],
            diversityIndex: rep['diversity_index'] ?? 0,
            intersectionalityAnalysis: rep['intersectionality_analysis'] ?? []
          },
          dataQualityMetrics: {
            completeness: dq['completeness'] ?? 1,
            consistency: dq['consistency'] ?? 1,
            coverage: dq['coverage'] ?? 1,
            accuracy: dq['accuracy'] ?? 1,
            timeliness: dq['timeliness'] ?? 1,
            validity: dq['validity'] ?? 1,
            missingDataByDemographic: dq['missingDataByDemographic'] ?? {},
          },
          detectedBiases: layerResult.detected_biases ?? ['service_unavailable'],
          recommendations: layerResult.recommendations ?? ['Python service unavailable - using fallback analysis'],
          layer: layerResult.layer ?? 'preprocessing',
          timestamp: result.timestamp ?? new Date().toISOString(),
          sessionId: (sessionData as TherapeuticSession)?.sessionId || 'unknown',
          fallbackMode: false,
          serviceError: undefined,
        } as PreprocessingAnalysisResult;
      }
      // Fallback: construct and return PreprocessingAnalysisResult with neutral values
      return this.createFallbackPreprocessingResult(sessionData)
    } catch (error: unknown) {
      logger.warn("Error in runPreprocessingAnalysis, returning fallback", { error })
      return this.createFallbackPreprocessingResult(sessionData, error)
    }
  }

  private createFallbackPreprocessingResult(
    sessionData: TherapeuticSession,
    error?: unknown
  ): PreprocessingAnalysisResult {
    return {
      biasScore: 0.5,
      linguisticBias: {
        genderBiasScore: 0.5,
        racialBiasScore: 0.5,
        ageBiasScore: 0.5,
        culturalBiasScore: 0.5,
        overallBiasScore: 0.5,
        biasedTerms: [],
        sentimentAnalysis: {
          positive: 0,
          neutral: 1,
          negative: 0,
          overallSentiment: 0,
          emotionalValence: 0,
          subjectivity: 0,
          demographicVariations: {},
        },
      },
      representationAnalysis: {
        representationParity: 0.5,
        minorityGroupScore: 0.5,
        demographicDistribution: {},
        underrepresentedGroups: [],
        overrepresentedGroups: [],
        diversityIndex: 0,
        intersectionalityAnalysis: [],
      },
      dataQualityMetrics: {
        completeness: 1,
        consistency: 1,
        coverage: 1,
        accuracy: 1,
        timeliness: 1,
        validity: 1,
        missingDataByDemographic: {},
      },
      detectedBiases: ['service_unavailable'],
      recommendations: [
        'Python bias detection service is currently unavailable',
        'Results are based on fallback analysis with limited accuracy',
        'Please retry analysis when service is restored',
      ],
      layer: 'preprocessing',
      timestamp: new Date().toISOString(),
      sessionId: (sessionData as TherapeuticSession)?.sessionId || 'unknown',
      fallbackMode: true,
      serviceError: error ? String(error instanceof Error ? error.message : error) : 'Python service unavailable',
    } as PreprocessingAnalysisResult;
  }

  // Metrics-specific public methods
  async sendMetricsBatch(metrics: MetricData[]): Promise<MetricsBatchResponse> {
    try {
      return (await this.makeRequest('/metrics/batch', 'POST', { metrics })) as MetricsBatchResponse;
    } catch (error: unknown) {
      logger.warn('Failed to send metrics batch to Python service', {
        error,
        metricsCount: metrics.length,
      })
      return {
        success: false,
        processed: 0,
        errors: [error instanceof Error ? String(error) : String(error)],
      };
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
