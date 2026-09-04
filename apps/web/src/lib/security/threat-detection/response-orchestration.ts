/**
 * Automated Response Orchestration Framework
 * Coordinates security responses across multiple systems based on threat intelligence
 */

import { EventEmitter } from 'events'
import * as crypto from 'node:crypto'
import Redis from 'ioredis'
import { MongoClient } from 'mongodb'

import { createBuildSafeLogger } from '../logging/build-safe-logger'
import type {
  ThreatResponse,
  ResponseAction,
  OrchestrationConfig,
  ThreatIntelligenceService,
  RateLimitingService,
  ResponseOrchestrationService,
} from './response-orchestration.types'
import {
  ConcurrentResponseExecutor,
  MLDecisionEngine,
  MultiSystemIntegrationManager,
  MultiChannelNotificationManager,
} from './response-orchestration.executors'
import type {
  ResponseExecutor,
  DecisionEngine,
  IntegrationManager,
  NotificationManager,
} from './response-orchestration.executors'

const logger = createBuildSafeLogger('response-orchestration')

export class AdvancedResponseOrchestrator
  extends EventEmitter
  implements ResponseOrchestrationService
{
  private redis!: Redis
  private mongoClient!: MongoClient
  private responseExecutor!: ResponseExecutor
  private decisionEngine!: DecisionEngine
  private integrationManager!: IntegrationManager
  private notificationManager!: NotificationManager

  constructor(
    private readonly config: OrchestrationConfig,
    private readonly threatIntelligenceService: ThreatIntelligenceService,
    private readonly rateLimitingService: RateLimitingService,
  ) {
    super()
    void this.initializeServices()
  }

  private async initializeServices(): Promise<void> {
    this.redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379')
    this.mongoClient = new MongoClient(
      process.env['MONGODB_URI'] ??
        'mongodb://localhost:27017/threat_detection',
    )

    this.responseExecutor = new ConcurrentResponseExecutor(this.config)
    this.decisionEngine = new MLDecisionEngine()
    this.integrationManager = new MultiSystemIntegrationManager(
      this.config.integrationEndpoints,
    )
    this.notificationManager = new MultiChannelNotificationManager(
      this.config.notificationChannels,
    )

    await this.mongoClient.connect()
    this.emit('orchestrator_initialized')
  }

  async orchestrateResponse(
    threatId: string,
    threatData: unknown,
  ): Promise<ThreatResponse> {
    try {
      // Validate threat data
      if (!threatId || !threatData) {
        throw new Error('Invalid threat data provided')
      }

      // Analyze threat using ML decision engine
      const threatAnalysis = await this.analyzeThreat(threatData)

      // Determine appropriate response strategy
      const responseStrategy =
        await this.determineResponseStrategy(threatAnalysis)

      // Generate coordinated response actions
      const actions = await this.generateResponseActions(
        threatAnalysis,
        responseStrategy,
      )

      // Create threat response object
      const response: ThreatResponse = {
        responseId: this.generateResponseId(),
        threatId,
        responseType: responseStrategy.primaryType,
        severity: threatAnalysis.severity,
        actions,
        confidence: threatAnalysis.confidence,
        estimatedImpact: threatAnalysis.estimatedImpact,
        executionTime: new Date(),
        status: 'pending',
      }

      // Store response in database
      await this.storeThreatResponse(response)

      // Execute response orchestration
      await this.executeResponseOrchestration(response)

      this.emit('response_orchestrated', {
        responseId: response.responseId,
        threatId,
      })
      return response
    } catch (error: unknown) {
      this.emit('orchestration_error', { threatId, error })
      throw error
    }
  }

  async executeResponse(response: ThreatResponse): Promise<boolean> {
    try {
      this.emit('response_execution_started', {
        responseId: response.responseId,
      })

      // Update response status
      response.status = 'executing'
      await this.updateThreatResponse(response)

      // Execute actions concurrently with proper coordination
      const executionResults = await this.responseExecutor.executeActions(
        response.actions,
      )

      // Validate execution results
      const validationResults =
        await this.validateExecutionResults(executionResults)

      // Update response completion
      response.status = validationResults.success ? 'completed' : 'failed'
      response.completedTime = new Date()
      await this.updateThreatResponse(response)

      // Trigger notifications
      await this.notificationManager.sendNotifications(
        response,
        executionResults,
      )

      // Log response execution
      await this.logResponseExecution(response, executionResults)

      this.emit('response_execution_completed', {
        responseId: response.responseId,
        success: validationResults.success,
      })

      return validationResults.success
    } catch (error: unknown) {
      response.status = 'failed'
      await this.updateThreatResponse(response)
      this.emit('response_execution_error', {
        responseId: response.responseId,
        error,
      })
      return false
    }
  }

  async rollbackResponse(responseId: string): Promise<boolean> {
    try {
      // Retrieve original response
      const response = await this.getThreatResponse(responseId)
      if (!response) {
        throw new Error(`Response ${responseId} not found`)
      }

      this.emit('response_rollback_started', { responseId })

      // Execute rollback actions in reverse order
      const rollbackResults = await this.responseExecutor.rollbackActions(
        response.actions,
      )

      // Validate rollback
      const rollbackSuccess = rollbackResults.every((result) => result.success)

      if (rollbackSuccess) {
        response.status = 'rolled_back' // Mark as rolled_back after successful rollback
        await this.updateThreatResponse(response)
      }

      this.emit('response_rollback_completed', {
        responseId,
        success: rollbackSuccess,
      })

      return rollbackSuccess
    } catch (error: unknown) {
      this.emit('response_rollback_error', { responseId, error })
      return false
    }
  }

  async validateAction(action: ResponseAction): Promise<boolean> {
    try {
      // Validate action parameters
      const parameterValidation = this.validateActionParameters(action)
      if (!parameterValidation.valid) {
        return false
      }

      // Check action dependencies
      const dependencyValidation = await this.validateActionDependencies(action)
      if (!dependencyValidation.valid) {
        return false
      }

      // Validate against business rules
      const businessRuleValidation = await this.validateBusinessRules(action)
      if (!businessRuleValidation.valid) {
        return false
      }

      return true
    } catch (error: unknown) {
      logger.error('Action validation error:', error)
      return false
    }
  }

  async escalateThreat(
    threatId: string,
    reason: string,
  ): Promise<ThreatResponse> {
    try {
      // Retrieve threat data
      const threatData =
        await this.threatIntelligenceService.getThreat(threatId)
      if (!threatData) {
        throw new Error(`Threat ${threatId} not found`)
      }

      // Generate escalated response (escalation is handled in orchestration)
      const escalatedResponse = await this.orchestrateResponse(
        threatId,
        threatData,
      )

      this.emit('threat_escalated', {
        threatId,
        reason,
        responseId: escalatedResponse.responseId,
      })
      return escalatedResponse
    } catch (error: unknown) {
      this.emit('threat_escalation_error', { threatId, reason, error })
      throw error
    }
  }

  async integrateWithSystems(response: ThreatResponse): Promise<void> {
    try {
      // Integrate with rate limiting service
      if (this.rateLimitingService && response.responseType === 'rate_limit') {
        await this.integrateWithRateLimiting(response)
      }

      // Integrate with monitoring systems
      await this.integrationManager.integrateWithMonitoring(response)

      // Integrate with security information and event management (SIEM)
      await this.integrationManager.integrateWithSIEM(response)

      // Integrate with incident response platforms
      await this.integrationManager.integrateWithIncidentResponse(response)

      this.emit('system_integration_completed', {
        responseId: response.responseId,
      })
    } catch (error: unknown) {
      this.emit('system_integration_error', {
        responseId: response.responseId,
        error,
      })
    }
  }

  private async analyzeThreat(threatData: unknown): Promise<ThreatAnalysis> {
    // Use ML decision engine for threat analysis
    const mlAnalysis = await this.decisionEngine.analyzeThreat(threatData)

    // Calculate threat severity and impact
    const severity = this.calculateThreatSeverity(threatData, mlAnalysis)
    const estimatedImpact = this.calculateThreatImpact(threatData, mlAnalysis)
    const { confidence } = mlAnalysis

    const data = threatData as ThreatData

    return {
      threatId: data.threatId,
      severity,
      estimatedImpact,
      confidence,
      riskFactors: mlAnalysis.riskFactors,
      recommendedActions: mlAnalysis.recommendedActions,
      patterns: (mlAnalysis.riskFactors['patternMatches'] as string[]) || [],
      analysisTimestamp: new Date(),
    }
  }

  private async determineResponseStrategy(
    analysis: ThreatAnalysis,
  ): Promise<ResponseStrategy> {
    const strategies = this.config.escalationThresholds

    let primaryType: ThreatResponse['responseType'] = 'alert'
    let escalationLevel = 1

    // Determine response type based on severity
    if (
      analysis.severity === 'critical' ||
      analysis.estimatedImpact > (strategies['critical'] ?? 0)
    ) {
      primaryType = 'block'
      escalationLevel = 4
    } else if (
      analysis.severity === 'high' ||
      analysis.estimatedImpact > (strategies['high'] ?? 0)
    ) {
      primaryType = 'rate_limit'
      escalationLevel = 3
    } else if (
      analysis.severity === 'medium' ||
      analysis.estimatedImpact > (strategies['medium'] ?? 0)
    ) {
      primaryType = 'investigate'
      escalationLevel = 2
    } else {
      // Default case for low severity threats
    }

    return {
      primaryType,
      escalationLevel,
      requiresHumanReview: escalationLevel >= 3,
      autoExecute: escalationLevel <= 2,
      notificationPriority: escalationLevel,
    }
  }

  private async generateResponseActions(
    analysis: ThreatAnalysis,
    strategy: ResponseStrategy,
  ): Promise<ResponseAction[]> {
    const actions: ResponseAction[] = []

    // Generate primary response action
    const primaryAction = await this.generatePrimaryAction(analysis, strategy)
    if (primaryAction) {
      actions.push(primaryAction)
    }

    // Generate supporting actions
    const supportingActions = await this.generateSupportingActions(
      analysis,
      strategy,
    )
    actions.push(...supportingActions)

    // Generate monitoring actions
    const monitoringActions = await this.generateMonitoringActions(analysis)
    actions.push(...monitoringActions)

    // Sort by priority
    return actions.sort((a, b) => b.priority - a.priority)
  }

  private async generatePrimaryAction(
    analysis: ThreatAnalysis,
    strategy: ResponseStrategy,
  ): Promise<ResponseAction | null> {
    switch (strategy.primaryType) {
      case 'block':
        return {
          actionId: this.generateActionId(),
          actionType: 'ip_block',
          target: 'firewall',
          parameters: {
            sourceIp: analysis.riskFactors['ip'],
            duration: '24h',
            reason: `Critical threat detected: ${analysis.threatId}`,
          },
          priority: 10,
          timeout: 30000,
          rollbackStrategy: 'unblock_ip',
        }

      case 'rate_limit':
        return {
          actionId: this.generateActionId(),
          actionType: 'rate_limiting',
          target: 'rate_limiter',
          parameters: {
            userId: analysis.riskFactors['userId'],
            limit: 10,
            windowMs: 60000,
            reason: `High threat detected: ${analysis.threatId}`,
          },
          priority: 8,
          timeout: 15000,
          rollbackStrategy: 'remove_rate_limit',
        }

      case 'investigate':
        return {
          actionId: this.generateActionId(),
          actionType: 'log_analysis',
          target: 'security_logs',
          parameters: {
            threatId: analysis.threatId,
            depth: 'detailed',
            timeframe: '24h',
          },
          priority: 6,
          timeout: 60000,
        }

      case 'alert': {
        return {
          actionId: this.generateActionId(),
          actionType: 'user_notification',
          target: 'notification_system',
          parameters: {
            threatId: analysis.threatId,
            message: `Low severity threat detected: ${analysis.threatId}`,
            severity: analysis.severity,
          },
          priority: 3,
          timeout: 5000,
        }
      }
      case 'escalate': {
        return {
          actionId: this.generateActionId(),
          actionType: 'escalation_notification',
          target: 'escalation_system',
          parameters: {
            threatId: analysis.threatId,
            reason: `Threat requires escalation: ${analysis.threatId}`,
            severity: analysis.severity,
            estimatedImpact: analysis.estimatedImpact,
          },
          priority: 9,
          timeout: 10000,
          rollbackStrategy: 'cancel_escalation',
        }
      }
      default:
        return null
    }
  }

  private async generateSupportingActions(
    analysis: ThreatAnalysis,
    strategy: ResponseStrategy,
  ): Promise<ResponseAction[]> {
    const actions: ResponseAction[] = []

    // Add user notification action
    if (strategy.notificationPriority >= 2) {
      actions.push({
        actionId: this.generateActionId(),
        actionType: 'user_notification',
        target: 'user_management',
        parameters: {
          userId: analysis.riskFactors['userId'],
          message: `Security concern detected on your account. Please verify recent activity.`,
          priority: 'high',
        },
        priority: 5,
        timeout: 10000,
      })
    }

    // Add audit logging action
    actions.push({
      actionId: this.generateActionId(),
      actionType: 'audit_log',
      target: 'audit_system',
      parameters: {
        threatId: analysis.threatId,
        action: 'automated_response',
        details: `Response strategy: ${strategy.primaryType}, severity: ${analysis.severity}`,
      },
      priority: 4,
      timeout: 5000,
    })

    return actions
  }

  private async generateMonitoringActions(
    analysis: ThreatAnalysis,
  ): Promise<ResponseAction[]> {
    return [
      {
        actionId: this.generateActionId(),
        actionType: 'monitoring_setup',
        target: 'monitoring_system',
        parameters: {
          threatId: analysis.threatId,
          metrics: ['response_time', 'error_rate', 'threat_score'],
          alertThresholds: {
            responseTime: 5000,
            errorRate: 0.1,
            threatScore: 0.7,
          },
        },
        priority: 3,
        timeout: 10000,
      },
    ]
  }

  private async executeResponseOrchestration(
    response: ThreatResponse,
  ): Promise<void> {
    // Pre-execution validation
    const validationResults = await Promise.all(
      response.actions.map(async (action) => this.validateAction(action)),
    )

    if (validationResults.some((result) => !result)) {
      throw new Error('Response validation failed for one or more actions')
    }

    // Execute response if auto-execute is enabled
    const strategy = await this.determineResponseStrategy({
      threatId: response.threatId,
      severity: response.severity,
      estimatedImpact: response.estimatedImpact,
      confidence: response.confidence,
      riskFactors: {},
      recommendedActions: response.actions.map((a) => a.actionType),
      patterns: [],
      analysisTimestamp: new Date(),
    })

    if (strategy.autoExecute) {
      await this.executeResponse(response)
    } else {
      // Response will be executed manually or through external trigger
    }

    // Send notifications
    await this.notificationManager.sendNotifications(response, [])

    // Integrate with external systems
    await this.integrateWithSystems(response)
  }

  private async integrateWithRateLimiting(
    response: ThreatResponse,
  ): Promise<void> {
    if (!this.rateLimitingService) {
      return
    }

    for (const action of response.actions) {
      if (action.actionType === 'rate_limiting') {
        await this.rateLimitingService.applyRateLimit(
          action.parameters['userId'] as string,
          action.parameters['limit'] as number,
          action.parameters['windowMs'] as number,
        )
      }
    }
  }

  private async storeThreatResponse(response: ThreatResponse): Promise<void> {
    const db = this.mongoClient.db('threat_detection')
    const collection = db.collection('threat_responses')

    await collection.insertOne(response)
  }

  private async updateThreatResponse(response: ThreatResponse): Promise<void> {
    const db = this.mongoClient.db('threat_detection')
    const collection = db.collection('threat_responses')

    await collection.updateOne(
      { responseId: response.responseId },
      { $set: response },
    )
  }

  private async getThreatResponse(
    responseId: string,
  ): Promise<ThreatResponse | null> {
    const db = this.mongoClient.db('threat_detection')
    const collection = db.collection<ThreatResponse>('threat_responses')

    return await collection.findOne({ responseId })
  }

  private generateResponseId(): string {
    return this.secureId('response_')
  }

  private generateActionId(): string {
    return this.secureId('action_')
  }

  private secureId(prefix = ''): string {
    try {
      const c: unknown = crypto
      const { randomUUID, randomBytes } =
        (c as Record<string, unknown> | undefined) ?? {}
      if (randomUUID && typeof randomUUID === 'function') {
        return `${prefix}${randomUUID()}`
      }
      if (randomBytes && typeof randomBytes === 'function') {
        const fn = randomBytes as (size: number) => Buffer
        return `${prefix}${fn(16).toString('hex')}`
      }
    } catch {
      // ignore
    }
    return `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  }

  private calculateThreatSeverity(
    _threatData: unknown,
    mlAnalysis: MLAnalysis,
  ): ThreatResponse['severity'] {
    // Implement severity calculation logic
    if (mlAnalysis.riskScore > 0.8) {
      return 'critical'
    }
    if (mlAnalysis.riskScore > 0.6) {
      return 'high'
    }
    if (mlAnalysis.riskScore > 0.4) {
      return 'medium'
    }
    return 'low'
  }

  private calculateThreatImpact(
    _threatData: unknown,
    mlAnalysis: MLAnalysis,
  ): number {
    // Implement impact calculation logic
    return mlAnalysis.riskScore * 100 // Scale to 0-100 range
  }

  private validateActionParameters(_action: ResponseAction): {
    valid: boolean
    errors?: string[]
  } {
    // Implement parameter validation
    return { valid: true }
  }

  private async validateActionDependencies(
    _action: ResponseAction,
  ): Promise<{ valid: boolean; errors?: string[] }> {
    // Implement dependency validation
    return { valid: true }
  }

  private async validateBusinessRules(
    _action: ResponseAction,
  ): Promise<{ valid: boolean; errors?: string[] }> {
    // Implement business rule validation
    return { valid: true }
  }

  private async validateExecutionResults(
    results: ExecutionResult[],
  ): Promise<{ success: boolean; errors?: string[] }> {
    const failures = results.filter((result) => !result.success)

    return {
      success: failures.length === 0,
      errors: failures.map((f) => f.error ?? 'Unknown error'),
    }
  }

  private async logResponseExecution(
    response: ThreatResponse,
    results: ExecutionResult[],
  ): Promise<void> {
    // Implement execution logging
    logger.info(
      `Response ${response.responseId} executed with ${results.length} actions`,
    )
  }

  async shutdown(): Promise<void> {
    await this.redis.quit()
    await this.mongoClient.close()
    this.emit('orchestrator_shutdown')
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Check Redis connection
      const redisStatus = await this.redis.ping()
      if (redisStatus !== 'PONG') return false

      // Check MongoDB connection
      await this.mongoClient.db('admin').command({ ping: 1 })

      return true
    } catch (error: unknown) {
      logger.error('Orchestrator health check failed:', error)
      return false
    }
  }
}

// Re-export the public types (previously co-located) to preserve the module API
export type {
  ThreatResponse,
  ResponseAction,
  ValidationRule,
  OrchestrationConfig,
  IntegrationEndpoint,
  NotificationChannel,
  ThreatIntelligenceService,
  RateLimitingService,
  ResponseOrchestrationService,
  ThreatAnalysis,
  ResponseStrategy,
  ExecutionResult,
  ThreatData,
  RateLimitResult,
} from './response-orchestration.types'
