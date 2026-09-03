/**
 * Background job queue for long-running analyses.
 */

import type { PerformanceOptimizerConfig, BackgroundJob } from './performance-optimizer.types'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'
const logger = createBuildSafeLogger('PerformanceOptimizer')

/**
 * Background Job Queue for Long-Running Tasks
 */
export class BackgroundJobQueue {
  private readonly jobs = new Map<string, BackgroundJob>()
  private workers: Array<Promise<void>> = []
  private readonly config: PerformanceOptimizerConfig['backgroundJobs']
  private isRunning = false

  constructor(config: PerformanceOptimizerConfig['backgroundJobs']) {
    this.config = config

    if (config.enabled) {
      this.start()
    }
  }

  /**
   * Add job to queue
   */
  async addJob(
    type: string,
    data: unknown,
    options: {
      priority?: number
      timeout?: number
      maxAttempts?: number
    } = {},
  ): Promise<string> {
    if (this.jobs.size >= this.config.queueMaxSize) {
      throw new Error('Job queue is full')
    }

    const job: BackgroundJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      type,
      data,
      priority: options.priority ?? 1,
      createdAt: new Date(),
      attempts: 0,
      maxAttempts: options.maxAttempts ?? 3,
      timeout: options.timeout ?? this.config.jobTimeout,
      status: 'pending',
    }

    this.jobs.set(job.id, job)
    logger.debug('Job added to queue', { jobId: job.id, type })

    return job.id
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): BackgroundJob | null {
    return this.jobs.get(jobId) ?? null
  }

  /**
   * Start background workers
   */
  private start(): void {
    if (this.isRunning) {
      return
    }

    this.isRunning = true

    for (let i = 0; i < this.config.maxWorkers; i++) {
      this.workers.push(this.worker())
    }

    logger.info('Background job queue started', {
      workers: this.config.maxWorkers,
    })
  }

  /**
   * Stop background workers
   */
  async stop(): Promise<void> {
    this.isRunning = false
    await Promise.all(this.workers)
    this.workers = []
    logger.info('Background job queue stopped')
  }

  private async worker(): Promise<void> {
    while (this.isRunning) {
      try {
        const job = this.getNextJob()

        if (!job) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
          continue
        }

        await this.processJob(job)
      } catch (error: unknown) {
        logger.error('Worker error', { error })
      }
    }
  }

  private getNextJob(): BackgroundJob | null {
    const pendingJobs = Array.from(this.jobs.values())
      .filter((job) => job.status === 'pending')
      .sort(
        (a, b) =>
          b.priority - a.priority ||
          a.createdAt.getTime() - b.createdAt.getTime(),
      )

    return pendingJobs[0] ?? null
  }

  private async processJob(job: BackgroundJob): Promise<void> {
    job.status = 'processing'
    job.attempts++

    try {
      // Simulate job processing - in production, this would dispatch to actual handlers
      await new Promise((resolve) => setTimeout(resolve, 100))

      job.status = 'completed'
      logger.debug('Job completed', { jobId: job.id })
    } catch (error: unknown) {
      logger.error('Job failed', { jobId: job.id, error })

      if (job.attempts >= job.maxAttempts) {
        job.status = 'failed'
      } else {
        job.status = 'pending'
        // Add delay before retry
        setTimeout(() => {}, this.config.retryDelay)
      }
    }
  }

  getStats() {
    const jobs = Array.from(this.jobs.values())

    return {
      total: jobs.length,
      pending: jobs.filter((j) => j.status === 'pending').length,
      processing: jobs.filter((j) => j.status === 'processing').length,
      completed: jobs.filter((j) => j.status === 'completed').length,
      failed: jobs.filter((j) => j.status === 'failed').length,
      workers: this.workers.length,
    }
  }
}
