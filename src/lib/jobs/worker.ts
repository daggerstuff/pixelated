/**
 * Background Jobs Worker for Pixelated Empathy
 *
 * This worker processes jobs from the Redis-backed queue,
 * offloading long-running tasks like batch bias analysis.
 */

import { jobQueue, JobStatus, type Job } from './queue'
import { BiasDetectionEngine } from '../ai/bias-detection/BiasDetectionEngine'
import { createBuildSafeLogger } from '../logging/build-safe-logger'
import type { TherapeuticSession, BiasReport } from '../ai/bias-detection/types'
import { gaugeMetric, distributionMetric, countMetric } from '../sentry/utils'

const logger = createBuildSafeLogger('JobsWorker')

// Define interfaces for job payloads
// TherapeuticSession type is now imported from bias-detection/types

interface User {
  id: string
  name: string
  role: string
  metadata: Record<string, unknown>
}

interface RequestInfo {
  id: string
  timestamp: string
  source: string
  metadata: Record<string, unknown>
}

interface TimeRange {
  start: string
  end: string
}

interface ReportOptions {
  format: string
  includeDetails: boolean
  groupBy?: string
  filters?: Record<string, unknown>
}

// Initialize BiasDetectionEngine (singleton)
const biasDetectionEngine = new BiasDetectionEngine()

// Ensure the engine is initialized before processing jobs
async function initializeEngine() {
  if (!biasDetectionEngine.getInitializationStatus()) {
    await biasDetectionEngine.initialize()
  }
}

const WORKER_INTERVAL_MS = 5000 // Check for new jobs every 5 seconds
const MAX_CONCURRENT_JOBS = 2 // Limit concurrent long-running jobs
let processingJobs = false

let activeJobs = 0
let workerInterval: NodeJS.Timeout | undefined

const jobsWorker = {
  async start() {
    logger.info('Background Jobs Worker starting...')
    await initializeEngine()

    workerInterval = setInterval(() => {
      this.processJobs().catch((err) => logger.error('processJobs error', err))
    }, WORKER_INTERVAL_MS)

    logger.info('Background Jobs Worker started successfully.')
  },

  async stop() {
    logger.info('Background Jobs Worker shutting down...')
    if (workerInterval) {
      clearInterval(workerInterval)
    }
    await biasDetectionEngine.dispose()
    logger.info('Background Jobs Worker stopped.')
    process.exit(0)
  },

  async processJobs() {
    if (processingJobs) {
      logger.debug('processJobs is already running.')
      return
    }
    processingJobs = true
    try {
      // Track active jobs gauge
      gaugeMetric('jobs.active_count', activeJobs, { worker: 'background' })

      if (activeJobs >= MAX_CONCURRENT_JOBS) {
        logger.debug('Max concurrent jobs reached, waiting...')
        return
      }
      const job = await jobQueue.dequeue()
      if (job) {
        activeJobs++
        countMetric('jobs.dequeued', 1, { job_type: job.type })
        logger.info('Processing new job', { jobId: job.id, type: job.type })
        this.executeJob(job)
          .then(() => {
            activeJobs--
            countMetric('jobs.completed', 1, { job_type: job.type })
            logger.info('Job finished', { jobId: job.id, type: job.type })
          })
          .catch((error) => {
            activeJobs--
            const errorType = error instanceof Error ? error.constructor.name : 'UnknownError'
            countMetric('jobs.failed', 1, {
              job_type: job.type,
              error_type: errorType,
            })
            logger.error('Job execution failed', {
              jobId: job.id,
              type: job.type,
              error,
            })
          })
      } else {
        logger.debug('No jobs in queue.')
      }
    } finally {
      processingJobs = false
    }
  },

  async executeJob(job: Job): Promise<void> {
    const jobStartTime = Date.now()
    try {
      await jobQueue.updateJobStatus(job.id, JobStatus.IN_PROGRESS, {
        startedAt: new Date().toISOString(),
      })

      // Declare variables outside of case blocks to avoid no-case-declarations issues
      let sessions: TherapeuticSession[] = []
      let user: User | undefined
      let request: RequestInfo | undefined
      let timeRange: TimeRange | undefined
      let options: ReportOptions | undefined
      let results: PromiseSettledResult<unknown>[] = []
      let report: BiasReport | undefined

      switch (job.type) {
        case 'bias-analysis-batch':
          // Payload contains sessions, user, and request information
          ; ({ sessions, user, request } = job.payload as {
            sessions: TherapeuticSession[]
            user: User
            request: RequestInfo
          })
          const batchStartTime = Date.now()
          results = await biasDetectionEngine.analyzeSessionsBatch(
            sessions,
            user,
            {
              ipAddress:
                typeof request?.metadata?.['ipAddress'] === 'string'
                  ? request.metadata['ipAddress']
                  : '',
              userAgent:
                typeof request?.metadata?.['userAgent'] === 'string'
                  ? request.metadata['userAgent']
                  : '',
            },
          )
          const batchDurationMs = Date.now() - batchStartTime
          distributionMetric('jobs.bias_analysis_batch.duration', batchDurationMs, {
            attributes: { session_count: sessions.length },
            unit: 'millisecond',
          })
          await jobQueue.updateJobStatus(job.id, JobStatus.COMPLETED, {
            result: results,
            completedAt: new Date().toISOString(),
          })
          break
        case 'report-generation': {
          // Payload contains sessions, timeRange, and options
          ; ({ sessions, timeRange, options } = job.payload as {
            sessions: TherapeuticSession[]
            timeRange: TimeRange
            options: ReportOptions
          })
          // restrict options.format to allowed values
          const allowedFormats: ReadonlyArray<unknown> = ['json', 'csv', 'pdf']
          const safeFormat = allowedFormats.includes(options?.format as unknown)
            ? (options.format as 'json' | 'csv' | 'pdf')
            : undefined
          const safeOptions = { ...options, format: safeFormat }
          const reportStartTime = Date.now()
          report = await biasDetectionEngine.generateBiasReport(
            sessions,
            {
              start: new Date(timeRange.start),
              end: new Date(timeRange.end),
            },
            safeOptions,
          )
          const reportDurationMs = Date.now() - reportStartTime
          distributionMetric('jobs.report_generation.duration', reportDurationMs, {
            attributes: { format: safeOptions?.format || 'json' },
            unit: 'millisecond',
          })
          await jobQueue.updateJobStatus(job.id, JobStatus.COMPLETED, {
            result: report,
            completedAt: new Date().toISOString(),
          })
          break
        }
        // TODO: Add other job types as needed (e.g., data-cleanup, metric-aggregation)
        default:
          throw new Error(`Unknown job type: ${job.type}`)
      }

      // Track total job duration
      const totalDurationMs = Date.now() - jobStartTime
      distributionMetric('jobs.duration', totalDurationMs, {
        attributes: { job_type: job.type },
        unit: 'millisecond',
      })
    } catch (error: unknown) {
      const durationMs = Date.now() - jobStartTime
      const errorType = error instanceof Error ? error.constructor.name : 'UnknownError'
      countMetric('jobs.error', 1, {
        job_type: job.type,
        error_type: errorType,
      })
      distributionMetric('jobs.duration', durationMs, {
        attributes: { job_type: job.type, status: 'failed' },
        unit: 'millisecond',
      })
      await jobQueue.updateJobStatus(job.id, JobStatus.FAILED, {
        error: error instanceof Error ? String(error) : String(error),
        completedAt: new Date().toISOString(),
      })
    }
  },
}

// Graceful shutdown
process.on('SIGTERM', () => jobsWorker.stop())
process.on('SIGINT', () => jobsWorker.stop())

// Start worker
jobsWorker.start().catch((error) => {
  logger.error('Failed to start background jobs worker:', error)
  process.exit(1)
})
