import * as cron from 'node-cron'

import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
// Assuming the evidence collector will be created at this path
// and has the specified interface
import { EvidenceCollector } from '@/lib/memory/evidence-collector'
import {
  createEngine,
  ReprioritizationReport,
  EvidencePoint,
} from '@/lib/memory/reprioritization_engine'
import { RedisService } from '@/lib/services/redis/RedisService'

const logger = createBuildSafeLogger('reprioritization-scheduler')

export interface ReprioritizationSchedulerConfig {
  /** Cron expression for reprioritization scheduling (default: nightly at 2 AM) */
  cronExpression: string
  /** Base URL of the evidence collector API */
  evidenceCollectorUrl: string
  /** Timeout in ms for each evidence collection request */
  requestTimeoutMs: number
  /** Whether the scheduler starts automatically */
  autoStart: boolean
}

const DEFAULT_CONFIG: ReprioritizationSchedulerConfig = {
  cronExpression: process.env['REPRIORITIZATION_SCHEDULE'] ?? '0 2 * * *',
  evidenceCollectorUrl:
    process.env['REPRIORITIZATION_URL'] ?? 'http://localhost:5000',
  requestTimeoutMs: 300_000,
  autoStart: true,
}

export interface EvidenceCollectorConfig {
  collectionWindowDays: number
  minConfidence: number
  includeResolved: boolean
}

const DEFAULT_EVIDENCE_CONFIG: EvidenceCollectorConfig = {
  collectionWindowDays: 7,
  minConfidence: 0.5,
  includeResolved: false,
}

export class ReprioritizationScheduler {
  private task: cron.ScheduledTask | null = null
  private readonly config: ReprioritizationSchedulerConfig
  private isRunning = false
  private latestReport: ReprioritizationReport | null = null
  private readonly evidenceCollector: EvidenceCollector
  private readonly reprioritizationEngine: ReturnType<typeof createEngine>
  private readonly redisService: RedisService

  constructor(config: Partial<ReprioritizationSchedulerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.evidenceCollector = new EvidenceCollector(DEFAULT_EVIDENCE_CONFIG)
    this.reprioritizationEngine = createEngine()
    this.redisService = new RedisService()
  }

  /**
   * Start the scheduled reprioritization.
   * Validates the cron expression and begins the schedule.
   */
  start(): void {
    if (this.task) {
      logger.warn('Reprioritization scheduler already running')
      return
    }

    if (!cron.validate(this.config.cronExpression)) {
      logger.error('Invalid cron expression', {
        expression: this.config.cronExpression,
      })
      return
    }

    this.task = cron.schedule(this.config.cronExpression, () => {
      this.executeCycle().catch((err) => {
        logger.error('Reprioritization cycle failed', { error: err })
      })
    })

    logger.info('Reprioritization scheduler started', {
      cronExpression: this.config.cronExpression,
      evidenceCollectorUrl: this.config.evidenceCollectorUrl,
    })

    // Start automatically if configured
    if (this.config.autoStart) {
      // Already started by the schedule above
    }
  }

  /**
   * Stop the scheduler and cancel any pending execution.
   */
  stop(): void {
    if (this.task) {
      this.task.stop()
      this.task = null
    }
    this.isRunning = false

    // Disconnect from Redis and ignore any errors during shutdown
    try {
      this.redisService.disconnect().catch(() => {})
    } catch (e) {
      // Ignore errors during disconnect
    }

    logger.info('Reprioritization scheduler stopped')
  }

  /**
   * Run a single reprioritization cycle immediately, outside the cron schedule.
   * Useful for manual triggering or testing.
   */
  async triggerRun(): Promise<ReprioritizationReport> {
    return this.executeCycle()
  }

  /**
   * Get the most recent reprioritization report.
   */
  getLatestReport(): ReprioritizationReport | null {
    return this.latestReport
  }

  /**
   * Whether the scheduler task is currently active.
   */
  get active(): boolean {
    return this.task !== null
  }

  // ------------------------------------------------------------------
  // Internal
  // ------------------------------------------------------------------

  private async executeCycle(): Promise<ReprioritizationReport> {
    if (this.isRunning) {
      logger.warn('Reprioritization cycle already in progress — skipping')
      // Return the last report if available, otherwise create a minimal one
      return (
        this.latestReport ?? {
          runId: 'skipped',
          timestamp: new Date().toISOString(),
          evidenceSourcesConsumed: 0,
          totalEvidencePoints: 0,
          actionablePatterns: 0,
          backlogItemsCreated: 0,
          backlogItemsReprioritized: 0,
          priorityChanges: [],
          newBacklogItems: [],
          reprioritizedItems: [],
          unchangedItems: [],
          byDomain: {},
        }
      )
    }

    this.isRunning = true
    const startTime = Date.now()

    try {
      logger.info('Starting reprioritization cycle')

      // Step 1: Collect evidence
      const evidencePoints = await this.collectEvidence()

      // Step 2: Load evidence into the engine
      const feedbackDict = this.transformEvidenceToFeedbackDict(evidencePoints)
      this.reprioritizationEngine.loadFeedbackDict(feedbackDict)

      // Step 3: Run the reprioritization engine
      const report = await this.reprioritizationEngine.runReprioritization()

      // Step 4: Store the report
      await this.storeReport(report)

      // Update latest report
      this.latestReport = report

      logger.info('Reprioritization cycle completed', {
        runId: report.runId,
        evidenceSourcesConsumed: report.evidenceSourcesConsumed,
        totalEvidencePoints: report.totalEvidencePoints,
        actionablePatterns: report.actionablePatterns,
        backlogItemsCreated: report.backlogItemsCreated,
        backlogItemsReprioritized: report.backlogItemsReprioritized,
      })

      return report
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('Reprioritization cycle error', { error: message })
      throw err
    } finally {
      this.isRunning = false
      const durationMs = Date.now() - startTime
      logger.info('Reprioritization cycle finished', {
        durationMs,
      })
    }
  }

  private async collectEvidence(): Promise<EvidencePoint[]> {
    try {
      // The evidence collector is expected to have a collectAll() method
      // that returns EvidencePoint[] as specified in the task description
      return await this.evidenceCollector.collectAll()
    } catch (err) {
      logger.error('Failed to collect evidence', { error: err })
      throw err
    }
  }

  private transformEvidenceToFeedbackDict(
    evidencePoints: EvidencePoint[],
  ): Record<string, unknown> {
    // Transform evidence points to the format expected by loadFeedbackDict
    // Based on the engine's parseFeedbackReport method, it expects:
    // {
    //   failure_patterns: [
    //     {
    //       pattern_id: string,
    //       pattern_type: string,
    //       description: string,
    //       frequency: number,
    //     }
    //   ],
    //   upstream_mappings: [
    //     {
    //       failure_pattern: { pattern_id: string },
    //       upstream_domain: string,
    //       confidence: number,
    //       root_cause_hypothesis: string,
    //     }
    //   ]
    // }

    const failurePatterns = evidencePoints.map((point) => ({
      pattern_id: point.patternId,
      pattern_type: point.patternType,
      description: point.description,
      frequency: point.frequency,
    }))

    const upstreamMappings = evidencePoints.map((point) => ({
      failure_pattern: { pattern_id: point.patternId },
      upstream_domain: point.domain,
      confidence: point.confidence,
      root_cause_hypothesis: point.rootCauseHypothesis,
    }))

    return {
      failure_patterns: failurePatterns,
      upstream_mappings: upstreamMappings,
    }
  }

  private async storeReport(report: ReprioritizationReport): Promise<void> {
    try {
      // Store the report in Redis with a 24-hour TTL
      await this.redisService.set(
        `reprioritization:report:${report.runId}`,
        JSON.stringify(report),
        24 * 60 * 60 * 1000,
      )

      // Also store as the latest report
      await this.redisService.set(
        'reprioritization:report:latest',
        JSON.stringify(report),
        24 * 60 * 60 * 1000,
      )

      logger.info('Stored reprioritization report in Redis', {
        runId: report.runId,
        timestamp: report.timestamp,
      })
    } catch (err) {
      logger.error('Failed to store reprioritization report in Redis', {
        error: err,
      })
      // Don't throw here as we don't want storage failures to fail the cycle
      // We'll still keep the latest report in memory
    }
  }
}
