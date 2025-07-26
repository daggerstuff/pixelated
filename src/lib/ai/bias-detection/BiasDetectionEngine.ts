/**
 * Pixelated Empathy Bias Detection Engine
 *
 * This module provides a comprehensive bias detection system for therapeutic training scenarios.
 * It integrates multiple fairness toolkits and provides real-time bias monitoring capabilities.
 *
 * Refactored for better maintainability - core orchestration logic only.
 */

import { validateConfig, createConfigWithEnvOverrides } from './config'
import { PythonBiasDetectionBridge } from './python-bridge'
import { BiasMetricsCollector } from './metrics-collector'
import { BiasAlertSystem } from './alerts-system'
import {
  BiasDetectionError,
  BiasConfigurationError,
  BiasThresholdError,
  BiasSessionValidationError,
  BiasPythonServiceError,
  BiasInitializationError,
  createErrorFromUnknown,
} from './errors'
import { anonymizeSession } from './privacy'
import type {
  BiasDetectionConfig,
  BiasAnalysisResult,
  DemographicGroup,
  BiasReport,
  TherapeuticSession,
  AlertLevel,
  PreprocessingAnalysisResult,
  ModelLevelAnalysisResult,
  InteractiveAnalysisResult,
  EvaluationAnalysisResult,
} from './types'

import { getBiasDetectionLogger } from '@/lib/logging/standardized-logger'
import type { Logger } from '@/lib/logging/standardized-logger'

/**
 * Main Bias Detection Engine
 *
 * Orchestrates multi-layer bias analysis for therapeutic training sessions.
 * Provides real-time monitoring, alerting, and comprehensive reporting.
 *
 * @example
 * ```typescript
 * const engine = new BiasDetectionEngine({
 *   thresholds: { warningLevel: 0.3, highLevel: 0.6, criticalLevel: 0.8 },
 *   hipaaCompliant: true,
 *   auditLogging: true
 * });
 *
 * await engine.initialize();
 * const result = await engine.analyzeSession(sessionData);
 * ```
 */
import { getAuditLogger, BiasDetectionAuditLogger } from './audit'

export class BiasDetectionEngine {
  private config: BiasDetectionConfig
  private pythonBridge: PythonBiasDetectionBridge
  private metricsCollector: BiasMetricsCollector
  private alertSystem: BiasAlertSystem
  private auditLogger: BiasDetectionAuditLogger
  private isInitialized = false
  private monitoringActive = false
  private monitoringInterval: ReturnType<typeof setTimeout> | undefined =
    undefined
  private monitoringCallbacks: Array<(data: unknown) => void> = []
  private logger: Logger

  // Add missing properties for real-time monitoring
  private sessionMetrics: Map<string, unknown> = new Map()
  private performanceMetrics = {
    startTime: new Date(),
    requestCount: 0,
    totalResponseTime: 0,
    errorCount: 0,
  }

  // Additional properties that tests expect
  private auditLogs: Array<{
    timestamp: Date
    sessionId: string
    action: string
    details: unknown
  }> = []

  // Aliases for backward compatibility with tests
  public get isMonitoring(): boolean {
    return this.monitoringActive
  }

  public get pythonService(): PythonBiasDetectionBridge {
    return this.pythonBridge
  }

  constructor(config?: Partial<BiasDetectionConfig>) {
    // First, validate input configuration if provided
    if (config) {
      this.validateInputConfig(config)
    }

    // Merge user config with defaults and environment variables
    this.config = createConfigWithEnvOverrides(config)

    // Configure logger for HIPAA compliance
    const loggerOptions: { prefix: string; redact?: string[] } = {
      prefix: 'BiasDetectionEngine',
    }

    if (this.config.hipaaCompliant) {
      loggerOptions.redact = [
        'participantDemographics',
        'content',
        'traineeId',
        'supervisorId',
        'patientPresentation',
        'therapeuticInterventions',
        'patientResponses',
        'sessionNotes',
        'assessmentResults',
      ]
    }
    this.logger = getBiasDetectionLogger('engine')

    // Validate final configuration
    validateConfig(this.config)

    // Initialize components with validated configuration
    this.pythonBridge = new PythonBiasDetectionBridge(
      this.config.pythonServiceUrl!,
      this.config.pythonServiceTimeout!,
    )
    this.metricsCollector = new BiasMetricsCollector(
      this.config,
      this.pythonBridge,
    )
    this.alertSystem = new BiasAlertSystem(this.config, this.pythonBridge)
    this.auditLogger = getAuditLogger(undefined, this.config.hipaaCompliant)

    // Initialize internal state
    this.sessionMetrics = new Map()
    this.auditLogs = []
    this.monitoringCallbacks = []
    this.performanceMetrics = {
      startTime: new Date(),
      requestCount: 0,
      totalResponseTime: 0,
      errorCount: 0,
    }

    this.logger.info('BiasDetectionEngine created with configuration', {
      thresholds: this.config.thresholds,
      pythonServiceUrl: this.config.pythonServiceUrl,
      hipaaCompliant: this.config.hipaaCompliant,
      auditLogging: this.config.auditLogging,
    })
  }

  /**
   * Validate input configuration for common errors
   */
  private validateInputConfig(config: Partial<BiasDetectionConfig>): void {
    // Check thresholds if they exist
    if (config.thresholds) {
      const { thresholds } = config

      // Check for negative values
      if (
        thresholds.warningLevel !== undefined &&
        thresholds.warningLevel < 0
      ) {
        throw new BiasThresholdError(
          'warningLevel',
          thresholds.warningLevel,
          0,
          1,
        )
      }
      if (thresholds.highLevel !== undefined && thresholds.highLevel < 0) {
        throw new BiasThresholdError('highLevel', thresholds.highLevel, 0, 1)
      }
      if (
        thresholds.criticalLevel !== undefined &&
        thresholds.criticalLevel < 0
      ) {
        throw new BiasThresholdError(
          'criticalLevel',
          thresholds.criticalLevel,
          0,
          1,
        )
      }

      // Ensure thresholds are in ascending order if all are provided
      if (
        thresholds.warningLevel !== undefined &&
        thresholds.highLevel !== undefined &&
        thresholds.criticalLevel !== undefined
      ) {
        if (thresholds.warningLevel >= thresholds.highLevel) {
          throw new BiasConfigurationError(
            `Invalid threshold configuration: warningLevel (${thresholds.warningLevel}) must be less than highLevel (${thresholds.highLevel}). Expected ascending order: warningLevel < highLevel < criticalLevel.`,
          )
        }
        if (thresholds.highLevel >= thresholds.criticalLevel) {
          throw new BiasConfigurationError(
            `Invalid threshold configuration: highLevel (${thresholds.highLevel}) must be less than criticalLevel (${thresholds.criticalLevel}). Expected ascending order: warningLevel < highLevel < criticalLevel.`,
          )
        }
      }
    }

    // Check layer weights if they exist
    if (config.layerWeights) {
      const weights = Object.values(config.layerWeights)
      const sum = weights.reduce((acc, weight) => acc + weight, 0)
      if (Math.abs(sum - 1.0) > 0.001) {
        // Allow small floating point errors
        throw new BiasConfigurationError('Layer weights must sum to 1.0', {
          context: { sum },
        })
      }

      // Check for negative weights
      weights.forEach((weight, index) => {
        if (weight < 0) {
          const layerNames = Object.keys(config.layerWeights!)
          throw new BiasConfigurationError(
            `Invalid layer weight: ${layerNames[index]} weight cannot be negative`,
            {
              context: { layer: layerNames[index], weight },
            },
          )
        }
      })
    }
  }

  /**
   * Check if the engine is initialized
   * @returns boolean indicating if the engine is initialized
   */
  public getInitializationStatus(): boolean {
    return this.isInitialized
  }

  /**
   * Initialize the bias detection engine
   *
   * Sets up all components including Python service connection,
   * metrics collection, and alert system.
   *
   * @throws {Error} If initialization fails
   * @example
   * ```typescript
   * await engine.initialize();
   * ```
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Bias Detection Engine')

      // Initialize Python backend
      await this.pythonBridge.initialize()

      // Initialize metrics collection
      await this.metricsCollector.initialize()

      // Initialize alert system
      await this.alertSystem.initialize()

      // Start periodic cleanup
      this.startPeriodicCleanup()

      this.isInitialized = true
      this.logger.info('Bias Detection Engine initialized successfully')
    } catch (error) {
      this.logger.error('Failed to initialize Bias Detection Engine', { error })
      throw new BiasInitializationError(
        'BiasDetectionEngine',
        error instanceof Error ? error.message : String(error),
        {
          context: {
            originalError:
              error instanceof Error ? error.message : String(error),
          },
        },
      )
    }
  }

  /**
   * Analyze a therapeutic session for bias across all detection layers
   *
   * Performs comprehensive bias analysis using preprocessing, model-level,
   * interactive, and evaluation layers. Returns detailed results with
   * recommendations and alert levels.
   *
   * @param session - The therapeutic session data to analyze
   * @returns Promise resolving to comprehensive bias analysis results
   * @throws {Error} If analysis fails or system health is critical
   *
   * @example
   * ```typescript
   * const result = await engine.analyzeSession({
   *   sessionId: 'session-123',
   *   participantDemographics: { age: '25-35', gender: 'female' },
   *   content: { transcript: '...' }
   * });
   * console.log('Bias Score:', result.overallBiasScore);
   * ```
   */
  async analyzeSession(
    session: TherapeuticSession,
    user: { userId: string; email: string } | unknown = {
      userId: 'unknown',
      email: 'unknown',
    },
    request: { ipAddress: string; userAgent: string },
  ): Promise<BiasAnalysisResult> {
    const startTime = Date.now()

    try {
      // Step 0: Validate system health
      this.validateSystemHealth()

      // Anonymize session data if in HIPAA compliant mode
      const sessionToProcess = this.config.hipaaCompliant
        ? anonymizeSession(session)
        : session

      // Step 1: Validate and prepare session
      const { validatedSession } =
        await this.validateAndPrepareSession(sessionToProcess)

      // Step 2: Run multi-layer analyses
      const layerResults = await this.runLayerAnalyses(validatedSession)

      // Step 3: Calculate analysis results
      const { overallBiasScore, alertLevel, result } =
        this.calculateAnalysisResults(validatedSession, layerResults)

      // Calculate processing time
      const processingTimeMs = Date.now() - startTime

      // Step 4: Process alerts and callbacks with processing time
      await this.processAlertsAndCallbacks(
        result,
        overallBiasScore,
        alertLevel,
        processingTimeMs,
      )

      // Step 5: Record analysis for metrics tracking
      this.recordBiasAnalysis(result)

      // Step 6: Log audit trail
      if (this.config.auditLogging) {
        await this.auditLogger.logBiasAnalysis(
          {
            ...(user as { userId: string; email: string }),
            role: {
              id: 'user',
              name: 'viewer',
              description: 'Standard user',
              level: 1,
            },
            permissions: [],
          },
          session.sessionId,
          session.participantDemographics,
          overallBiasScore,
          alertLevel,
          request,
        )
      }

      return result
    } catch (error) {
      const processingTimeMs = Date.now() - startTime
      this.logger.error('Bias analysis failed', {
        sessionId: session?.sessionId || 'unknown',
        error,
        processingTimeMs,
      })

      if (this.config.auditLogging) {
        await this.auditLogger.logBiasAnalysis(
          {
            ...(user as { userId: string; email: string }),
            role: {
              id: 'user',
              name: 'viewer',
              description: 'Standard user',
              level: 1,
            },
            permissions: [],
          },
          session.sessionId,
          session.participantDemographics,
          -1,
          'error',
          request,
          false,
          error instanceof Error ? error.message : String(error),
        )
      }

      if (error instanceof BiasDetectionError) {
        throw error
      }

      throw createErrorFromUnknown(error, {
        operation: 'analyzeSession',
        additionalContext: {
          sessionId: session?.sessionId,
          processingTimeMs,
        },
      })
    }
  }

  /**
   * Analyze multiple therapeutic sessions in a batch for bias
   *
   * Processes an array of session data in parallel, returning results for each.
   * Individual session failures are captured without stopping the entire batch.
   *
   * @param sessions - An array of therapeutic session data to analyze
   * @returns Promise resolving to an array of results, each indicating success/failure and analysis data or error
   *
   * @example
   * ```typescript
   * const results = await engine.analyzeSessionsBatch([
   *   sessionData1, sessionData2
   * ]);
   * results.forEach(r => {
   *   if (r.status === 'fulfilled') {
   *     console.log('Batch Analysis Success:', r.value.overallBiasScore);
   *   } else {
   *     console.error('Batch Analysis Failed:', r.reason);
   *   }
   * });
   * ```
   */
  async analyzeSessionsBatch(
    sessions: TherapeuticSession[],
    user: { userId: string; email: string } | unknown = {
      userId: 'unknown',
      email: 'unknown',
    },
    request: { ipAddress: string; userAgent: string },
  ): Promise<PromiseSettledResult<BiasAnalysisResult>[]> {
    this.ensureInitialized()
    this.logger.info('Starting batch bias analysis', {
      sessionCount: sessions.length,
    })

    const results = await Promise.allSettled(
      sessions.map((session) =>
        this.analyzeSession(session, user, request).catch((error) => {
          // Catch errors from individual analyzeSession calls to ensure allSettled resolves
          this.logger.error('Individual session analysis failed in batch', {
            sessionId: session?.sessionId,
            error,
          })
          throw error // Re-throw to be caught by allSettled as a rejection
        }),
      ),
    )

    this.logger.info('Batch bias analysis completed', {
      sessionCount: sessions.length,
      fulfilledCount: results.filter((r) => r.status === 'fulfilled').length,
      rejectedCount: results.filter((r) => r.status === 'rejected').length,
    })

    return results
  } // Add semicolon here
  /**
   * Generate comprehensive bias report
   */
  async generateBiasReport(
    sessions: TherapeuticSession[],
    timeRange: { start: Date; end: Date },
    options?: {
      format?: 'json' | 'csv' | 'pdf'
      includeRawData?: boolean
      includeTrends?: boolean
      includeRecommendations?: boolean
    },
  ): Promise<BiasReport> {
    this.ensureInitialized()

    const startTime = Date.now()
    const {
      format = 'json',
      includeRawData = false,
      includeTrends = true,
      includeRecommendations = true,
    } = options || {}

    try {
      this.logger.info('Generating comprehensive bias report', {
        sessionCount: sessions.length,
        timeRange,
        format,
        includeRawData,
      })

      // Call Python backend for advanced statistical analysis
      const pythonAnalysis =
        await this.pythonBridge.generateComprehensiveReport(
          sessions,
          {
            start: timeRange.start.toISOString(),
            end: timeRange.end.toISOString(),
          },
          {
            format,
            includeRawData,
            includeTrends,
            includeRecommendations,
          },
        )

      // Record report generation metrics
      await this.metricsCollector.recordReportGeneration({
        metadata: {
          executionTimeMs: Date.now() - startTime,
        },
      })

      this.logger.info('Bias report generated successfully', {
        sessionCount: sessions.length,
        executionTimeMs: Date.now() - startTime,
        format,
      })

      return pythonAnalysis
    } catch (error) {
      this.logger.error('Failed to generate bias report', {
        error,
        sessionCount: sessions.length,
        timeRange,
        format,
      })

      if (error instanceof BiasDetectionError) {
        throw error
      }

      throw createErrorFromUnknown(error, {
        operation: 'generateBiasReport',
        additionalContext: {
          sessionCount: sessions.length,
          timeRange,
          format,
        },
      })
    }
  }

  /**
   * Get real-time bias monitoring dashboard data
   */
  async getDashboardData(options?: {
    timeRange?: string
    includeDetails?: boolean
  }): Promise<unknown> {
    this.ensureInitialized()
    // Convert camelCase options to snake_case for DashboardOptions
    const dashboardOptions = options
      ? {
          ...(options.timeRange && { time_range: options.timeRange }),
          ...(options.includeDetails !== undefined && { include_details: options.includeDetails }),
        }
      : undefined
    return await this.metricsCollector.getDashboardData(dashboardOptions)
  }

  /**
   * Get comprehensive metrics for analytics dashboard
   */
  async getMetrics(options?: {
    timeRange?: { start: Date; end: Date }
    includeDetails?: boolean
    includePerformance?: boolean
    demographic?: DemographicGroup
    aggregationType?: 'hourly' | 'daily' | 'weekly' | 'monthly'
  }): Promise<unknown> {
    this.ensureInitialized()

    // Convert camelCase options to snake_case for DashboardOptions
    const dashboardOptions = options
      ? {
          ...(options.timeRange && {
            time_range:
              typeof options.timeRange === 'string'
                ? options.timeRange
                : `${options.timeRange.start.toISOString()}_${options.timeRange.end.toISOString()}`,
          }),
          ...(options.includeDetails !== undefined && { include_details: options.includeDetails }),
          ...(options.aggregationType && { aggregation_type: options.aggregationType }),
          ...(options.demographic && { demographic: options.demographic }),
        }
      : undefined

    try {
      this.logger.info('Retrieving comprehensive metrics', { options })

      const [summaryData, demographicData, performanceData] = await Promise.all(
        [
          this.metricsCollector.getSummaryMetrics(dashboardOptions),
          this.metricsCollector.getDemographicMetrics(dashboardOptions),
          options?.includePerformance
            ? this.metricsCollector.getPerformanceMetrics()
            : null,
        ],
      )

      return {
        summary: summaryData || {
          totalAnalyses: 0,
          averageBiasScore: 0,
          alertDistribution: {},
          trendsOverTime: [],
        },
        demographics: demographicData || {},
        performance: performanceData || {
          averageResponseTime: 0,
          successRate: 1.0,
          errorRate: 0.0,
          systemHealth: 'unknown',
        },
        recommendations: this.generateMetricsRecommendations(
          summaryData || {},
          demographicData || {},
        ),
      }
    } catch (error) {
      this.logger.error('Failed to retrieve metrics', { error })
      if (error instanceof BiasDetectionError) {
        throw error
      }
      throw createErrorFromUnknown(error, {
        operation: 'getMetrics',
        additionalContext: { options },
      })
    }
  }

  /**
   * Get analysis results for a specific session
   */
  async getSessionAnalysis(
    sessionId: string,
  ): Promise<BiasAnalysisResult | null> {
    try {
      this.ensureInitialized()
      const result = await this.metricsCollector.getSessionAnalysis(sessionId)
      // Defensive: ensure result is null or BiasAnalysisResult
      if (result === null) {
        return null
      }
      return result as BiasAnalysisResult
    } catch (error) {
      this.logger.error('Failed to retrieve session analysis', {
        error,
        sessionId,
      })
      if (error instanceof BiasDetectionError) {
        throw error
      }
      throw createErrorFromUnknown(error, {
        operation: 'getSessionAnalysis',
        additionalContext: { sessionId },
      })
    }
  }

  /**
   * Update bias detection thresholds
   */
  async updateThresholds(
    newThresholds: Partial<BiasDetectionConfig['thresholds']>,
    options?: {
      validateOnly?: boolean
      notifyStakeholders?: boolean
      rollbackOnFailure?: boolean
    },
  ): Promise<{
    success: boolean
    previousThresholds?: BiasDetectionConfig['thresholds']
    validationErrors?: string[]
    affectedSessions?: number
  }> {
    this.ensureInitialized()

    const { validateOnly = false, notifyStakeholders = true } = options || {}

    try {
      this.logger.info('Updating bias detection thresholds', {
        newThresholds,
        validateOnly,
      })

      // Store previous thresholds for potential rollback
      const previousThresholds = { ...this.config.thresholds }

      // Validate new thresholds
      const mergedThresholds = { ...this.config.thresholds, ...newThresholds }
      const testConfig = { thresholds: mergedThresholds }

      try {
        validateConfig(testConfig)
      } catch (error) {
        if (error instanceof BiasDetectionError) {
          return {
            success: false,
            previousThresholds,
            validationErrors: [error.message],
            affectedSessions: 0,
          }
        }
        const validationError = createErrorFromUnknown(error, {
          operation: 'validateThresholds',
        })
        return {
          success: false,
          previousThresholds,
          validationErrors: [validationError.message],
          affectedSessions: 0,
        }
      }

      if (validateOnly) {
        return {
          success: true,
          previousThresholds,
          validationErrors: [],
          affectedSessions: 0,
        }
      }

      // Apply new thresholds
      this.config.thresholds = mergedThresholds

      // Update Python service configuration
      await this.pythonBridge.updateConfiguration({
        thresholds: this.config.thresholds,
      })

      // Calculate impact on existing sessions
      const affectedSessions = await this.calculateThresholdImpact(
        previousThresholds,
        mergedThresholds,
      )

      // Send notifications if enabled
      if (notifyStakeholders) {
        await this.notifyThresholdUpdate(
          previousThresholds,
          mergedThresholds,
          affectedSessions,
        )
      }

      return {
        success: true,
        previousThresholds,
        validationErrors: [],
        affectedSessions,
      }
    } catch (error) {
      this.logger.error('Threshold update process failed', {
        error,
        newThresholds,
      })
      if (error instanceof BiasDetectionError) {
        throw error
      }
      throw createErrorFromUnknown(error, {
        operation: 'updateThresholds',
        additionalContext: { newThresholds },
      })
    }
  }

  /**
   * Get bias explanation for a specific detection
   */
  async explainBiasDetection(
    analysisResult: BiasAnalysisResult,
    demographicGroup?: DemographicGroup,
    includeCounterfactuals: boolean = true,
  ): Promise<{
    summary: string
    detailedExplanation: string
    contributingFactors: Array<{
      factor: string
      impact: 'high' | 'medium' | 'low'
      description: string
    }>
    recommendations: string[]
    counterfactualAnalysis?: Array<{
      scenario: string
      expectedOutcome: string
      biasReduction: number
    }>
  }> {
    this.ensureInitialized()

    try {
      // Call Python backend for detailed AI explanation
      const pythonExplanation = await this.pythonBridge.explainBiasDetection(
        analysisResult,
        demographicGroup,
        includeCounterfactuals,
      )

      // Generate contributing factors analysis
      const contributingFactors =
        this.analyzeContributingFactors(analysisResult)

      // Generate targeted recommendations
      const recommendations = this.generateTargetedRecommendations(
        analysisResult,
        demographicGroup,
      )

      return {
        summary: this.generateExplanationSummary(
          analysisResult,
          demographicGroup,
        ),
        detailedExplanation:
          (pythonExplanation as string) ||
          this.generateDetailedExplanation(analysisResult),
        contributingFactors,
        recommendations,
      }
    } catch (error) {
      this.logger.error('Failed to generate bias explanation', {
        sessionId: analysisResult.sessionId,
        error,
      })
      if (error instanceof BiasDetectionError) {
        throw error
      }
      throw createErrorFromUnknown(error, {
        operation: 'explainBiasDetection',
        additionalContext: {
          sessionId: analysisResult.sessionId,
          demographicGroup,
          includeCounterfactuals,
        },
      })
    }
  }

  /**
   * Start real-time monitoring
   */
  async startMonitoring(
    callback: (data: unknown) => void,
    intervalMs: number = 30000,
  ): Promise<void> {
    this.ensureInitialized()

    if (this.monitoringActive) {
      this.logger.warn('Monitoring already active')
      return
    }

    try {
      this.logger.info('Starting bias detection monitoring', { intervalMs })

      this.monitoringCallbacks.push(callback)
      this.alertSystem.addMonitoringCallback(callback)
      this.monitoringActive = true

      // Start monitoring interval
      this.monitoringInterval = setInterval(async () => {
        try {
          const monitoringData = await this.collectMonitoringData()
          this.monitoringCallbacks.forEach((cb) => {
            try {
              cb(monitoringData)
            } catch (error) {
              this.logger.error('Monitoring callback error', { error })
            }
          })
          await this.alertSystem.checkSystemAlerts()
        } catch (error) {
          this.logger.error('Monitoring data collection error', { error })
        }
      }, intervalMs)

      // Send initial data
      const initialData = await this.collectMonitoringData()
      callback(initialData)

      this.logger.info('Bias detection monitoring started successfully')
    } catch (error) {
      this.monitoringActive = false
      this.logger.error('Failed to start monitoring', { error })
      if (error instanceof BiasDetectionError) {
        throw error
      }
      throw createErrorFromUnknown(error, {
        operation: 'startMonitoring',
        additionalContext: { intervalMs },
      })
    }
  }

  /**
   * Stop real-time monitoring
   */
  stopMonitoring(): void {
    if (!this.monitoringActive) {
      this.logger.warn('Monitoring not currently active')
      return
    }

    try {
      this.logger.info('Stopping bias detection monitoring')

      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval)
        this.monitoringInterval = undefined
      }

      this.monitoringActive = false
      this.monitoringCallbacks.forEach((callback) => {
        this.alertSystem.removeMonitoringCallback(callback)
      })
      this.monitoringCallbacks = []

      this.logger.info('Bias detection monitoring stopped successfully')
    } catch (error) {
      this.logger.error('Error stopping monitoring', { error })
    }
  }

  /**
   * Dispose of all resources
   */
  async dispose(): Promise<{
    success: boolean
    componentsDisposed: string[]
    errors: Array<{ component: string; error: string }>
    disposalTimeMs: number
  }> {
    const startTime = Date.now()
    const componentsDisposed: string[] = []
    const errors: Array<{ component: string; error: string }> = []

    try {
      // Stop monitoring first
      if (this.monitoringActive) {
        this.stopMonitoring()
        componentsDisposed.push('monitoring')
      }

      // Dispose of components
      await this.alertSystem.dispose()
      componentsDisposed.push('alert_system')

      await this.metricsCollector.dispose()
      componentsDisposed.push('metrics_collector')

      await this.pythonBridge.dispose()
      componentsDisposed.push('python_bridge')

      // Final cleanup
      this.performFinalCleanup()
      componentsDisposed.push('final_cleanup')

      const disposalTimeMs = Date.now() - startTime
      this.logger.info('Bias Detection Engine disposed successfully', {
        componentsDisposed: componentsDisposed.length,
        disposalTimeMs,
      })

      return {
        success: true,
        componentsDisposed,
        errors,
        disposalTimeMs,
      }
    } catch (error) {
      const disposalTimeMs = Date.now() - startTime
      const systemError = createErrorFromUnknown(error, {
        operation: 'dispose',
      })
      errors.push({
        component: 'disposal_process',
        error: systemError.message,
      })

      return {
        success: false,
        componentsDisposed,
        errors,
        disposalTimeMs,
      }
    }
  }

  // Helper methods
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new BiasInitializationError(
        'BiasDetectionEngine',
        'Engine not initialized. Call initialize() first.',
      )
    }
  }

  private async validateAndPrepareSession(
    session: TherapeuticSession,
  ): Promise<{
    validatedSession: TherapeuticSession
    auditLogData: unknown
  }> {
    this.validateSessionData(session)
    this.logger.info('Starting bias analysis', { sessionId: session.sessionId })

    const auditLogData = {
      demographics: session.participantDemographics,
      timestamp: new Date(),
    }
    this.createAuditLogEntry(
      session.sessionId,
      'analysis_started',
      auditLogData,
    )

    return { validatedSession: session, auditLogData }
  }

  private validateSessionData(session: unknown): void {
    if (!session) {
      throw new BiasSessionValidationError(
        'unknown',
        'session',
        'Session data is required',
      )
    }

    const sessionObj = session as { sessionId?: unknown }
    if (!sessionObj.sessionId && sessionObj.sessionId !== '') {
      throw new BiasSessionValidationError(
        'unknown',
        'sessionId',
        'Session ID is required',
      )
    }
    if (
      typeof sessionObj.sessionId === 'string' &&
      sessionObj.sessionId.trim() === ''
    ) {
      throw new BiasSessionValidationError(
        sessionObj.sessionId,
        'sessionId',
        'Session ID cannot be empty',
      )
    }
    if (!sessionObj.sessionId) {
      throw new BiasSessionValidationError(
        'unknown',
        'sessionId',
        'Session ID is required',
      )
    }
  }

  private async runLayerAnalyses(session: TherapeuticSession): Promise<{
    preprocessing: unknown
    modelLevel: unknown
    interactive: unknown
    evaluation: unknown
  }> {
    // Run multi-layer analysis with error handling
    const layerResults = await Promise.allSettled([
      this.pythonBridge.runPreprocessingAnalysis(session),
      this.pythonBridge.runModelLevelAnalysis(session),
      this.pythonBridge.runInteractiveAnalysis(session),
      this.pythonBridge.runEvaluationAnalysis(session),
    ])

    // Process results and handle failures
    const preprocessing = this.processLayerResult(
      layerResults[0],
      'preprocessing',
    )
    const modelLevel = this.processLayerResult(layerResults[1], 'modelLevel')
    const interactive = this.processLayerResult(layerResults[2], 'interactive')
    const evaluation = this.processLayerResult(layerResults[3], 'evaluation')

    return { preprocessing, modelLevel, interactive, evaluation }
  }

  private processLayerResult(
    result: PromiseSettledResult<unknown>,
    layerName: string,
  ): unknown {
    if (result.status === 'fulfilled') {
      return result.value
    } else {
      this.logger.warn(`${layerName} analysis failed, using fallback`, {
        error: result.reason?.message,
      })
      const error = result.reason
      if (error instanceof BiasPythonServiceError) {
        throw error
      }
      throw new BiasPythonServiceError(`Error in ${layerName} analysis`, {
        context: {
          layerName,
          originalError: error instanceof Error ? error.message : String(error),
        },
      })
    }
  }

  private calculateAnalysisResults(
    session: TherapeuticSession,
    layerResults: unknown,
  ): {
    overallBiasScore: number
    alertLevel: AlertLevel
    confidence: number
    recommendations: string[]
    result: BiasAnalysisResult
  } {
    const results = layerResults as {
      preprocessing: {
        biasScore: number
        confidence?: number
        recommendations?: string[]
        error?: string
      }
      modelLevel: {
        biasScore: number
        confidence?: number
        recommendations?: string[]
        error?: string
      }
      interactive: {
        biasScore: number
        confidence?: number
        recommendations?: string[]
        error?: string
      }
      evaluation: {
        biasScore: number
        confidence?: number
        recommendations?: string[]
        error?: string
      }
    }
    const { preprocessing, modelLevel, interactive, evaluation } = results

    // Calculate overall bias score (weighted average)
    const weights = this.config.layerWeights
    const overallBiasScore =
      preprocessing.biasScore * weights.preprocessing +
      modelLevel.biasScore * weights.modelLevel +
      interactive.biasScore * weights.interactive +
      evaluation.biasScore * weights.evaluation

    // Determine alert level
    let alertLevel: AlertLevel
    if (overallBiasScore >= this.config.thresholds.criticalLevel) {
      alertLevel = 'critical'
    } else if (overallBiasScore >= this.config.thresholds.highLevel) {
      alertLevel = 'high'
    } else if (overallBiasScore >= this.config.thresholds.warningLevel) {
      alertLevel = 'medium'
    } else {
      alertLevel = 'low'
    }

    // Calculate confidence score
    const confidence = Math.min(
      preprocessing.confidence || 0.5,
      modelLevel.confidence || 0.5,
      interactive.confidence || 0.5,
      evaluation.confidence || 0.5,
    )

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      [preprocessing, modelLevel, interactive, evaluation],
      overallBiasScore,
      alertLevel,
    )

    // Construct result
    const result: BiasAnalysisResult = {
      sessionId: session.sessionId,
      timestamp: new Date(),
      overallBiasScore,
      alertLevel,
      confidence,
      layerResults: {
        preprocessing: preprocessing as PreprocessingAnalysisResult,
        modelLevel: modelLevel as ModelLevelAnalysisResult,
        interactive: interactive as InteractiveAnalysisResult,
        evaluation: evaluation as EvaluationAnalysisResult,
      },
      demographics: session.participantDemographics,
      recommendations,
    }

    return { overallBiasScore, alertLevel, confidence, recommendations, result }
  }

  private async processAlertsAndCallbacks(
    result: BiasAnalysisResult,
    overallBiasScore: number,
    alertLevel: AlertLevel,
    processingTimeMs?: number,
  ): Promise<void> {
    this.logger.info('Bias analysis completed', {
      sessionId: result.sessionId,
      overallBiasScore,
      alertLevel,
      confidence: result.confidence,
      processingTimeMs: processingTimeMs || 0,
    })

    // Store analysis result
    await this.metricsCollector.storeAnalysisResult(result, processingTimeMs)

    // Check for high bias alerts
    if (alertLevel === 'high' || alertLevel === 'critical') {
      await this.alertSystem.processAlert({
        sessionId: result.sessionId,
        level: alertLevel,
        biasScore: overallBiasScore,
        analysisResult: result,
      })

      // Trigger monitoring callbacks for alerts
      this.triggerMonitoringCallbacksForAlert(result)
    }
  }

  private triggerMonitoringCallbacksForAlert(result: BiasAnalysisResult): void {
    if (this.monitoringCallbacks.length === 0) {
      return
    }

    const alertData = {
      level: result.alertLevel,
      sessionId: result.sessionId,
      timestamp: result.timestamp,
      biasScore: result.overallBiasScore,
      confidence: result.confidence,
      recommendations: result.recommendations,
    }

    this.monitoringCallbacks.forEach((callback) => {
      try {
        callback(alertData)
      } catch (error) {
        this.logger.error('Error in monitoring callback for alert', {
          error,
          sessionId: result.sessionId,
        })
      }
    })
  }

  private createAuditLogEntry(
    sessionId: string,
    action: string,
    details: unknown,
  ): void {
    if (this.config.auditLogging) {
      this.auditLogs.push({
        timestamp: new Date(),
        sessionId,
        action,
        details,
      })
    }
  }

  private recordBiasAnalysis(result: unknown): void {
    try {
      const timestamp = new Date()
      const analysisResult = result as {
        sessionId?: string
        overallBiasScore?: number
        alertLevel?: string
        confidence?: number
      }

      // Update session metrics
      if (analysisResult.sessionId) {
        this.sessionMetrics.set(analysisResult.sessionId, {
          timestamp,
          biasScore: analysisResult.overallBiasScore,
          alertLevel: analysisResult.alertLevel,
          confidence: analysisResult.confidence,
        })
      }

      // Update performance counters
      this.performanceMetrics.requestCount++

      this.logger.debug('Recorded bias analysis for metrics', {
        sessionId: analysisResult.sessionId,
        biasScore: analysisResult.overallBiasScore,
        alertLevel: analysisResult.alertLevel,
      })
    } catch (error) {
      const sessionId = (result as { sessionId?: string })?.sessionId
      this.logger.error('Failed to record bias analysis metrics', {
        error,
        sessionId,
      })
    }
  }

  private async collectMonitoringData(): Promise<unknown> {
    const [activeAnalyses, recentAlerts, performanceMetrics] =
      await Promise.all([
        this.metricsCollector.getActiveAnalysesCount(),
        this.alertSystem.getRecentAlerts(),
        this.metricsCollector.getCurrentPerformanceMetrics(),
      ])

    const systemHealth = this.assessSystemHealth(performanceMetrics)

    return {
      timestamp: new Date(),
      activeAnalyses,
      recentAlerts,
      systemHealth,
      performanceMetrics,
    }
  }

  private assessSystemHealth(metrics: unknown): string {
    if (!metrics) {
      return 'unknown'
    }

    const metricsData = metrics as {
      errorRate?: number
      averageResponseTime?: number
      memoryUsage?: number
    }
    const { errorRate, averageResponseTime, memoryUsage } = metricsData

    if (
      (errorRate && errorRate > 0.1) ||
      (averageResponseTime && averageResponseTime > 5000) ||
      (memoryUsage && memoryUsage > 0.9)
    ) {
      return 'critical'
    } else if (
      (errorRate && errorRate > 0.05) ||
      (averageResponseTime && averageResponseTime > 2000) ||
      (memoryUsage && memoryUsage > 0.8)
    ) {
      return 'warning'
    }
    return 'healthy'
  }

  private generateRecommendations(
    layerResults: unknown[],
    _overallBiasScore: number,
    _alertLevel: AlertLevel,
  ): string[] {
    const recommendations: string[] = []

    // Check for fallback mode
    const hasFallbackResults = layerResults.some(
      (result) => (result as { fallback?: boolean }).fallback,
    )
    if (hasFallbackResults) {
      recommendations.push('Limited analysis - some toolkits unavailable')
    }

    layerResults.forEach((result) => {
      const layerResult = result as {
        biasScore?: number
        recommendations?: string[]
      }
      if (
        layerResult.biasScore &&
        layerResult.biasScore > this.config.thresholds.warningLevel
      ) {
        recommendations.push(...(layerResult.recommendations || []))
      }
    })

    return Array.from(new Set(recommendations))
  }

  private generateMetricsRecommendations(
    summaryData: unknown,
    _demographicData: unknown,
  ): string[] {
    const recommendations: string[] = []
    const summary = summaryData as {
      averageBiasScore?: number
      alertDistribution?: { critical?: number }
    }

    if (
      summary.averageBiasScore &&
      summary.averageBiasScore > this.config.thresholds.warningLevel
    ) {
      recommendations.push(
        'Consider reviewing training scenarios to reduce bias patterns',
      )
    }

    if (
      summary.alertDistribution?.critical &&
      summary.alertDistribution.critical > 0
    ) {
      recommendations.push(
        'Critical bias alerts detected - immediate intervention recommended',
      )
    }

    return recommendations
  }

  private analyzeContributingFactors(
    analysisResult: BiasAnalysisResult,
  ): Array<{
    factor: string
    impact: 'high' | 'medium' | 'low'
    description: string
  }> {
    const factors: Array<{
      factor: string
      impact: 'high' | 'medium' | 'low'
      description: string
    }> = []

    // Analyze layer-specific contributions
    if (
      analysisResult.layerResults.preprocessing?.biasScore >
      this.config.thresholds.warningLevel
    ) {
      factors.push({
        factor: 'Data Preprocessing',
        impact: (analysisResult.layerResults.preprocessing.biasScore >
        this.config.thresholds.highLevel
          ? 'high'
          : 'medium') as 'high' | 'medium' | 'low',
        description:
          'Bias detected in data preprocessing stage, indicating potential issues with data representation or feature extraction',
      })
    }

    return factors
  }

  private generateTargetedRecommendations(
    analysisResult: BiasAnalysisResult,
    demographicGroup?: DemographicGroup,
  ): string[] {
    const recommendations = [...(analysisResult.recommendations || [])]

    if (
      analysisResult.overallBiasScore > this.config.thresholds.criticalLevel
    ) {
      recommendations.push(
        'URGENT: Suspend AI system for immediate bias remediation',
      )
    }

    if (demographicGroup) {
      recommendations.push(
        `Review training data representation for ${demographicGroup.type}: ${demographicGroup.value}`,
      )
    }

    return Array.from(new Set(recommendations))
  }

  private generateExplanationSummary(
    analysisResult: BiasAnalysisResult,
    demographicGroup?: DemographicGroup,
  ): string {
    const score = analysisResult.overallBiasScore
    const level = analysisResult.alertLevel
    const demographic = demographicGroup
      ? `for ${demographicGroup.type} group "${demographicGroup.value}"`
      : ''

    return (
      `Bias analysis ${demographic} detected a ${level} level bias with score ${score.toFixed(3)}. ` +
      `The analysis indicates ${this.getBiasLevelDescription(score)} bias patterns in the therapeutic AI system.`
    )
  }

  private generateDetailedExplanation(
    analysisResult: BiasAnalysisResult,
  ): string {
    const layerAnalysis = Object.entries(analysisResult.layerResults)
      .map(
        ([layer, result]) => `${layer}: ${(result?.biasScore || 0).toFixed(3)}`,
      )
      .join(', ')

    return (
      `Detailed analysis across detection layers revealed: ${layerAnalysis}. ` +
      `The weighted aggregate score of ${analysisResult.overallBiasScore.toFixed(3)} was calculated using ` +
      `configured layer weights. Confidence level: ${(analysisResult.confidence * 100).toFixed(1)}%.`
    )
  }

  private getBiasLevelDescription(score: number): string {
    if (score >= this.config.thresholds.criticalLevel) {
      return 'critical'
    }
    if (score >= this.config.thresholds.highLevel) {
      return 'high'
    }
    if (score >= this.config.thresholds.warningLevel) {
      return 'moderate'
    }
    return 'minimal'
  }

  private async calculateThresholdImpact(
    oldThresholds: BiasDetectionConfig['thresholds'],
    newThresholds: Partial<BiasDetectionConfig['thresholds']>,
  ): Promise<number> {
    try {
      const recentSessions = await this.metricsCollector.getRecentSessionCount()
      const avgChange =
        (Math.abs(newThresholds.warningLevel! - oldThresholds.warningLevel) +
          Math.abs(newThresholds.highLevel! - oldThresholds.highLevel) +
          Math.abs(
            newThresholds.criticalLevel! - oldThresholds.criticalLevel,
          )) /
        3

      const impactRate = Math.min(1.0, avgChange * 10)
      return Math.round(recentSessions * impactRate)
    } catch (error) {
      this.logger.warn('Failed to calculate threshold impact', { error })
      return 0
    }
  }

  private async notifyThresholdUpdate(
    oldThresholds: BiasDetectionConfig['thresholds'],
    newThresholds: BiasDetectionConfig['thresholds'],
    affectedSessions: number,
  ): Promise<void> {
    try {
      const notification = {
        type: 'threshold_update',
        timestamp: new Date(),
        changes: {
          warning: {
            old: oldThresholds.warningLevel,
            new: newThresholds.warningLevel,
          },
          high: { old: oldThresholds.highLevel, new: newThresholds.highLevel },
          critical: {
            old: oldThresholds.criticalLevel,
            new: newThresholds.criticalLevel,
          },
        },
        impact: { affectedSessions },
      }

      await this.alertSystem.sendSystemNotification(
        `Bias detection thresholds updated: ${JSON.stringify(notification.changes)}`,
        ['system-admin', 'bias-detection-team'],
      )
    } catch (error) {
      this.logger.warn('Failed to send threshold update notification', {
        error,
      })
    }
  }

  private validateSystemHealth(): void {
    const errorRate =
      this.performanceMetrics.errorCount /
      Math.max(1, this.performanceMetrics.requestCount)

    if (errorRate > 0.5) {
      this.logger.warn('High error rate detected', {
        errorRate,
        totalRequests: this.performanceMetrics.requestCount,
        totalErrors: this.performanceMetrics.errorCount,
      })
    }
  }

  private performFinalCleanup(): void {
    try {
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval)
        this.monitoringInterval = undefined
      }

      this.isInitialized = false
      this.monitoringActive = false
      this.monitoringCallbacks = []

      this.logger.debug('Final cleanup completed')
    } catch (error) {
      this.logger.warn('Error during final cleanup', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  private startPeriodicCleanup(): void {
    setInterval(
      () => {
        this.cleanupCompletedSessions()
      },
      60 * 60 * 1000,
    ) // Clean up every hour

    this.logger.debug('Periodic cleanup started')
  }

  private cleanupCompletedSessions(): void {
    try {
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
      let cleanedCount = 0

      for (const [sessionId, sessionData] of Array.from(
        this.sessionMetrics.entries(),
      )) {
        const session = sessionData as { timestamp?: Date }
        if (session.timestamp && session.timestamp < cutoffTime) {
          this.sessionMetrics.delete(sessionId)
          cleanedCount++
        }
      }

      if (cleanedCount > 0) {
        this.logger.debug('Cleaned up completed sessions', {
          cleanedCount,
          remainingSessions: this.sessionMetrics.size,
        })
      }
    } catch (error) {
      this.logger.error('Failed to clean up completed sessions', { error })
    }
  }
}
