/**
 * Threat Hunting System
 * Proactive threat hunting capabilities across global infrastructure.
 *
 * This is the orchestrator module. Hunt execution, analysis, and intelligence
 * generation are delegated to standalone modules:
 *   .hunts.ts       — MongoDB hunt query functions
 *   .analysis.ts    — Result analysis and correlation
 *   .intelligence.ts — Threat intelligence generation, storage, notifications
 *   .utils.ts       — Shared utility functions
 *   .types.ts       — Shared type definitions
 */

import { EventEmitter } from 'events'

import Redis from 'ioredis'
import { Document, MongoClient, Db, WithId } from 'mongodb'

import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import type {
  HuntingConfig,
  HuntQuery,
  HuntResult,
  HuntPattern,
  HuntSchedule,
  HuntExecution,
  HuntFinding,
  GlobalThreatIntelligence,
} from '../global/types'
import type {
  ThreatHuntingSystem,
  HuntMetrics,
  HealthStatus,
  RawHuntFinding,
  PatternTypeCount,
  SeverityCount,
} from './ThreatHuntingSystem.types'
import {
  generateExecutionId,
  createCustomPattern,
  determineDataSources,
  validateHuntPattern,
  validateHuntSchedule,
  calculateScheduleInterval,
  mapToHuntFinding,
  calculateOverallConfidence,
  toDate,
} from './ThreatHuntingSystem.utils'
import { executeHuntByPattern } from './ThreatHuntingSystem.hunts'
import { analyzeHuntResults } from './ThreatHuntingSystem.analysis'
import {
  generateThreatIntelligence,
  storeHuntResults,
  storeHuntExecution,
  updateHuntExecution,
  sendThreatNotifications,
  integrateWithGlobalIntelligence,
} from './ThreatHuntingSystem.intelligence'

const logger = createBuildSafeLogger('threat-hunting-system')

export class ThreatHuntingSystemCore
  extends EventEmitter
  implements ThreatHuntingSystem
{
  private redis!: Redis
  private mongoClient!: MongoClient
  private db!: Db
  private readonly huntPatterns: Map<string, HuntPattern> = new Map()
  private readonly activeHunts: Map<string, HuntExecution> = new Map()
  private readonly scheduledHunts: Map<string, NodeJS.Timeout> = new Map()

  private getCollection<T extends Document = Document>(collectionName: string) {
    return this.db.collection<T>(collectionName)
  }

  private mapStoredDocument<T extends Document>(
    document: WithId<T>,
  ): Omit<WithId<T>, '_id'> {
    const { _id: _omitId, ...rest } = document
    return rest
  }

  constructor(private readonly config: HuntingConfig) {
    super()
    this.initializePatterns()
  }

  private initializePatterns(): void {
    const patterns = this.config.huntPatterns ?? []
    for (const pattern of patterns) {
      this.huntPatterns.set(pattern.patternId, pattern)
    }
  }

  // ─── Lifecycle ────────────────────────────────────────────────

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Threat Hunting System')
      await this.initializeRedis()
      await this.initializeMongoDB()
      await this.loadHuntPatterns()
      await this.startHuntScheduler()
      await this.startMetricsCollection()
      this.emit('hunting_system_initialized')
      logger.info('Threat Hunting System initialized successfully')
    } catch (error: unknown) {
      logger.error('Failed to initialize Threat Hunting System:', { error })
      this.emit('initialization_error', { error })
      throw error
    }
  }

  private async initializeRedis(): Promise<void> {
    try {
      this.redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379')
      await this.redis.ping()
      logger.info('Redis connection established for threat hunting')
    } catch (error: unknown) {
      logger.error('Failed to connect to Redis:', { error })
      throw new Error('Redis connection failed', { cause: error })
    }
  }

  private async initializeMongoDB(): Promise<void> {
    try {
      this.mongoClient = new MongoClient(
        process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/threat_hunting',
      )
      await this.mongoClient.connect()
      this.db = this.mongoClient.db('threat_hunting')
      logger.info('MongoDB connection established for threat hunting')
    } catch (error: unknown) {
      logger.error('Failed to connect to MongoDB:', { error })
      throw new Error('MongoDB connection failed', { cause: error })
    }
  }

  private async loadHuntPatterns(): Promise<void> {
    try {
      const patternsCollection = this.getCollection<HuntPattern>('hunt_patterns')
      const patterns = await patternsCollection.find({}).toArray()
      const mappedPatterns = patterns.map((pattern) => this.mapStoredDocument(pattern))
      for (const pattern of mappedPatterns) {
        this.huntPatterns.set(pattern.patternId, pattern)
      }
      logger.info(`Loaded ${patterns.length} hunt patterns from database`)
    } catch (error: unknown) {
      logger.error('Failed to load hunt patterns:', { error })
    }
  }

  private async startHuntScheduler(): Promise<void> {
    setInterval(async () => {
      try {
        await this.checkScheduledHunts()
      } catch (error: unknown) {
        logger.error('Scheduled hunt check error:', { error })
      }
    }, 60000)
  }

  private async startMetricsCollection(): Promise<void> {
    setInterval(async () => {
      try {
        await this.collectMetrics()
      } catch (error: unknown) {
        logger.error('Metrics collection error:', { error })
      }
    }, 600000)
  }

  // ─── Hunt Execution (orchestrator) ────────────────────────────

  async executeHunt(query: HuntQuery): Promise<HuntResult> {
    try {
      logger.info('Executing threat hunt', {
        huntId: query.huntId,
        patternId: query.patternId,
        scope: query.scope,
      })

      const validatedQuery = await this.validateHuntQuery(query)
      const pattern = await this.selectHuntPattern(validatedQuery)
      const execution = await this.prepareHuntExecution(validatedQuery, pattern)

      const huntResults = await executeHuntByPattern(this.db, execution, pattern)
      const analyzedResults = await analyzeHuntResults(huntResults, pattern)
      const threats = await generateThreatIntelligence(analyzedResults, pattern, execution)

      execution.status = 'completed'
      execution.completedTime = new Date()
      await updateHuntExecution(this.db, execution)

      const huntResult: HuntResult = {
        resultId: `result_${execution.executionId}_${Date.now()}`,
        timestamp: toDate(execution.completedTime, execution.startTime),
        huntId: execution.huntId,
        executionId: execution.executionId,
        patternId: pattern.patternId,
        startTime: execution.startTime,
        endTime: execution.completedTime,
        status: 'completed',
        findings: analyzedResults.map((result) => mapToHuntFinding(result)),
        threatsDiscovered: threats.length,
        confidence: calculateOverallConfidence(analyzedResults),
        metadata: {
          executionTime:
            toDate(execution.completedTime).getTime() - toDate(execution.startTime).getTime(),
          dataSources: execution.dataSources,
          regions: execution.regions,
        },
      }

      await storeHuntResults(this.db, huntResult, threats)

      if (threats.length > 0) {
        await sendThreatNotifications(threats)
      }

      await integrateWithGlobalIntelligence(this.redis, threats)

      this.emit('hunt_completed', {
        huntId: huntResult.huntId,
        executionId: huntResult.executionId,
        threatsDiscovered: huntResult.threatsDiscovered,
        confidence: huntResult.confidence,
      })

      return huntResult
    } catch (error: unknown) {
      logger.error('Failed to execute threat hunt:', { error, huntId: query.huntId })
      this.emit('hunt_execution_error', { error, huntId: query.huntId })
      throw error
    }
  }

  private async validateHuntQuery(query: HuntQuery): Promise<HuntQuery> {
    try {
      if (!query.huntId) {
        throw new Error('Hunt ID is required')
      }
      if (!query.patternId && !query.customQuery) {
        throw new Error('Either patternId or customQuery must be provided')
      }
      if (query.scope?.length === 0) {
        throw new Error('Hunt scope cannot be empty')
      }

      if (query.timeRange) {
        const startTime = new Date(query.timeRange.startTime)
        const endTime = new Date(query.timeRange.endTime)
        if (startTime >= endTime) {
          throw new Error('Invalid time range: startTime must be before endTime')
        }
        if (endTime.getTime() - startTime.getTime() > 7 * 24 * 60 * 60 * 1000) {
          throw new Error('Time range cannot exceed 7 days')
        }
      }

      return {
        ...query,
        priority: query.priority ?? 'medium',
        timeout: query.timeout ?? 300000,
        maxResults: query.maxResults ?? 1000,
      }
    } catch (error: unknown) {
      logger.error('Hunt query validation failed:', { error })
      throw error
    }
  }

  private async selectHuntPattern(query: HuntQuery): Promise<HuntPattern> {
    try {
      if (query.customQuery) {
        return createCustomPattern(query)
      }
      if (!query.patternId) {
        throw new Error('Hunt pattern ID is required')
      }
      const pattern = this.huntPatterns.get(query.patternId)
      if (!pattern) {
        throw new Error(`Hunt pattern not found: ${query.patternId}`)
      }
      return pattern
    } catch (error: unknown) {
      logger.error('Failed to select hunt pattern:', { error })
      throw error
    }
  }

  private async prepareHuntExecution(
    query: HuntQuery,
    pattern: HuntPattern,
  ): Promise<HuntExecution> {
    try {
      const execution: HuntExecution = {
        executionId: generateExecutionId(),
        huntId: query.huntId,
        patternId: pattern.patternId,
        startTime: new Date(),
        status: 'preparing',
        scope: query.scope ?? ['global'],
        dataSources: determineDataSources(pattern, query),
        regions: query.regions ?? ['all'],
        parameters: query.parameters ?? {},
        metadata: {
          patternType: pattern.patternType,
          severity: pattern.severity,
          confidence: pattern.confidence,
        },
      }

      await storeHuntExecution(this.db, execution)
      this.activeHunts.set(execution.executionId, execution)
      return execution
    } catch (error: unknown) {
      logger.error('Failed to prepare hunt execution:', { error })
      throw error
    }
  }

  // ─── Scheduling ────────────────────────────────────────────────

  async scheduleHunt(schedule: HuntSchedule): Promise<string> {
    try {
      logger.info('Scheduling hunt', {
        scheduleId: schedule.scheduleId,
        patternId: schedule.patternId,
        frequency: schedule.frequency,
      })

      validateHuntSchedule(schedule)
      await this.storeHuntSchedule(schedule)

      const interval = calculateScheduleInterval(schedule.frequency)
      const timeout = setInterval(async () => {
        try {
          await this.executeScheduledHunt(schedule)
        } catch (error: unknown) {
          logger.error('Scheduled hunt execution failed:', { error, scheduleId: schedule.scheduleId })
        }
      }, interval)

      this.scheduledHunts.set(schedule.scheduleId, timeout)
      this.emit('hunt_scheduled', { scheduleId: schedule.scheduleId })
      return schedule.scheduleId
    } catch (error: unknown) {
      logger.error('Failed to schedule hunt:', { error })
      throw error
    }
  }

  private async storeHuntSchedule(schedule: HuntSchedule): Promise<void> {
    try {
      const schedulesCollection = this.getCollection<HuntSchedule>('hunt_schedules')
      await schedulesCollection.replaceOne(
        { scheduleId: schedule.scheduleId },
        schedule,
        { upsert: true },
      )
    } catch (error: unknown) {
      logger.error('Failed to store hunt schedule:', { error })
      throw error
    }
  }

  private async executeScheduledHunt(schedule: HuntSchedule): Promise<void> {
    try {
      logger.info('Executing scheduled hunt', { scheduleId: schedule.scheduleId })
      const huntQuery: HuntQuery = {
        huntId: `scheduled_${schedule.scheduleId}_${Date.now()}`,
        patternId: schedule.patternId,
        scope: schedule.scope,
        regions: schedule.regions,
        parameters: schedule.parameters,
        priority: 'medium',
      }
      await this.executeHunt(huntQuery)
    } catch (error: unknown) {
      logger.error('Scheduled hunt execution failed:', { error, scheduleId: schedule.scheduleId })
      throw error
    }
  }

  async cancelHunt(huntId: string): Promise<boolean> {
    try {
      logger.info('Cancelling hunt', { huntId })

      let executionToCancel: HuntExecution | null = null
      for (const [_executionId, execution] of this.activeHunts) {
        if (execution.huntId === huntId && execution.status === 'executing') {
          executionToCancel = execution
          break
        }
      }

      if (!executionToCancel) {
        logger.warn('No active hunt execution found to cancel', { huntId })
        return false
      }

      executionToCancel.status = 'cancelled'
      executionToCancel.completedTime = new Date()
      await updateHuntExecution(this.db, executionToCancel)
      this.activeHunts.delete(executionToCancel.executionId)
      this.emit('hunt_cancelled', { huntId, executionId: executionToCancel.executionId })
      return true
    } catch (error: unknown) {
      logger.error('Failed to cancel hunt:', { error, huntId })
      return false
    }
  }

  // ─── Query methods ─────────────────────────────────────────────

  async getHuntResults(huntId: string, limit: number = 100): Promise<HuntResult[]> {
    try {
      const resultsCollection = this.getCollection<HuntResult>('hunt_results')
      const results = await resultsCollection
        .find({ huntId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray()
      return results.map((result) => this.mapStoredDocument(result))
    } catch (error: unknown) {
      logger.error('Failed to get hunt results:', { error, huntId })
      throw error
    }
  }

  async getActiveHunts(): Promise<HuntExecution[]> {
    try {
      const executionsCollection = this.getCollection<HuntExecution>('hunt_executions')
      return await executionsCollection
        .find({ status: { $in: ['preparing', 'executing'] } })
        .sort({ startTime: -1 })
        .toArray()
    } catch (error: unknown) {
      logger.error('Failed to get active hunts:', { error })
      throw error
    }
  }

  async updateHuntPattern(pattern: HuntPattern): Promise<boolean> {
    try {
      logger.info('Updating hunt pattern', { patternId: pattern.patternId })
      validateHuntPattern(pattern)
      this.huntPatterns.set(pattern.patternId, pattern)

      const patternsCollection = this.getCollection<HuntPattern>('hunt_patterns')
      await patternsCollection.replaceOne({ patternId: pattern.patternId }, pattern, { upsert: true })
      this.emit('pattern_updated', { patternId: pattern.patternId })
      return true
    } catch (error: unknown) {
      logger.error('Failed to update hunt pattern:', { error })
      return false
    }
  }

  // ─── Metrics ───────────────────────────────────────────────────

  async getHuntMetrics(): Promise<HuntMetrics> {
    try {
      const executionsCollection = this.getCollection<HuntExecution>('hunt_executions')
      const threatsCollection = this.getCollection<GlobalThreatIntelligence>('discovered_threats')

      const [
        totalHunts,
        successfulHunts,
        averageExecutionTime,
        threatsDiscovered,
        falsePositives,
        huntsByType,
        huntsBySeverity,
      ] = await Promise.all([
        executionsCollection.countDocuments(),
        executionsCollection.countDocuments({ status: 'completed' }),
        this.calculateAverageExecutionTime(),
        threatsCollection.countDocuments(),
        this.calculateFalsePositives(),
        this.getHuntsByType(),
        this.getHuntsBySeverity(),
      ])

      return {
        totalHunts,
        successfulHunts,
        failedHunts: totalHunts - successfulHunts,
        averageExecutionTime,
        threatsDiscovered,
        falsePositives,
        huntByType: huntsByType,
        huntBySeverity: huntsBySeverity,
      }
    } catch (error: unknown) {
      logger.error('Failed to get hunt metrics:', { error })
      return {
        totalHunts: 0,
        successfulHunts: 0,
        failedHunts: 0,
        averageExecutionTime: 0,
        threatsDiscovered: 0,
        falsePositives: 0,
        huntByType: {},
        huntBySeverity: {},
      }
    }
  }

  private async calculateAverageExecutionTime(): Promise<number> {
    try {
      const executionsCollection = this.getCollection<HuntExecution>('hunt_executions')
      const completedExecutions = await executionsCollection
        .find({ status: 'completed', startTime: { $exists: true }, completedTime: { $exists: true } })
        .project({ startTime: 1, completedTime: 1 })
        .limit(100)
        .toArray()

      if (completedExecutions.length === 0) return 0

      let totalTime = 0
      for (const execution of completedExecutions) {
        const startTime = toDate(execution['startTime'])
        const completedTime = toDate(execution['completedTime'])
        totalTime += completedTime.getTime() - startTime.getTime()
      }
      return totalTime / completedExecutions.length
    } catch (error: unknown) {
      logger.error('Failed to calculate average execution time:', { error })
      return 0
    }
  }

  private async calculateFalsePositives(): Promise<number> {
    try {
      const resultsCollection = this.getCollection('hunt_results')
      return await resultsCollection.countDocuments({
        confidence: { $lt: 0.5 },
        timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      })
    } catch (error: unknown) {
      logger.error('Failed to calculate false positives:', { error })
      return 0
    }
  }

  private async getHuntsByType(): Promise<Record<string, number>> {
    try {
      const executionsCollection = this.getCollection<HuntExecution>('hunt_executions')
      const results = await executionsCollection
        .aggregate<PatternTypeCount>([
          { $group: { _id: '$metadata.patternType', count: { $sum: 1 } } },
          { $project: { patternType: '$_id', count: 1, _id: 0 } },
        ])
        .toArray()

      const huntsByType: Record<string, number> = {}
      for (const result of results) {
        huntsByType[result.patternType] = result.count
      }
      return huntsByType
    } catch (error: unknown) {
      logger.error('Failed to get hunts by type:', { error })
      return {}
    }
  }

  private async getHuntsBySeverity(): Promise<Record<string, number>> {
    try {
      const resultsCollection = this.getCollection('hunt_results')
      const results = await resultsCollection
        .aggregate<SeverityCount>([
          { $group: { _id: '$severity', count: { $sum: 1 } } },
          { $project: { severity: '$_id', count: 1, _id: 0 } },
        ])
        .toArray()

      const huntsBySeverity: Record<string, number> = {}
      for (const result of results) {
        huntsBySeverity[result.severity] = result.count
      }
      return huntsBySeverity
    } catch (error: unknown) {
      logger.error('Failed to get hunts by severity:', { error })
      return {}
    }
  }

  private async checkScheduledHunts(): Promise<void> {
    try {
      const schedulesCollection = this.getCollection<HuntSchedule>('hunt_schedules')
      const activeSchedules = await schedulesCollection.find({ enabled: true }).toArray()

      for (const schedule of activeSchedules) {
        if (await this.shouldExecuteScheduledHunt(schedule)) {
          await this.executeScheduledHunt(schedule)
        }
      }
    } catch (error: unknown) {
      logger.error('Scheduled hunt check failed:', { error })
    }
  }

  private async shouldExecuteScheduledHunt(schedule: HuntSchedule): Promise<boolean> {
    try {
      const now = new Date()
      const lastExecution = schedule.lastExecution ? new Date(schedule.lastExecution) : null

      if (!lastExecution) return true

      const interval = calculateScheduleInterval(schedule.frequency)
      return now.getTime() - lastExecution.getTime() >= interval
    } catch (error: unknown) {
      logger.error('Failed to check if scheduled hunt should execute:', { error })
      return false
    }
  }

  private async collectMetrics(): Promise<void> {
    try {
      const metrics = await this.getHuntMetrics()
      this.emit('metrics_collected', metrics)
    } catch (error: unknown) {
      logger.error('Metrics collection failed:', { error })
    }
  }

  // ─── Health ────────────────────────────────────────────────────

  async getHealthStatus(): Promise<HealthStatus> {
    try {
      const startTime = Date.now()

      const redisHealthy = await this.checkRedisHealth()
      if (!redisHealthy) {
        return { healthy: false, message: 'Redis connection failed' }
      }

      const mongodbHealthy = await this.checkMongoDBHealth()
      if (!mongodbHealthy) {
        return { healthy: false, message: 'MongoDB connection failed' }
      }

      const metrics = await this.getHuntMetrics()
      const successRate = metrics.totalHunts > 0
        ? (metrics.successfulHunts / metrics.totalHunts) * 100
        : 0

      return {
        healthy: true,
        message: 'Threat Hunting System is healthy',
        responseTime: Date.now() - startTime,
        activeHunts: this.activeHunts.size,
        successRate,
      }
    } catch (error: unknown) {
      logger.error('Health check failed:', { error })
      const message = error instanceof Error ? error.message : 'Unknown health check failure'
      return { healthy: false, message: `Health check failed: ${message}` }
    }
  }

  private async checkRedisHealth(): Promise<boolean> {
    try {
      await this.redis.ping()
      return true
    } catch (error: unknown) {
      logger.error('Redis health check failed:', { error })
      return false
    }
  }

  private async checkMongoDBHealth(): Promise<boolean> {
    try {
      await this.db.admin().ping()
      return true
    } catch (error: unknown) {
      logger.error('MongoDB health check failed:', { error })
      return false
    }
  }

  // ─── Shutdown ──────────────────────────────────────────────────

  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down Threat Hunting System')

      for (const [scheduleId, timeout] of this.scheduledHunts) {
        clearInterval(timeout)
        this.scheduledHunts.delete(scheduleId)
      }

      await this.mongoClient.close()
      await this.redis.quit()

      this.emit('hunting_system_shutdown')
      logger.info('Threat Hunting System shutdown completed')
    } catch (error: unknown) {
      logger.error('Error during shutdown:', { error })
      throw error
    }
  }
}
