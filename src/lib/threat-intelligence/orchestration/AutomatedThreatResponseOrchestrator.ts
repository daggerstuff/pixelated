/**
 * Automated Threat Response Orchestrator
 * Coordinates automated responses to threats across the global infrastructure
 */

import { EventEmitter } from 'events'
import { Redis } from 'ioredis'
import { MongoClient, Db } from 'mongodb'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'

import {
  OrchestrationConfig,
  ResponseStrategy,
  ResponseAction,
  ResponseCondition,
  IntegrationEndpoint,
  GlobalThreatIntelligence,
  ThreatResponse,
} from '../global/types'

const logger = createBuildSafeLogger('automated-threat-response-orchestrator')

export interface AutomatedThreatResponseOrchestrator {
  initialize(): Promise<void>
  orchestrateResponse(threat: GlobalThreatIntelligence): Promise<ThreatResponse>
  executeResponse(response: ThreatResponse): Promise<boolean>
  rollbackResponse(responseId: string): Promise<boolean>
  updateResponseStrategy(strategy: ResponseStrategy): Promise<boolean>
  getResponseHistory(
    threatId: string,
    limit?: number,
  ): Promise<ThreatResponse[]>
  getHealthStatus(): Promise<HealthStatus>
  shutdown(): Promise<void>
}

export interface ThreatResponse {
  responseId: string
  threatId: string
  responseType: 'block' | 'isolate' | 'alert' | 'investigate' | 'mitigate'
  severity: 'low' | 'medium' | 'high' | 'critical'
  actions: ResponseAction[]
  confidence: number
  estimatedImpact: number
  executionTime: Date
  completedTime?: Date
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'rolled_back'
  metadata?: Record<string, unknown>
}

export interface HealthStatus {
  healthy: boolean
  message: string
  responseTime?: number
  activeResponses?: number
  successRate?: number
}

export interface ResponseMetrics {
  totalResponses: number
  successfulResponses: number
  failedResponses: number
  averageResponseTime: number
  responseByType: Record<string, number>
  responseBySeverity: Record<string, number>
}

export class AutomatedThreatResponseOrchestratorCore
  extends EventEmitter
  implements AutomatedThreatResponseOrchestrator
{
  private redis: Redis
  private mongoClient: MongoClient
  private db: Db
  private responseStrategies: Map<string, ResponseStrategy> = new Map()
  private activeResponses: Map<string, ThreatResponse> = new Map()
  private integrationEndpoints: Map<string, IntegrationEndpoint> = new Map()

  constructor(private config: OrchestrationConfig) {
    super()
    this.initializeStrategies()
    this.initializeEndpoints()
  }

  private initializeStrategies(): void {
    for (const strategy of this.config.responseStrategies) {
      this.responseStrategies.set(strategy.strategyId, strategy)
    }
  }

  private initializeEndpoints(): void {
    for (const endpoint of this.config.integrationEndpoints) {
      this.integrationEndpoints.set(endpoint.endpointId, endpoint)
    }
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Automated Threat Response Orchestrator')

      // Initialize Redis connection
      await this.initializeRedis()

      // Initialize MongoDB connection
      await this.initializeMongoDB()

      // Load response strategies from database
      await this.loadResponseStrategies()

      // Start response monitoring
      await this.startResponseMonitoring()

      // Start metrics collection
      await this.startMetricsCollection()

      this.emit('orchestrator_initialized')
      logger.info(
        'Automated Threat Response Orchestrator initialized successfully',
      )
    } catch (error) {
      logger.error(
        'Failed to initialize Automated Threat Response Orchestrator:',
        { error },
      )
      this.emit('initialization_error', { error })
      throw error
    }
  }

  private async initializeRedis(): Promise<void> {
    try {
      this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
      await this.redis.ping()
      logger.info('Redis connection established for response orchestrator')
    } catch (error) {
      logger.error('Failed to connect to Redis:', { error })
      throw new Error('Redis connection failed', { cause: error })
    }
  }

  private async initializeMongoDB(): Promise<void> {
    try {
      this.mongoClient = new MongoClient(
        process.env.MONGODB_URI || 'mongodb://localhost:27017/threat_response',
      )
      await this.mongoClient.connect()
      this.db = this.mongoClient.db('threat_response')
      logger.info('MongoDB connection established for response orchestrator')
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', { error })
      throw new Error('MongoDB connection failed', { cause: error })
    }
  }

  private async loadResponseStrategies(): Promise<void> {
    try {
      const strategiesCollection = this.db.collection('response_strategies')
      const strategies = await strategiesCollection.find({}).toArray()

      for (const strategy of strategies) {
        this.responseStrategies.set(strategy.strategyId, strategy)
      }

      logger.info(
        `Loaded ${strategies.length} response strategies from database`,
      )
    } catch (error) {
      logger.error('Failed to load response strategies:', { error })
    }
  }

  private async startResponseMonitoring(): Promise<void> {
    // Monitor active responses every 30 seconds
    setInterval(async () => {
      try {
        await this.monitorActiveResponses()
      } catch (error) {
        logger.error('Response monitoring error:', { error })
      }
    }, 30000)
  }

  private async startMetricsCollection(): Promise<void> {
    // Collect metrics every 5 minutes
    setInterval(async () => {
      try {
        await this.collectMetrics()
      } catch (error) {
        logger.error('Metrics collection error:', { error })
      }
    }, 300000)
  }

  async orchestrateResponse(
    threat: GlobalThreatIntelligence,
  ): Promise<ThreatResponse> {
    try {
      logger.info('Orchestrating threat response', {
        threatId: threat.threatId,
        severity: threat.severity,
        confidence: threat.confidence,
      })

      // Step 1: Select appropriate response strategy
      const strategy = await this.selectResponseStrategy(threat)

      // Step 2: Generate response actions based on strategy
      const actions = await this.generateResponseActions(threat, strategy)

      // Step 3: Validate response actions
      const validatedActions = await this.validateResponseActions(actions)

      // Step 4: Calculate estimated impact
      const estimatedImpact = await this.calculateEstimatedImpact(
        threat,
        validatedActions,
      )

      // Step 5: Create threat response object
      const response: ThreatResponse = {
        responseId: this.generateResponseId(),
        threatId: threat.threatId,
        responseType: strategy.primaryType,
        severity: threat.severity,
        actions: validatedActions,
        confidence: threat.confidence,
        estimatedImpact,
        executionTime: new Date(),
        status: 'pending',
      }

      // Step 6: Store response in database
      await this.storeThreatResponse(response)

      // Step 7: Execute response if automation level allows
      if (this.shouldAutoExecute(response)) {
        await this.executeResponse(response)
      } else {
        // Queue for manual review
        await this.queueForManualReview(response)
      }

      // Step 8: Send notifications
      await this.sendNotifications(response)

      // Step 9: Integrate with external systems
      await this.integrateWithExternalSystems(response)

      this.emit('response_orchestrated', {
        responseId: response.responseId,
        threatId: threat.threatId,
        actionCount: response.actions.length,
      })

      return response
    } catch (error) {
      logger.error('Failed to orchestrate threat response:', {
        error,
        threatId: threat.threatId,
      })
      this.emit('orchestration_error', { error, threatId: threat.threatId })
      throw error
    }
  }

  private async selectResponseStrategy(
    threat: GlobalThreatIntelligence,
  ): Promise<ResponseStrategy> {
    try {
      // Find matching strategies based on threat characteristics
      const matchingStrategies: ResponseStrategy[] = []

      for (const strategy of this.responseStrategies.values()) {
        if (this.strategyMatchesThreat(strategy, threat)) {
          matchingStrategies.push(strategy)
        }
      }

      if (matchingStrategies.length === 0) {
        // Use default strategy
        return this.getDefaultStrategy(threat)
      }

      // Select the best matching strategy based on priority and conditions
      matchingStrategies.sort((a, b) => b.priority - a.priority)
      return matchingStrategies[0]
    } catch (error) {
      logger.error('Failed to select response strategy:', { error })
      return this.getDefaultStrategy(threat)
    }
  }

  private strategyMatchesThreat(
    strategy: ResponseStrategy,
    threat: GlobalThreatIntelligence,
  ): boolean {
    try {
      // Check if threat type matches
      if (strategy.threatTypes.length > 0) {
        const threatType = this.inferThreatType(threat)
        if (!strategy.threatTypes.includes(threatType)) {
          return false
        }
      }

      // Check if severity level matches
      if (strategy.severityLevels.length > 0) {
        if (!strategy.severityLevels.includes(threat.severity)) {
          return false
        }
      }

      // Check conditions
      if (strategy.conditions.length > 0) {
        for (const condition of strategy.conditions) {
          if (!this.evaluateCondition(condition, threat)) {
            return false
          }
        }
      }

      return true
    } catch (error) {
      logger.error('Error checking strategy match:', { error })
      return false
    }
  }

  private inferThreatType(threat: GlobalThreatIntelligence): string {
    // Infer threat type based on indicators and context
    if (threat.indicators.some((i) => i.indicatorType === 'ip')) {
      return 'network'
    }
    if (threat.indicators.some((i) => i.indicatorType === 'file_hash')) {
      return 'malware'
    }
    if (threat.attribution?.family) {
      return 'attributed'
    }
    return 'general'
  }

  private evaluateCondition(
    condition: ResponseCondition,
    threat: GlobalThreatIntelligence,
  ): boolean {
    try {
      switch (condition.conditionType) {
        case 'threshold':
          return this.evaluateThresholdCondition(condition, threat)
        case 'pattern':
          return this.evaluatePatternCondition(condition, threat)
        case 'time':
          return this.evaluateTimeCondition(condition, threat)
        case 'location':
          return this.evaluateLocationCondition(condition, threat)
        default:
          return false
      }
    } catch (error) {
      logger.error('Error evaluating condition:', { error, condition })
      return false
    }
  }

  private evaluateThresholdCondition(
    condition: ResponseCondition,
    threat: GlobalThreatIntelligence,
  ): boolean {
    const value = this.getThreatValue(threat, condition.condition)

    switch (condition.operator) {
      case 'greater_than':
        return value > condition.value
      case 'less_than':
        return value < condition.value
      case 'equals':
        return value === condition.value
      default:
        return false
    }
  }

  private evaluatePatternCondition(
    condition: ResponseCondition,
    threat: GlobalThreatIntelligence,
  ): boolean {
    const value = this.getThreatValue(threat, condition.condition)

    if (condition.operator === 'contains') {
      return String(value).includes(String(condition.value))
    }

    if (condition.operator === 'matches') {
      const regex = new RegExp(String(condition.value))
      return regex.test(String(value))
    }

    return false
  }

  private evaluateTimeCondition(
    condition: ResponseCondition,
    _threat: GlobalThreatIntelligence,
  ): boolean {
    const currentTime = new Date()
    const conditionTime = new Date(condition.value as string)

    switch (condition.operator) {
      case 'greater_than':
        return currentTime > conditionTime
      case 'less_than':
        return currentTime < conditionTime
      default:
        return false
    }
  }

  private evaluateLocationCondition(
    condition: ResponseCondition,
    threat: GlobalThreatIntelligence,
  ): boolean {
    const regions = threat.regions
    const targetRegions = condition.value as string[]

    switch (condition.operator) {
      case 'contains':
        return regions.some((region) => targetRegions.includes(region))
      case 'equals':
        return (
          regions.length === targetRegions.length &&
          regions.every((region) => targetRegions.includes(region))
        )
      default:
        return false
    }
  }

  private getThreatValue(threat: GlobalThreatIntelligence, path: string): any {
    const keys = path.split('.')
    let value: any = threat

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key]
      } else {
        return undefined
      }
    }

    return value
  }

  private getDefaultStrategy(
    threat: GlobalThreatIntelligence,
  ): ResponseStrategy {
    // Return a default strategy based on threat severity
    const severity = threat.severity

    const defaultStrategies: Record<string, ResponseStrategy> = {
      critical: {
        strategyId: 'default_critical',
        threatTypes: [],
        severityLevels: ['critical'],
        responseActions: [
          {
            actionId: 'block_ip',
            actionType: 'block',
            target: 'firewall',
            parameters: { duration: '24h' },
            priority: 10,
            timeout: 30000,
            rollbackStrategy: 'unblock_ip',
          },
          {
            actionId: 'escalate_security',
            actionType: 'alert',
            target: 'security_team',
            parameters: { priority: 'critical' },
            priority: 9,
            timeout: 10000,
          },
        ],
        conditions: [],
        priority: 100,
      },
      high: {
        strategyId: 'default_high',
        threatTypes: [],
        severityLevels: ['high'],
        responseActions: [
          {
            actionId: 'rate_limit',
            actionType: 'rate_limit',
            target: 'rate_limiter',
            parameters: { limit: 10, windowMs: 60000 },
            priority: 8,
            timeout: 15000,
            rollbackStrategy: 'remove_rate_limit',
          },
          {
            actionId: 'increase_monitoring',
            actionType: 'investigate',
            target: 'monitoring_system',
            parameters: { level: 'high' },
            priority: 7,
            timeout: 20000,
          },
        ],
        conditions: [],
        priority: 80,
      },
      medium: {
        strategyId: 'default_medium',
        threatTypes: [],
        severityLevels: ['medium'],
        responseActions: [
          {
            actionId: 'log_analysis',
            actionType: 'investigate',
            target: 'security_logs',
            parameters: { depth: 'detailed' },
            priority: 6,
            timeout: 30000,
          },
          {
            actionId: 'user_notification',
            actionType: 'alert',
            target: 'user_management',
            parameters: { priority: 'medium' },
            priority: 5,
            timeout: 10000,
          },
        ],
        conditions: [],
        priority: 60,
      },
      low: {
        strategyId: 'default_low',
        threatTypes: [],
        severityLevels: ['low'],
        responseActions: [
          {
            actionId: 'log_threat',
            actionType: 'alert',
            target: 'audit_system',
            parameters: { level: 'info' },
            priority: 3,
            timeout: 5000,
          },
        ],
        conditions: [],
        priority: 40,
      },
    }

    return defaultStrategies[severity] || defaultStrategies['medium']
  }

  private async generateResponseActions(
    threat: GlobalThreatIntelligence,
    strategy: ResponseStrategy,
  ): Promise<ResponseAction[]> {
    try {
      const actions: ResponseAction[] = []

      for (const action of strategy.responseActions) {
        // Customize action parameters based on threat characteristics
        const customizedAction = await this.customizeAction(action, threat)
        actions.push(customizedAction)
      }

      // Sort by priority (highest first)
      return actions.sort((a, b) => b.priority - a.priority)
    } catch (error) {
      logger.error('Failed to generate response actions:', { error })
      return strategy.responseActions
    }
  }

  private async customizeAction(
    action: ResponseAction,
    threat: GlobalThreatIntelligence,
  ): Promise<ResponseAction> {
    try {
      const customizedAction = { ...action }

      // Customize parameters based on threat
      switch (action.actionType) {
        case 'block':
          customizedAction.parameters = {
            ...action.parameters,
            threatId: threat.threatId,
            severity: threat.severity,
            confidence: threat.confidence,
          }
          break

        case 'rate_limit':
          customizedAction.parameters = {
            ...action.parameters,
            severity: threat.severity,
            confidence: threat.confidence,
            regions: threat.regions,
          }
          break

        case 'alert':
          customizedAction.parameters = {
            ...action.parameters,
            threatId: threat.threatId,
            severity: threat.severity,
            indicators: threat.indicators.length,
          }
          break

        case 'investigate':
          customizedAction.parameters = {
            ...action.parameters,
            threatId: threat.threatId,
            severity: threat.severity,
            regions: threat.regions,
          }
          break
      }

      return customizedAction
    } catch (error) {
      logger.error('Failed to customize action:', { error })
      return action
    }
  }

  private async validateResponseActions(
    actions: ResponseAction[],
  ): Promise<ResponseAction[]> {
    try {
      const validatedActions: ResponseAction[] = []

      for (const action of actions) {
        if (await this.validateAction(action)) {
          validatedActions.push(action)
        } else {
          logger.warn('Action validation failed, skipping action', {
            actionId: action.actionId,
          })
        }
      }

      return validatedActions
    } catch (error) {
      logger.error('Failed to validate response actions:', { error })
      return actions
    }
  }

  private async validateAction(action: ResponseAction): Promise<boolean> {
    try {
      // Validate action parameters
      if (!action.actionId || !action.actionType || !action.target) {
        return false
      }

      // Validate timeout
      if (action.timeout <= 0 || action.timeout > 300000) {
        // Max 5 minutes
        return false
      }

      // Validate priority
      if (action.priority < 0 || action.priority > 10) {
        return false
      }

      // Check if target system is available
      const isTargetAvailable = await this.checkTargetAvailability(
        action.target,
      )
      if (!isTargetAvailable) {
        return false
      }

      return true
    } catch (error) {
      logger.error('Action validation error:', {
        error,
        actionId: action.actionId,
      })
      return false
    }
  }

  private async checkTargetAvailability(target: string): Promise<boolean> {
    try {
      // Check if the target system is available
      // This would typically involve health checks or API calls
      // For now, we'll assume all targets are available
      return true
    } catch (error) {
      logger.error('Target availability check failed:', { error, target })
      return false
    }
  }

  private async calculateEstimatedImpact(
    threat: GlobalThreatIntelligence,
    actions: ResponseAction[],
  ): Promise<number> {
    try {
      // Calculate estimated impact based on threat severity and response actions
      let baseImpact = 0

      switch (threat.severity) {
        case 'critical':
          baseImpact = 0.9
          break
        case 'high':
          baseImpact = 0.7
          break
        case 'medium':
          baseImpact = 0.5
          break
        case 'low':
          baseImpact = 0.3
          break
      }

      // Adjust based on number and type of actions
      const actionImpact = Math.min(actions.length * 0.1, 0.3)

      // Adjust based on threat confidence
      const confidenceImpact = threat.confidence * 0.2

      return Math.min(baseImpact + actionImpact + confidenceImpact, 1)
    } catch (error) {
      logger.error('Failed to calculate estimated impact:', { error })
      return 0.5
    }
  }

  private shouldAutoExecute(response: ThreatResponse): boolean {
    return (
      this.config.automationLevel === 'full' ||
      (this.config.automationLevel === 'semi' &&
        response.severity !== 'critical')
    )
  }

  async executeResponse(response: ThreatResponse): Promise<boolean> {
    try {
      logger.info('Executing threat response', {
        responseId: response.responseId,
        threatId: response.threatId,
        actionCount: response.actions.length,
      })

      // Update response status
      response.status = 'executing'
      await this.updateThreatResponse(response)

      // Execute actions in order of priority
      const executionResults: boolean[] = []

      for (const action of response.actions) {
        const result = await this.executeAction(action, response)
        executionResults.push(result)

        if (!result) {
          logger.warn('Action execution failed', {
            responseId: response.responseId,
            actionId: action.actionId,
          })
        }
      }

      // Check if all actions were successful
      const allSuccessful = executionResults.every((result) => result)

      // Update response completion
      response.status = allSuccessful ? 'completed' : 'failed'
      response.completedTime = new Date()
      await this.updateThreatResponse(response)

      // Log response execution
      await this.logResponseExecution(response, executionResults)

      this.emit('response_executed', {
        responseId: response.responseId,
        success: allSuccessful,
        actionResults: executionResults,
      })

      return allSuccessful
    } catch (error) {
      response.status = 'failed'
      response.completedTime = new Date()
      await this.updateThreatResponse(response)

      logger.error('Failed to execute threat response:', {
        error,
        responseId: response.responseId,
      })
      this.emit('response_execution_error', {
        error,
        responseId: response.responseId,
      })
      return false
    }
  }

  private async executeAction(
    action: ResponseAction,
    response: ThreatResponse,
  ): Promise<boolean> {
    try {
      logger.info('Executing response action', {
        responseId: response.responseId,
        actionId: action.actionId,
        actionType: action.actionType,
      })

      const startTime = Date.now()

      // Execute action based on type
      let executionResult = false

      switch (action.actionType) {
        case 'block':
          executionResult = await this.executeBlockAction(action, response)
          break
        case 'isolate':
          executionResult = await this.executeIsolateAction(action, response)
          break
        case 'alert':
          executionResult = await this.executeAlertAction(action, response)
          break
        case 'investigate':
          executionResult = await this.executeInvestigateAction(
            action,
            response,
          )
          break
        case 'mitigate':
          executionResult = await this.executeMitigateAction(action, response)
          break
        default:
          logger.error('Unknown action type', { actionType: action.actionType })
          executionResult = false
      }

      const executionTime = Date.now() - startTime

      // Check if execution was within timeout
      if (executionTime > action.timeout) {
        logger.warn('Action execution exceeded timeout', {
          actionId: action.actionId,
          executionTime,
          timeout: action.timeout,
        })
        executionResult = false
      }

      return executionResult
    } catch (error) {
      logger.error('Action execution failed:', {
        error,
        actionId: action.actionId,
      })
      return false
    }
  }

  private async executeBlockAction(
    action: ResponseAction,
    response: ThreatResponse,
  ): Promise<boolean> {
    try {
      // Implement blocking logic (e.g., IP blocking, domain blocking)
      const { sourceIp, duration } = action.parameters

      if (!sourceIp) {
        logger.error('Missing source IP for block action')
        return false
      }

      // Integrate with firewall or blocking system
      logger.info('Executing block action', {
        responseId: response.responseId,
        sourceIp,
        duration,
      })

      // Simulate successful blocking
      return true
    } catch (error) {
      logger.error('Block action execution failed:', { error })
      return false
    }
  }

  private async executeIsolateAction(
    action: ResponseAction,
    response: ThreatResponse,
  ): Promise<boolean> {
    try {
      // Implement isolation logic (e.g., network isolation, user isolation)
      const { userId, systemId } = action.parameters

      logger.info('Executing isolate action', {
        responseId: response.responseId,
        userId,
        systemId,
      })

      // Simulate successful isolation
      return true
    } catch (error) {
      logger.error('Isolate action execution failed:', { error })
      return false
    }
  }

  private async executeAlertAction(
    action: ResponseAction,
    response: ThreatResponse,
  ): Promise<boolean> {
    try {
      // Implement alerting logic (e.g., email, Slack, webhook)
      const { recipients, priority } = action.parameters

      logger.info('Executing alert action', {
        responseId: response.responseId,
        recipients,
        priority,
      })

      // Send notifications
      await this.sendNotifications(response)

      return true
    } catch (error) {
      logger.error('Alert action execution failed:', { error })
      return false
    }
  }

  private async executeInvestigateAction(
    action: ResponseAction,
    response: ThreatResponse,
  ): Promise<boolean> {
    try {
      // Implement investigation logic (e.g., log analysis, forensic collection)
      const { depth, scope, dataSources } = action.parameters

      logger.info('Executing investigate action', {
        responseId: response.responseId,
        depth,
        scope,
        dataSources,
      })

      // Simulate successful investigation initiation
      return true
    } catch (error) {
      logger.error('Investigate action execution failed:', { error })
      return false
    }
  }

  private async executeMitigateAction(
    action: ResponseAction,
    response: ThreatResponse,
  ): Promise<boolean> {
    try {
      // Implement mitigation logic (e.g., patch deployment, configuration changes)
      const { mitigationType, targetSystem } = action.parameters

      logger.info('Executing mitigate action', {
        responseId: response.responseId,
        mitigationType,
        targetSystem,
      })

      // Simulate successful mitigation
      return true
    } catch (error) {
      logger.error('Mitigate action execution failed:', { error })
      return false
    }
  }

  private async queueForManualReview(response: ThreatResponse): Promise<void> {
    try {
      // Queue response for manual review
      const reviewQueueKey = `response_review_queue`
      const reviewData = {
        responseId: response.responseId,
        threatId: response.threatId,
        severity: response.severity,
        actions: response.actions.length,
        queuedAt: new Date(),
      }

      await this.redis.lpush(reviewQueueKey, JSON.stringify(reviewData))

      logger.info('Response queued for manual review', {
        responseId: response.responseId,
        severity: response.severity,
      })
    } catch (error) {
      logger.error('Failed to queue response for manual review:', { error })
    }
  }

  private async sendNotifications(response: ThreatResponse): Promise<void> {
    try {
      // Send notifications based on response severity
      const notificationLevel = this.getNotificationLevel(response.severity)

      if (notificationLevel === 'none') {
        return
      }

      const notificationData = {
        responseId: response.responseId,
        threatId: response.threatId,
        severity: response.severity,
        responseType: response.responseType,
        actionCount: response.actions.length,
        timestamp: new Date(),
      }

      // Send to different channels based on level
      switch (notificationLevel) {
        case 'critical':
          await this.sendCriticalNotification(notificationData)
          break
        case 'high':
          await this.sendHighPriorityNotification(notificationData)
          break
        case 'medium':
          await this.sendMediumPriorityNotification(notificationData)
          break
        case 'low':
          await this.sendLowPriorityNotification(notificationData)
          break
      }
    } catch (error) {
      logger.error('Failed to send notifications:', { error })
    }
  }

  private getNotificationLevel(severity: string): string {
    const levels: Record<string, string> = {
      critical: 'critical',
      high: 'high',
      medium: 'medium',
      low: 'low',
    }
    return levels[severity] || 'medium'
  }

  private async sendCriticalNotification(data: any): Promise<void> {
    // Send critical notifications (SMS, phone calls, immediate alerts)
    logger.info('Sending critical notification', data)
  }

  private async sendHighPriorityNotification(data: any): Promise<void> {
    // Send high priority notifications (email, Slack, etc.)
    logger.info('Sending high priority notification', data)
  }

  private async sendMediumPriorityNotification(data: any): Promise<void> {
    // Send medium priority notifications
    logger.info('Sending medium priority notification', data)
  }

  private async sendLowPriorityNotification(data: any): Promise<void> {
    // Send low priority notifications
    logger.info('Sending low priority notification', data)
  }

  private async integrateWithExternalSystems(
    response: ThreatResponse,
  ): Promise<void> {
    try {
      // Integrate with configured external systems
      for (const endpoint of this.integrationEndpoints.values()) {
        if (endpoint.enabled !== false) {
          await this.sendToIntegrationEndpoint(endpoint, response)
        }
      }
    } catch (error) {
      logger.error('External system integration failed:', { error })
    }
  }

  private async sendToIntegrationEndpoint(
    endpoint: IntegrationEndpoint,
    _response: ThreatResponse,
  ): Promise<void> {
    try {
      logger.info('Sending to integration endpoint', {
        endpoint: endpoint.endpointId,
        service: endpoint.service,
      })

      // Simulate API call to integration endpoint
      // In a real implementation, this would make actual HTTP requests
    } catch (error) {
      logger.error('Integration endpoint communication failed:', {
        error,
        endpoint: endpoint.endpointId,
      })
    }
  }

  private async storeThreatResponse(response: ThreatResponse): Promise<void> {
    try {
      const responsesCollection = this.db.collection('threat_responses')
      await responsesCollection.insertOne(response)

      this.activeResponses.set(response.responseId, response)
    } catch (error) {
      logger.error('Failed to store threat response:', { error })
      throw error
    }
  }

  private async updateThreatResponse(response: ThreatResponse): Promise<void> {
    try {
      const responsesCollection = this.db.collection('threat_responses')
      await responsesCollection.updateOne(
        { responseId: response.responseId },
        { $set: response },
      )

      this.activeResponses.set(response.responseId, response)
    } catch (error) {
      logger.error('Failed to update threat response:', { error })
      throw error
    }
  }

  private async logResponseExecution(
    response: ThreatResponse,
    results: boolean[],
  ): Promise<void> {
    try {
      const executionLog = {
        responseId: response.responseId,
        threatId: response.threatId,
        executionTime: response.executionTime,
        completionTime: response.completedTime,
        success: response.status === 'completed',
        actionResults: results,
        totalActions: results.length,
        successfulActions: results.filter((r) => r).length,
        failedActions: results.filter((r) => !r).length,
      }

      const logsCollection = this.db.collection('response_execution_logs')
      await logsCollection.insertOne(executionLog)
    } catch (error) {
      logger.error('Failed to log response execution:', { error })
    }
  }

  async rollbackResponse(responseId: string): Promise<boolean> {
    try {
      logger.info('Rolling back threat response', { responseId })

      // Get the response
      const response = await this.getThreatResponse(responseId)
      if (!response) {
        throw new Error(`Threat response not found: ${responseId}`)
      }

      if (response.status !== 'completed') {
        logger.warn('Cannot rollback response that is not completed', {
          responseId,
          status: response.status,
        })
        return false
      }

      // Execute rollback actions in reverse order
      const rollbackResults: boolean[] = []

      for (let i = response.actions.length - 1; i >= 0; i--) {
        const action = response.actions[i]
        if (action.rollbackStrategy) {
          const result = await this.executeRollbackAction(action, response)
          rollbackResults.push(result)
        }
      }

      // Check if all rollback actions were successful
      const rollbackSuccessful = rollbackResults.every((result) => result)

      // Update response status
      response.status = 'rolled_back'
      await this.updateThreatResponse(response)

      this.emit('response_rolled_back', {
        responseId,
        success: rollbackSuccessful,
        rollbackResults,
      })

      return rollbackSuccessful
    } catch (error) {
      logger.error('Failed to rollback threat response:', { error, responseId })
      this.emit('rollback_error', { error, responseId })
      return false
    }
  }

  private async executeRollbackAction(
    action: ResponseAction,
    response: ThreatResponse,
  ): Promise<boolean> {
    try {
      logger.info('Executing rollback action', {
        responseId: response.responseId,
        actionId: action.actionId,
        rollbackStrategy: action.rollbackStrategy,
      })

      // Execute rollback based on strategy
      switch (action.rollbackStrategy) {
        case 'unblock_ip':
          return await this.rollbackBlockAction(action, response)
        case 'remove_rate_limit':
          return await this.rollbackRateLimitAction(action, response)
        default:
          logger.warn('Unknown rollback strategy', {
            actionId: action.actionId,
            rollbackStrategy: action.rollbackStrategy,
          })
          return false
      }
    } catch (error) {
      logger.error('Rollback action execution failed:', {
        error,
        actionId: action.actionId,
      })
      return false
    }
  }

  private async rollbackBlockAction(
    action: ResponseAction,
    response: ThreatResponse,
  ): Promise<boolean> {
    try {
      const { sourceIp } = action.parameters

      if (!sourceIp) {
        logger.error('Missing source IP for rollback')
        return false
      }

      // Implement unblock logic
      logger.info('Rolling back block action', {
        responseId: response.responseId,
        sourceIp,
      })

      return true
    } catch (error) {
      logger.error('Rollback block action failed:', { error })
      return false
    }
  }

  private async rollbackRateLimitAction(
    action: ResponseAction,
    response: ThreatResponse,
  ): Promise<boolean> {
    try {
      const { userId } = action.parameters

      // Implement remove rate limit logic
      logger.info('Rolling back rate limit action', {
        responseId: response.responseId,
        userId,
      })

      return true
    } catch (error) {
      logger.error('Rollback rate limit action failed:', { error })
      return false
    }
  }

  private async getThreatResponse(
    responseId: string,
  ): Promise<ThreatResponse | null> {
    try {
      // Check cache first
      const cached = this.activeResponses.get(responseId)
      if (cached) {
        return cached
      }

      // Query database
      const responsesCollection = this.db.collection('threat_responses')
      const response = await responsesCollection.findOne({ responseId })

      if (response) {
        this.activeResponses.set(responseId, response)
      }

      return response
    } catch (error) {
      logger.error('Failed to get threat response:', { error, responseId })
      return null
    }
  }

  async updateResponseStrategy(strategy: ResponseStrategy): Promise<boolean> {
    try {
      logger.info('Updating response strategy', {
        strategyId: strategy.strategyId,
      })

      // Validate strategy
      this.validateResponseStrategy(strategy)

      // Update in memory
      this.responseStrategies.set(strategy.strategyId, strategy)

      // Update in database
      const strategiesCollection = this.db.collection('response_strategies')
      await strategiesCollection.replaceOne(
        { strategyId: strategy.strategyId },
        strategy,
        { upsert: true },
      )

      this.emit('strategy_updated', { strategyId: strategy.strategyId })
      return true
    } catch (error) {
      logger.error('Failed to update response strategy:', { error })
      return false
    }
  }

  private validateResponseStrategy(strategy: ResponseStrategy): void {
    if (
      !strategy.strategyId ||
      !strategy.responseActions ||
      strategy.responseActions.length === 0
    ) {
      throw new Error('Invalid response strategy: missing required fields')
    }

    if (strategy.priority < 0 || strategy.priority > 100) {
      throw new Error(
        'Invalid response strategy: priority must be between 0 and 100',
      )
    }
  }

  async getResponseHistory(
    threatId: string,
    limit: number = 50,
  ): Promise<ThreatResponse[]> {
    try {
      const responsesCollection = this.db.collection('threat_responses')
      const responses = await responsesCollection
        .find({ threatId })
        .sort({ executionTime: -1 })
        .limit(limit)
        .toArray()

      return responses
    } catch (error) {
      logger.error('Failed to get response history:', { error, threatId })
      throw error
    }
  }

  private async monitorActiveResponses(): Promise<void> {
    try {
      // Check for responses that have been executing for too long
      const now = new Date()
      const timeoutThreshold = 5 * 60 * 1000 // 5 minutes

      for (const [responseId, response] of this.activeResponses) {
        if (response.status === 'executing') {
          const executionTime = now.getTime() - response.executionTime.getTime()

          if (executionTime > timeoutThreshold) {
            logger.warn('Response execution timeout detected', {
              responseId,
              executionTime,
            })

            // Mark as failed due to timeout
            response.status = 'failed'
            response.completedTime = now
            await this.updateThreatResponse(response)

            this.emit('response_timeout', { responseId, executionTime })
          }
        }
      }
    } catch (error) {
      logger.error('Active response monitoring failed:', { error })
    }
  }

  private async collectMetrics(): Promise<void> {
    try {
      const metrics = await this.calculateResponseMetrics()

      this.emit('metrics_collected', metrics)
    } catch (error) {
      logger.error('Metrics collection failed:', { error })
    }
  }

  private async calculateResponseMetrics(): Promise<ResponseMetrics> {
    try {
      const responsesCollection = this.db.collection('threat_responses')

      const [
        totalResponses,
        successfulResponses,
        averageResponseTime,
        responsesByType,
        responsesBySeverity,
      ] = await Promise.all([
        responsesCollection.countDocuments(),
        responsesCollection.countDocuments({ status: 'completed' }),
        this.calculateAverageResponseTime(),
        this.getResponsesByType(),
        this.getResponsesBySeverity(),
      ])

      return {
        totalResponses,
        successfulResponses,
        failedResponses: totalResponses - successfulResponses,
        averageResponseTime,
        responseByType: responsesByType,
        responseBySeverity: responsesBySeverity,
      }
    } catch (error) {
      logger.error('Failed to calculate response metrics:', { error })
      return {
        totalResponses: 0,
        successfulResponses: 0,
        failedResponses: 0,
        averageResponseTime: 0,
        responseByType: {},
        responseBySeverity: {},
      }
    }
  }

  private async calculateAverageResponseTime(): Promise<number> {
    try {
      const responsesCollection = this.db.collection('threat_responses')
      const completedResponses = await responsesCollection
        .find({
          status: 'completed',
          executionTime: { $exists: true },
          completedTime: { $exists: true },
        })
        .project({ executionTime: 1, completedTime: 1 })
        .limit(100)
        .toArray()

      if (completedResponses.length === 0) {
        return 0
      }

      let totalTime = 0
      for (const response of completedResponses) {
        const timeDiff =
          response.completedTime.getTime() - response.executionTime.getTime()
        totalTime += timeDiff
      }

      return totalTime / completedResponses.length
    } catch (error) {
      logger.error('Failed to calculate average response time:', { error })
      return 0
    }
  }

  private async getResponsesByType(): Promise<Record<string, number>> {
    try {
      const responsesCollection = this.db.collection('threat_responses')
      const pipeline = [
        { $group: { _id: '$responseType', count: { $sum: 1 } } },
        { $project: { responseType: '$_id', count: 1, _id: 0 } },
      ]

      const results = await responsesCollection.aggregate(pipeline).toArray()

      const responsesByType: Record<string, number> = {}
      for (const result of results) {
        responsesByType[result.responseType] = result.count
      }

      return responsesByType
    } catch (error) {
      logger.error('Failed to get responses by type:', { error })
      return {}
    }
  }

  private async getResponsesBySeverity(): Promise<Record<string, number>> {
    try {
      const responsesCollection = this.db.collection('threat_responses')
      const pipeline = [
        { $group: { _id: '$severity', count: { $sum: 1 } } },
        { $project: { severity: '$_id', count: 1, _id: 0 } },
      ]

      const results = await responsesCollection.aggregate(pipeline).toArray()

      const responsesBySeverity: Record<string, number> = {}
      for (const result of results) {
        responsesBySeverity[result.severity] = result.count
      }

      return responsesBySeverity
    } catch (error) {
      logger.error('Failed to get responses by severity:', { error })
      return {}
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

      // Check MongoDB connection
      const mongodbHealthy = await this.checkMongoDBHealth()
      if (!mongodbHealthy) {
        return {
          healthy: false,
          message: 'MongoDB connection failed',
        }
      }

      // Calculate success rate
      const metrics = await this.calculateResponseMetrics()
      const successRate =
        metrics.totalResponses > 0
          ? (metrics.successfulResponses / metrics.totalResponses) * 100
          : 0

      const responseTime = Date.now() - startTime

      return {
        healthy: true,
        message: 'Automated Threat Response Orchestrator is healthy',
        responseTime,
        activeResponses: this.activeResponses.size,
        successRate,
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

  private async checkMongoDBHealth(): Promise<boolean> {
    try {
      await this.db.admin().ping()
      return true
    } catch (error) {
      logger.error('MongoDB health check failed:', { error })
      return false
    }
  }

  private generateResponseId(): string {
    return `response_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  }

  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down Automated Threat Response Orchestrator')

      // Close database connections
      if (this.mongoClient) {
        await this.mongoClient.close()
      }

      if (this.redis) {
        await this.redis.quit()
      }

      this.emit('orchestrator_shutdown')
      logger.info('Automated Threat Response Orchestrator shutdown completed')
    } catch (error) {
      logger.error('Error during shutdown:', { error })
      throw error
    }
  }
}
