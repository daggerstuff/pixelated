/**
 * Global Threat Intelligence Network Core System
 * Coordinates threat intelligence across multiple regions with real-time capabilities
 */

import crypto from 'crypto'
import { EventEmitter } from 'events'

import Redis from 'ioredis'
import { MongoClient } from 'mongodb'

import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import { type ExternalThreatIntelligenceService } from '../../threat-detection/integrations/external-threat-intelligence'
import { type AdvancedPredictiveThreatIntelligence } from '../../threat-detection/predictive/predictive-threat-intelligence'
import { type AdvancedResponseOrchestrator } from '../../threat-detection/response-orchestration'
import {
  ThreatCorrelationEngine,
  ThreatCorrelationEngineCore,
} from '../correlation/ThreatCorrelationEngine'
import {
  ThreatIntelligenceDatabaseCore,
  type ThreatIntelligenceDatabase,
} from '../database/ThreatIntelligenceDatabase'
import {
  type EdgeThreatDetectionSystem,
  EdgeThreatDetectionSystemCore,
} from '../edge/EdgeThreatDetectionSystem'
import {
  type ExternalThreatFeedIntegration,
  ExternalThreatFeedIntegrationCore,
} from '../feeds/ExternalThreatFeedIntegration'
import type { EdgeDetectionResult } from '../global/types'
import {
  type ThreatHuntingSystem,
  ThreatHuntingSystemCore,
} from '../hunting/ThreatHuntingSystem'
import {
  type AutomatedThreatResponseOrchestrator,
  AutomatedThreatResponseOrchestratorCore,
} from '../orchestration/AutomatedThreatResponseOrchestrator'
import {
  type ThreatValidationSystem,
  ThreatValidationSystemCore,
  type ValidationMetrics as ValidationSystemMetrics,
} from '../validation/ThreatValidationSystem'
import {
  GlobalThreatIntelligenceNetworkConfig,
  GlobalThreatIntelligence,
  RealTimeThreatData,
  ThreatAttribution,
  FeedConfig,
  GlobalImpactAssessment,
  CorrelationData,
  ValidationStatus,
  ThreatValidation,
  HuntingConfig,
  HealthStatus,
} from './types'

const logger = createBuildSafeLogger('global-threat-intelligence-network')

import type {
  GlobalThreatIntelligenceNetwork,
  GlobalThreatSummary,
  RegionStatus,
  ComponentHealth,
  SystemMetrics,
} from './global-threat-intelligence-network.utils'
import {
  mapSeverityToLevel,
  generateGlobalThreatId,
  generateIntelligenceId,
  createPendingValidationStatus,
  createDefaultHuntingConfig,
  createDefaultFeedConfig,
} from './global-threat-intelligence-network.utils'

export class GlobalThreatIntelligenceNetworkCore
  extends EventEmitter
  implements GlobalThreatIntelligenceNetwork
{
  private redis!: Redis
  private mongoClient!: MongoClient

  private edgeDetectionSystem!: EdgeThreatDetectionSystem
  private correlationEngine!: ThreatCorrelationEngine
  private intelligenceDatabase!: ThreatIntelligenceDatabase
  private responseOrchestrator!: AutomatedThreatResponseOrchestrator
  private huntingSystem!: ThreatHuntingSystem
  private feedIntegration!: ExternalThreatFeedIntegration
  private validationSystem!: ThreatValidationSystem

  private readonly existingResponseOrchestrator?: AdvancedResponseOrchestrator
  private readonly _existingIntelligenceService?: ExternalThreatIntelligenceService
  private readonly _existingPredictiveService?: AdvancedPredictiveThreatIntelligence

  private isInitialized = false

  private healthCheckInterval: NodeJS.Timeout | null = null
  private readonly threatProcessingQueue: string[] = []
  private readonly regionStatus: Map<string, RegionStatus> = new Map()

  constructor(
    private readonly config: GlobalThreatIntelligenceNetworkConfig,
    existingServices?: {
      responseOrchestrator: AdvancedResponseOrchestrator
      intelligenceService: ExternalThreatIntelligenceService
      predictiveService: AdvancedPredictiveThreatIntelligence
    },
  ) {
    super()
    this.existingResponseOrchestrator = existingServices?.responseOrchestrator
    void existingServices?.intelligenceService
    void existingServices?.predictiveService
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Global Threat Intelligence Network')

      // Initialize Redis connection
      await this.initializeRedis()

      // Initialize MongoDB connection
      await this.initializeMongoDB()

      // Initialize subsystems
      await this.initializeSubsystems()

      // Start health monitoring
      await this.startHealthMonitoring()

      // Initialize region status tracking
      await this.initializeRegionTracking()

      this.isInitialized = true
      this.emit('network_initialized')
      logger.info('Global Threat Intelligence Network initialized successfully')
    } catch (error: unknown) {
      logger.error('Failed to initialize Global Threat Intelligence Network:', {
        error,
      })
      this.emit('initialization_error', { error })
      throw error
    }
  }

  private async initializeRedis(): Promise<void> {
    try {
      this.redis = new Redis(
        process.env['REDIS_URL'] ?? 'redis://localhost:6379',
      )
      await this.redis.ping()
      logger.info('Redis connection established')
    } catch (error: unknown) {
      logger.error('Failed to connect to Redis:', { error })
      throw new Error('Redis connection failed', { cause: error })
    }
  }

  private async initializeMongoDB(): Promise<void> {
    try {
      this.mongoClient = new MongoClient(
        process.env['MONGODB_URI'] ??
          'mongodb://localhost:27017/global_threat_intelligence',
      )
      await this.mongoClient.connect()
      void this.mongoClient.db('global_threat_intelligence')
      logger.info('MongoDB connection established')
    } catch (error: unknown) {
      logger.error('Failed to connect to MongoDB:', { error })
      throw new Error('MongoDB connection failed', { cause: error })
    }
  }

  private async initializeSubsystems(): Promise<void> {
    try {
      // Initialize Edge Threat Detection System
      this.edgeDetectionSystem = new EdgeThreatDetectionSystemCore(
        this.config.edgeDetection,
      )
      await this.edgeDetectionSystem.initialize()

      // Initialize Threat Correlation Engine
      this.correlationEngine = new ThreatCorrelationEngineCore(
        this.config.correlation,
      )
      await this.correlationEngine.initialize()

      // Initialize Threat Intelligence Database
      this.intelligenceDatabase = new ThreatIntelligenceDatabaseCore(
        this.config.database,
      )
      await this.intelligenceDatabase.initialize()

      // Initialize Automated Threat Response Orchestrator
      this.responseOrchestrator = new AutomatedThreatResponseOrchestratorCore(
        this.config.orchestration,
      )
      await this.responseOrchestrator.initialize()

      // Initialize Threat Hunting System
      this.huntingSystem = new ThreatHuntingSystemCore(
        createDefaultHuntingConfig(),
      )
      await this.huntingSystem.initialize()

      // Initialize External Threat Feed Integration
      this.feedIntegration = new ExternalThreatFeedIntegrationCore(
        createDefaultFeedConfig(),
      )
      await this.feedIntegration.initialize()

      // Initialize Threat Validation System
      this.validationSystem = new ThreatValidationSystemCore(
        this.config.validation,
      )
      await this.validationSystem.initialize()

      logger.info('All subsystems initialized successfully')
    } catch (error: unknown) {
      logger.error('Failed to initialize subsystems:', { error })
      throw error
    }
  }

  private async startHealthMonitoring(): Promise<void> {
    const healthCheckInterval = 30000 // 30 seconds

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck()
      } catch (error: unknown) {
        logger.error('Health check failed:', { error })
      }
    }, healthCheckInterval)
  }

  private async initializeRegionTracking(): Promise<void> {
    for (const region of this.config.regions) {
      this.regionStatus.set(region.regionId, {
        regionId: region.regionId,
        status: 'initializing',
        lastUpdate: new Date(),
        threatCount: 0,
        activeNodes: region.edgeNodes.length,
        healthScore: 0,
      })
    }
  }

  async processThreatIntelligence(
    threatData: RealTimeThreatData,
  ): Promise<GlobalThreatIntelligence> {
    try {
      logger.info('Processing threat intelligence', {
        threatId: threatData.threatId,
        region: threatData.region,
      })

      // Step 1: Validate incoming threat data
      const validatedData = await this.validateThreatData(threatData)

      // Step 2: Check for existing global threat
      const existingThreat = await this.checkExistingGlobalThreat(validatedData)

      if (existingThreat) {
        // Update existing global threat
        return await this.updateGlobalThreat(existingThreat, validatedData)
      }

      // Step 3: Perform edge detection
      const edgeDetectionResult =
        await this.edgeDetectionSystem.detectThreat(validatedData)

      // Step 4: Correlate with other regions
      const correlationData =
        await this.correlationEngine.correlateThreat(validatedData)

      // Step 5: Create global threat intelligence
      const globalThreat = await this.createGlobalThreatIntelligence(
        validatedData,
        edgeDetectionResult,
        correlationData,
      )

      // Step 6: Store in database
      await this.intelligenceDatabase.storeThreatIntelligence(globalThreat)

      // Step 7: Validate the intelligence
      const threatValidationResult =
        await this.validationSystem.validateThreat(globalThreat)
      globalThreat.validationStatus = this.mapThreatValidationToStatus(
        threatValidationResult,
      )

      // Step 8: Cache for real-time access
      await this.cacheThreatIntelligence(globalThreat)

      // Step 9: Trigger response orchestration if needed
      if (
        globalThreat.severity === 'high' ||
        globalThreat.severity === 'critical'
      ) {
        await this.triggerResponseOrchestration(globalThreat)
      }

      // Step 10: Update region status
      await this.updateRegionStatus(globalThreat)

      this.emit('threat_processed', {
        threatId: globalThreat.threatId,
        globalThreatId: globalThreat.globalThreatId,
      })

      return globalThreat
    } catch (error: unknown) {
      logger.error('Failed to process threat intelligence:', {
        error,
        threatId: threatData.threatId,
      })
      this.emit('threat_processing_error', {
        error,
        threatId: threatData.threatId,
      })
      throw error
    }
  }

  private async validateThreatData(
    threatData: RealTimeThreatData,
  ): Promise<RealTimeThreatData> {
    // Validate required fields
    if (
      threatData.threatId.length === 0 ||
      threatData.region.length === 0 ||
      Number.isNaN(threatData.timestamp.getTime())
    ) {
      throw new Error('Invalid threat data: missing required fields')
    }

    // Validate severity range
    if (threatData.severity < 0 || threatData.severity > 1) {
      throw new Error('Invalid threat data: severity must be between 0 and 1')
    }

    // Validate confidence range
    if (threatData.confidence < 0 || threatData.confidence > 1) {
      throw new Error('Invalid threat data: confidence must be between 0 and 1')
    }

    return threatData
  }

  private async checkExistingGlobalThreat(
    threatData: RealTimeThreatData,
  ): Promise<GlobalThreatIntelligence | null> {
    try {
      // Check by threat ID
      const existingById = await this.intelligenceDatabase.getThreatById(
        threatData.threatId,
      )
      if (existingById) {
        return existingById
      }

      // Check by indicators
      for (const indicator of threatData.indicators) {
        const existingByIndicator =
          await this.intelligenceDatabase.getThreatByIndicator(
            indicator.indicatorType,
            indicator.value,
          )
        if (existingByIndicator) {
          return existingByIndicator
        }
      }

      return null
    } catch (error: unknown) {
      logger.error('Error checking existing global threat:', { error })
      return null
    }
  }

  private async updateGlobalThreat(
    existingThreat: GlobalThreatIntelligence,
    newThreatData: RealTimeThreatData,
  ): Promise<GlobalThreatIntelligence> {
    try {
      // Update last seen timestamp
      existingThreat.lastSeen = newThreatData.timestamp

      // Add new region if not already present
      if (!existingThreat.regions.includes(newThreatData.region)) {
        existingThreat.regions.push(newThreatData.region)
      }

      // Update confidence if higher
      if (newThreatData.confidence > existingThreat.confidence) {
        existingThreat.confidence = newThreatData.confidence
      }

      // Update severity if higher
      const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 }
      const newSeverity = mapSeverityToLevel(newThreatData.severity)
      if (severityOrder[newSeverity] > severityOrder[existingThreat.severity]) {
        existingThreat.severity = newSeverity
      }

      // Add new indicators
      for (const indicator of newThreatData.indicators) {
        const existingIndicator = existingThreat.indicators.find(
          (i) =>
            i.indicatorType === indicator.indicatorType &&
            i.value === indicator.value,
        )

        if (!existingIndicator) {
          existingThreat.indicators.push({
            indicatorId: indicator.indicatorId,
            indicatorType: indicator.indicatorType,
            value: indicator.value,
            confidence: indicator.confidence,
            sourceRegion: newThreatData.region,
            firstSeen: indicator.firstSeen,
            lastSeen: indicator.lastSeen,
            metadata: indicator.metadata ?? {},
          })
        } else {
          // Update existing indicator
          existingIndicator.lastSeen = indicator.lastSeen
          if (indicator.confidence > existingIndicator.confidence) {
            existingIndicator.confidence = indicator.confidence
          }
        }
      }

      // Update impact assessment
      existingThreat.impactAssessment = await this.updateImpactAssessment(
        existingThreat.impactAssessment,
        newThreatData,
      )

      return existingThreat
    } catch (error: unknown) {
      logger.error('Error updating global threat:', { error })
      throw error
    }
  }

  private async createGlobalThreatIntelligence(
    threatData: RealTimeThreatData,
    edgeDetectionResult: EdgeDetectionResult,
    correlationData: CorrelationData,
  ): Promise<GlobalThreatIntelligence> {
    const globalThreatId = generateGlobalThreatId()

    const globalThreat: GlobalThreatIntelligence = {
      intelligenceId: generateIntelligenceId(),
      threatId: threatData.threatId,
      globalThreatId,
      regions: [threatData.region],
      threatType: edgeDetectionResult.threatType,
      severity: mapSeverityToLevel(threatData.severity),
      confidence: threatData.confidence,
      firstSeen: threatData.timestamp,
      lastSeen: threatData.timestamp,
      indicators: threatData.indicators.map((indicator) => ({
        indicatorId: indicator.indicatorId,
        indicatorType: indicator.indicatorType,
        value: indicator.value,
        confidence: indicator.confidence,
        sourceRegion: threatData.region,
        firstSeen: indicator.firstSeen,
        lastSeen: indicator.lastSeen,
        metadata: indicator.metadata ?? {},
      })),
      attribution: await this.generateAttribution(threatData),
      impactAssessment: await this.assessGlobalImpact(
        threatData,
        correlationData,
      ),
      correlationData,
      validationStatus: createPendingValidationStatus(),
    }

    return globalThreat
  }

  private mapThreatValidationToStatus(
    validation: ThreatValidation,
  ): ValidationStatus {
    const completionRatio = validation.results.length === 0 ? 0 : 1
    const issueRatio = validation.results.filter(
      (result) => !result.passed,
    ).length
    const relevance =
      validation.results.length > 0
        ? completionRatio
          ? 1 - issueRatio / validation.results.length
          : validation.isValid
            ? 1
            : 0
        : validation.overallScore

    const mappedStatus =
      validation.status === 'valid'
        ? 'validated'
        : validation.status === 'invalid'
          ? 'rejected'
          : 'pending'

    return {
      validationId: validation.validationId,
      status: mappedStatus,
      accuracy: Math.max(0, Math.min(1, validation.overallScore)),
      completeness: Math.max(0, Math.min(1, validation.overallScore)),
      consistency: Math.max(0, Math.min(1, validation.overallScore)),
      timeliness: validation.completedAt
        ? 1 -
          Math.min(
            1,
            Math.max(
              0,
              validation.completedAt.getTime() - validation.createdAt.getTime(),
            ) /
              (1000 * 60 * 60),
          )
        : 1,
      relevance: Math.max(0, Math.min(1, relevance)),
      validator: 'threat_validation_system',
      validationDate: validation.completedAt ?? validation.createdAt,
      feedback: validation.results.flatMap((result) => result.issues),
    }
  }

  private async generateAttribution(
    _threatData: RealTimeThreatData,
  ): Promise<ThreatAttribution | undefined> {
    // This would use ML models to analyze threat patterns and generate attribution
    // For now, return undefined as attribution requires sophisticated analysis
    return undefined
  }

  private async assessGlobalImpact(
    threatData: RealTimeThreatData,
    correlationData: CorrelationData,
  ): Promise<GlobalImpactAssessment> {
    const affectedRegions = [threatData.region]
    const geographicSpread = affectedRegions.length

    // Calculate potential impact based on severity and correlation
    const potentialImpact =
      threatData.severity *
      (1 + Math.max(0, correlationData.correlationStrength) * 0.1)

    return {
      geographicSpread,
      affectedRegions,
      affectedSectors: ['healthcare'], // Default sector for Pixelated
      potentialImpact: Math.min(potentialImpact, 1.0), // Cap at 1.0
    }
  }

  private async updateImpactAssessment(
    existingAssessment: GlobalImpactAssessment,
    newThreatData: RealTimeThreatData,
  ): Promise<GlobalImpactAssessment> {
    // Add new region if not already present
    if (!existingAssessment.affectedRegions.includes(newThreatData.region)) {
      existingAssessment.affectedRegions.push(newThreatData.region)
      existingAssessment.geographicSpread =
        existingAssessment.affectedRegions.length
    }

    // Update potential impact
    const newImpact = newThreatData.severity * 0.3 // Weight new threat at 30%
    const existingImpact = existingAssessment.potentialImpact * 0.7 // Weight existing at 70%
    existingAssessment.potentialImpact = Math.min(
      newImpact + existingImpact,
      1.0,
    )

    return existingAssessment
  }

  private async cacheThreatIntelligence(
    globalThreat: GlobalThreatIntelligence,
  ): Promise<void> {
    const cacheKey = `global_threat:${globalThreat.globalThreatId}`
    const cacheData = {
      intelligenceId: globalThreat.intelligenceId,
      threatId: globalThreat.threatId,
      globalThreatId: globalThreat.globalThreatId,
      regions: globalThreat.regions,
      severity: globalThreat.severity,
      confidence: globalThreat.confidence,
      firstSeen: globalThreat.firstSeen,
      lastSeen: globalThreat.lastSeen,
    }

    await this.redis.setex(cacheKey, 3600, JSON.stringify(cacheData)) // 1 hour TTL
  }

  private async triggerResponseOrchestration(
    globalThreat: GlobalThreatIntelligence,
  ): Promise<void> {
    try {
      // Use existing response orchestrator for compatibility
      if (!this.existingResponseOrchestrator) {
        return
      }
      const threatResponse =
        await this.existingResponseOrchestrator.orchestrateResponse(
          globalThreat.threatId,
          globalThreat,
        )

      logger.info('Response orchestration triggered', {
        threatId: globalThreat.threatId,
        responseId: threatResponse.responseId,
      })
    } catch (error: unknown) {
      logger.error('Failed to trigger response orchestration:', { error })
    }
  }

  private async updateRegionStatus(
    globalThreat: GlobalThreatIntelligence,
  ): Promise<void> {
    for (const region of globalThreat.regions) {
      const currentStatus = this.regionStatus.get(region)
      if (currentStatus) {
        currentStatus.threatCount++
        currentStatus.lastUpdate = new Date()
        currentStatus.healthScore =
          this.calculateRegionHealthScore(currentStatus)
      }
    }
  }

  private calculateRegionHealthScore(status: RegionStatus): number {
    // Simple health score calculation based on threat count and node availability
    const threatScore = Math.max(0, 100 - status.threatCount * 5)
    const nodeScore =
      (status.activeNodes / Math.max(status.activeNodes, 1)) * 50
    return Math.min(threatScore + nodeScore, 100)
  }

  async correlateThreatsAcrossRegions(
    threatIds: string[],
  ): Promise<CorrelationData[]> {
    try {
      logger.info('Correlating threats across regions', {
        threatCount: threatIds.length,
      })

      const threats = await Promise.all(
        threatIds.map(async (id) =>
          this.intelligenceDatabase.getThreatById(id),
        ),
      )

      const validThreats = threats.filter((t) => t !== null)

      if (validThreats.length === 0) {
        return []
      }

      const correlations =
        await this.correlationEngine.correlateThreats(validThreats)

      this.emit('threats_correlated', {
        threatCount: validThreats.length,
        correlationCount: correlations.length,
      })

      return correlations
    } catch (error: unknown) {
      logger.error('Failed to correlate threats across regions:', { error })
      this.emit('correlation_error', { error })
      throw error
    }
  }

  async validateThreatIntelligence(
    intelligenceId: string,
  ): Promise<ValidationStatus> {
    try {
      logger.info('Validating threat intelligence', { intelligenceId })

      const intelligence =
        await this.intelligenceDatabase.getThreatByIntelligenceId(
          intelligenceId,
        )
      if (!intelligence) {
        throw new Error(`Threat intelligence not found: ${intelligenceId}`)
      }

      const threatValidation =
        await this.validationSystem.validateThreat(intelligence)

      // Update the intelligence with validation status
      intelligence.validationStatus =
        this.mapThreatValidationToStatus(threatValidation)
      await this.intelligenceDatabase.updateThreatIntelligence(intelligence)

      this.emit('intelligence_validated', {
        intelligenceId,
        validationStatus: intelligence.validationStatus,
      })

      return intelligence.validationStatus
    } catch (error: unknown) {
      logger.error('Failed to validate threat intelligence:', { error })
      this.emit('validation_error', { error, intelligenceId })
      throw error
    }
  }

  async getGlobalThreatSummary(region?: string): Promise<GlobalThreatSummary> {
    try {
      const [
        totalThreats,
        activeThreats,
        threatsByRegion,
        threatsBySeverity,
        recentThreats,
        correlationCount,
        validationMetrics,
      ] = await Promise.all([
        this.intelligenceDatabase.getTotalThreatCount(region),
        this.intelligenceDatabase.getActiveThreatCount(region),
        this.intelligenceDatabase.getThreatsByRegion(region),
        this.intelligenceDatabase.getThreatsBySeverity(region),
        this.intelligenceDatabase.getRecentThreats(region, 10),
        this.intelligenceDatabase.getCorrelationCount(region),
        this.validationSystem.getValidationMetrics(),
      ])

      return {
        totalThreats,
        activeThreats,
        threatsByRegion,
        threatsBySeverity,
        recentThreats,
        correlationCount,
        validationMetrics,
      }
    } catch (error: unknown) {
      logger.error('Failed to get global threat summary:', { error })
      throw error
    }
  }

  async getHealthStatus(): Promise<HealthStatus> {
    try {
      const components: Record<string, ComponentHealth> = {}

      // Check each subsystem
      components['edgeDetection'] = await this.checkEdgeDetectionHealth()
      components['correlation'] = await this.checkCorrelationHealth()
      components['database'] = await this.checkDatabaseHealth()
      components['orchestration'] = await this.checkOrchestrationHealth()
      components['hunting'] = await this.checkHuntingHealth()
      components['feedIntegration'] = await this.checkFeedIntegrationHealth()
      components['validation'] = await this.checkValidationHealth()

      // Calculate overall health
      const unhealthyComponents = Object.values(components).filter(
        (c) => c.status === 'unhealthy',
      )
      const degradedComponents = Object.values(components).filter(
        (c) => c.status === 'degraded',
      )

      let overallStatus: 'healthy' | 'degraded' | 'unhealthy'
      if (unhealthyComponents.length > 0) {
        overallStatus = 'unhealthy'
      } else if (degradedComponents.length > 0) {
        overallStatus = 'degraded'
      } else {
        overallStatus = 'healthy'
      }

      const metrics = await this.collectSystemMetrics()

      return {
        status: overallStatus,
        timestamp: new Date(),
        components,
        metrics,
      }
    } catch (error: unknown) {
      logger.error('Failed to get health status:', { error })
      throw error
    }
  }

  private async checkEdgeDetectionHealth(): Promise<ComponentHealth> {
    try {
      const status = await this.edgeDetectionSystem.getHealthStatus()
      return {
        status: status.healthy ? 'healthy' : 'unhealthy',
        message: status.message,
        lastCheck: new Date(),
        responseTime: status.responseTime,
      }
    } catch (error: unknown) {
      return {
        status: 'unhealthy',
        message: `Edge detection system error: ${error}`,
        lastCheck: new Date(),
      }
    }
  }

  private async checkCorrelationHealth(): Promise<ComponentHealth> {
    try {
      const status = await this.correlationEngine.getHealthStatus()
      return {
        status: status.healthy ? 'healthy' : 'unhealthy',
        message: status.message,
        lastCheck: new Date(),
        responseTime: status.responseTime,
      }
    } catch (error: unknown) {
      return {
        status: 'unhealthy',
        message: `Correlation engine error: ${error}`,
        lastCheck: new Date(),
      }
    }
  }

  private async checkDatabaseHealth(): Promise<ComponentHealth> {
    try {
      const status = await this.intelligenceDatabase.getHealthStatus()
      return {
        status: status.healthy ? 'healthy' : 'unhealthy',
        message: status.message,
        lastCheck: new Date(),
        responseTime: status.responseTime,
      }
    } catch (error: unknown) {
      return {
        status: 'unhealthy',
        message: `Database error: ${error}`,
        lastCheck: new Date(),
      }
    }
  }

  private async checkOrchestrationHealth(): Promise<ComponentHealth> {
    try {
      const status = await this.responseOrchestrator.getHealthStatus()
      return {
        status: status.healthy ? 'healthy' : 'unhealthy',
        message: status.message,
        lastCheck: new Date(),
        responseTime: status.responseTime,
      }
    } catch (error: unknown) {
      return {
        status: 'unhealthy',
        message: `Orchestration error: ${error}`,
        lastCheck: new Date(),
      }
    }
  }

  private async checkHuntingHealth(): Promise<ComponentHealth> {
    try {
      const status = await this.huntingSystem.getHealthStatus()
      return {
        status: status.healthy ? 'healthy' : 'unhealthy',
        message: status.message,
        lastCheck: new Date(),
        responseTime: status.responseTime,
      }
    } catch (error: unknown) {
      return {
        status: 'unhealthy',
        message: `Hunting system error: ${error}`,
        lastCheck: new Date(),
      }
    }
  }

  private async checkFeedIntegrationHealth(): Promise<ComponentHealth> {
    try {
      const status = await this.feedIntegration.getHealthStatus()
      return {
        status: status.healthy ? 'healthy' : 'unhealthy',
        message: status.message,
        lastCheck: new Date(),
        responseTime: status.responseTime,
      }
    } catch (error: unknown) {
      return {
        status: 'unhealthy',
        message: `Feed integration error: ${error}`,
        lastCheck: new Date(),
      }
    }
  }

  private async checkValidationHealth(): Promise<ComponentHealth> {
    try {
      const status = await this.validationSystem.getHealthStatus()
      return {
        status: status.healthy ? 'healthy' : 'unhealthy',
        message: status.message,
        lastCheck: new Date(),
        responseTime: status.responseTime,
      }
    } catch (error: unknown) {
      return {
        status: 'unhealthy',
        message: `Validation system error: ${error}`,
        lastCheck: new Date(),
      }
    }
  }

  private async collectSystemMetrics(): Promise<SystemMetrics> {
    try {
      // Collect basic system metrics
      // In a real implementation, this would gather actual system metrics
      return {
        cpuUsage: 45, // Placeholder
        memoryUsage: 60, // Placeholder
        diskUsage: 30, // Placeholder
        networkLatency: 25, // Placeholder
        activeConnections: 150, // Placeholder
        queueSize: this.threatProcessingQueue.length,
      }
    } catch (error: unknown) {
      logger.error('Failed to collect system metrics:', { error })
      return {
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        networkLatency: 0,
        activeConnections: 0,
        queueSize: 0,
      }
    }
  }

  private async performHealthCheck(): Promise<void> {
    const healthStatus = await this.getHealthStatus()
    this.emit('health_check_completed', healthStatus)
  }

  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down Global Threat Intelligence Network')

      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval)
        this.healthCheckInterval = null
      }

      // Shutdown subsystems in reverse order
      await this.validationSystem?.shutdown()
      await this.feedIntegration?.shutdown()
      await this.huntingSystem?.shutdown()
      await this.responseOrchestrator?.shutdown()
      await this.intelligenceDatabase?.shutdown()
      await this.correlationEngine?.shutdown()
      await this.edgeDetectionSystem?.shutdown()

      // Close database connections
      if (this.mongoClient) {
        await this.mongoClient.close()
      }

      if (this.redis) {
        await this.redis.quit()
      }

      this.isInitialized = false
      this.emit('network_shutdown')
      logger.info('Global Threat Intelligence Network shutdown completed')
    } catch (error: unknown) {
      logger.error('Error during shutdown:', { error })
      throw error
    }
  }
}

// Supporting interfaces