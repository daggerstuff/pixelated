/**
 * Job Queue Service for Pixelated Empathy Background Tasks
 *
 * This service provides a Redis-backed job queue for asynchronous processing
 * of long-running tasks such as batch bias analysis, report generation, etc.
 */

import { redis } from '../../lib/services/redis'
import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { v4 as uuidv4 } from 'uuid'

const logger = createBuildSafeLogger('JobQueueService')

export enum JobStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface Job<T = unknown> {
  id: string
  type: string
  payload: T
  status: JobStatus
  createdAt: string
  updatedAt: string
  startedAt?: string
  completedAt?: string
  progress?: number // 0-100
  result?: unknown
  error?: string
  metadata?: Record<string, unknown>
}

export interface EnqueueOptions {
  priority?: number // Higher number means higher priority
  delay?: number // Delay in milliseconds before job becomes available
  metadata?: Record<string, unknown>
}

export class JobQueueService {
  private static instance: JobQueueService
  private queueKey = 'jobs:queue'
  private processingKey = 'jobs:processing'
  private completedKey = 'jobs:completed'
  private failedKey = 'jobs:failed'
  private jobStatusKeyPrefix = 'job:status:'

  private constructor() {
    logger.info('JobQueueService initialized')
  }

  static getInstance(): JobQueueService {
    if (!JobQueueService.instance) {
      JobQueueService.instance = new JobQueueService()
    }
    return JobQueueService.instance
  }

  /**
   * Enqueue a new job
   */
  async enqueue<T>(
    type: string,
    payload: T,
    options?: EnqueueOptions,
  ): Promise<Job<T>> {
    const job: Job<T> = {
      id: uuidv4(),
      type,
      payload,
      status: JobStatus.PENDING,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(options?.metadata && { metadata: options.metadata }),
    }

    const jobString = JSON.stringify(job)
    const score = options?.priority || 0 // For sorted set, higher score = higher priority

    if (options?.delay) {
      // Schedule job to be added to queue after delay
      await redis.zadd(this.queueKey, Date.now() + options.delay, jobString)
      logger.info('Job enqueued with delay', {
        jobId: job.id,
        type: job.type,
        delay: options.delay,
      })
    } else {
      await redis.zadd(this.queueKey, score, jobString)
      logger.info('Job enqueued', {
        jobId: job.id,
        type: job.type,
        priority: score,
      })
    }

    await this.updateJobStatus(job.id, JobStatus.PENDING, job)

    return job
  }

  /**
   * Dequeue a job for processing
   * Returns the highest priority job (highest score in sorted set)
   */
  async dequeue(): Promise<Job | null> {
    // Atomically move job from queue to processing list
    const jobString = await redis.zpopmin(this.queueKey)

    if (!jobString || jobString.length === 0 || !jobString[0]) {
      return null
    }

    const job: Job = JSON.parse(jobString[0].value) as unknown
    job.status = JobStatus.IN_PROGRESS
    job.startedAt = new Date().toISOString()
    job.updatedAt = new Date().toISOString()

    await redis.hset(this.processingKey, job.id, JSON.stringify(job))
    await this.updateJobStatus(job.id, JobStatus.IN_PROGRESS, job)

    logger.info('Job dequeued', { jobId: job.id, type: job.type })
    return job
  }

  /**
   * Update job status and store in appropriate list
   */
  async updateJobStatus(
    jobId: string,
    status: JobStatus,
    updates?: Partial<Job>,
  ): Promise<void> {
    const currentJobString = await redis.hget(
      this.jobStatusKeyPrefix + jobId,
      jobId,
    )
    let job: Job

    if (currentJobString) {
      job = {
        ...(JSON.parse(currentJobString) as unknown),
        ...updates,
        status,
        updatedAt: new Date().toISOString(),
      }
    } else if (updates && updates.type && updates.payload) {
      // If job doesn't exist in status, but we have enough info to create it (e.g., from enqueue)
      job = {
        id: jobId,
        type: updates.type,
        payload: updates.payload,
        status,
        createdAt: updates.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...updates,
      } as Job
    } else {
      logger.warn(
        'Attempted to update status for non-existent job without full details',
        { jobId, status, updates },
      )
      return
    }

    await redis.hset(
      this.jobStatusKeyPrefix + jobId,
      jobId,
      JSON.stringify(job),
    )

    // Move job between processing/completed/failed lists
    await redis.hdel(this.processingKey, jobId)

    switch (status) {
      case JobStatus.COMPLETED:
        await redis.hset(this.completedKey, jobId, JSON.stringify(job))
        logger.info('Job completed', { jobId, type: job.type })
        break
      case JobStatus.FAILED:
        await redis.hset(this.failedKey, jobId, JSON.stringify(job))
        logger.warn('Job failed', { jobId, type: job.type, error: job.error })
        break
      case JobStatus.CANCELLED:
        await redis.hset(this.failedKey, jobId, JSON.stringify(job)) // Store cancelled in failed for review
        logger.info('Job cancelled', { jobId, type: job.type })
        break
      default:
        // For PENDING and IN_PROGRESS, it remains in the status hash and potentially processing list
        break
    }
  }

  /**
   * Get job status by ID
   */
  async getJobStatus(jobId: string): Promise<Job | null> {
    const jobString = await redis.hget(this.jobStatusKeyPrefix + jobId, jobId)
    return jobString ? (JSON.parse(jobString) as unknown) : null
  }

  /**
   * Get all jobs in a specific status (e.g., PENDING, IN_PROGRESS, COMPLETED, FAILED)
   */
  async getJobsByStatus(status: JobStatus): Promise<Job[]> {
    let jobStrings: string[] = []
    switch (status) {
      case JobStatus.PENDING: {
        // ZRANGE returns members in ascending order by score. We want highest priority first.
        const pendingJobsWithScores = await redis.zrange(
          this.queueKey,
          0,
          -1,
          'WITHSCORES',
        )
        jobStrings = pendingJobsWithScores.map((item) => {
          if (typeof item === 'object' && item !== null && 'value' in item) {
            return item.value
          }
          throw new Error('Invalid job data structure')
        })
        break
      }
      case JobStatus.IN_PROGRESS:
        jobStrings = Object.values(await redis.hgetall(this.processingKey))
        break
      case JobStatus.COMPLETED:
        jobStrings = Object.values(await redis.hgetall(this.completedKey))
        break
      case JobStatus.FAILED:
        jobStrings = Object.values(await redis.hgetall(this.failedKey))
        break
      case JobStatus.CANCELLED:
        // Cancelled jobs are currently stored in failedKey
        jobStrings = Object.values(await redis.hgetall(this.failedKey))
        jobStrings = jobStrings.filter(
          (jobStr) =>
            (JSON.parse(jobStr) as unknown.status) === JobStatus.CANCELLED,
        )
        break
      default:
        return []
    }
    return jobStrings.map((jobString) => JSON.parse(jobString) as unknown)
  }

  /**
   * Get all job IDs in a specific status
   */
  async getJobIdsByStatus(status: JobStatus): Promise<string[]> {
    let jobIds: string[] = []
    switch (status) {
      case JobStatus.PENDING: {
        const pendingJobs = await redis.zrange(this.queueKey, 0, -1)
        jobIds = pendingJobs.map((jobStr) => {
          const job = JSON.parse(jobStr) as unknown as Job
          return job.id
        })
        break
      }
      case JobStatus.IN_PROGRESS:
        jobIds = Object.keys(await redis.hgetall(this.processingKey))
        break
      case JobStatus.COMPLETED:
        jobIds = Object.keys(await redis.hgetall(this.completedKey))
        break
      case JobStatus.FAILED:
        jobIds = Object.keys(await redis.hgetall(this.failedKey))
        break
      case JobStatus.CANCELLED: {
        const cancelledJobs = Object.values(await redis.hgetall(this.failedKey))
        jobIds = cancelledJobs
          .filter(
            (jobStr: string) =>
              (JSON.parse(jobStr) as unknown.status) === JobStatus.CANCELLED,
          )
          .map((jobStr: string) => JSON.parse(jobStr) as unknown.id)
        break
      }
      default:
        return []
    }
    return jobIds
  }

  /**
   * Clear all jobs from all lists (for testing/cleanup)
   */
  async clearAllJobs(): Promise<void> {
    await redis.del(this.queueKey)
    await redis.del(this.processingKey)
    await redis.del(this.completedKey)
    await redis.del(this.failedKey)
    // Also delete individual job status keys
    const allJobStatusKeys = await redis.keys(`${this.jobStatusKeyPrefix}*`)
    if (allJobStatusKeys.length > 0) {
      for (const key of allJobStatusKeys) {
        await redis.del(key)
      }
    }
    logger.info('All jobs cleared from queue and status records')
  }

  /**
   * Remove a job from all queues/status records by ID
   */
  async removeJob(jobId: string): Promise<void> {
    await redis.zrem(this.queueKey, jobId) // Attempt to remove from pending
    await redis.hdel(this.processingKey, jobId)
    await redis.hdel(this.completedKey, jobId)
    await redis.hdel(this.failedKey, jobId)
    await redis.del(this.jobStatusKeyPrefix + jobId)
    logger.info('Job removed', { jobId })
  }

  /**
   * Get counts of jobs by status
   */
  async getJobCounts(): Promise<Record<JobStatus, number>> {
    const [pending, inProgress, completed, failed] = await Promise.all([
      redis.zcard(this.queueKey),
      redis.hlen(this.processingKey),
      redis.hlen(this.completedKey),
      redis.hlen(this.failedKey),
    ])

    // Need to filter failedKey for actual cancelled jobs if they are stored there
    const allFailedJobs = Object.values(await redis.hgetall(this.failedKey))
    const cancelledCount = allFailedJobs.filter((jobStr) => {
      const job = JSON.parse(jobStr) as unknown as Job
      return job.status === JobStatus.CANCELLED
    }).length
    const actualFailedCount = failed - cancelledCount

    return {
      [JobStatus.PENDING]: pending,
      [JobStatus.IN_PROGRESS]: inProgress,
      [JobStatus.COMPLETED]: completed,
      [JobStatus.FAILED]: actualFailedCount,
      [JobStatus.CANCELLED]: cancelledCount,
    }
  }
}

export const jobQueue = JobQueueService.getInstance()
