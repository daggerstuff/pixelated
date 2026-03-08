// Redis-backed job queue for distributed, horizontally scalable batch analysis
import { createClient, RedisClientType } from 'redis'
import { Job, JobStatus } from './job-queue'

type JobHandler<T, R> = (
  data: T,
  update: (progress: number) => void,
) => Promise<R>

export class RedisJobQueue<T = any, R = any> {
  private redis: RedisClientType
  private handler: JobHandler<T, R>
  private queueKey: string
  private jobsKey: string
  private processing = false

  constructor(
    handler: JobHandler<T, R>,
    redisUrl: string,
    queueKey = 'bias:job:queue',
    jobsKey = 'bias:job:jobs',
  ) {
    this.handler = handler
    this.queueKey = queueKey
    this.jobsKey = jobsKey
    this.redis = createClient({ url: redisUrl })
    this.redis
      .connect()
      .then(() => {
        console.info('[RedisJobQueue] Connected to Redis')
      })
      .catch((err) => {
        console.error('[RedisJobQueue] Redis connection error', err)
      })
  }

  async submit(data: T): Promise<string> {
    const id = Math.random().toString(36).slice(2) + Date.now()
    const job: Job<T, R> = {
      id,
      data,
      status: 'pending',
      createdAt: Date.now(),
      progress: 0,
    }
    await this.redis.hSet(this.jobsKey, id, JSON.stringify(job))
    await this.redis.rPush(this.queueKey, id)
    console.info('[RedisJobQueue] Job submitted', {
      jobId: id,
      createdAt: job.createdAt,
    })
    this.processNext()
    return id
  }

  async getJob(id: string): Promise<Job<T, R> | undefined> {
    const jobStr = await this.redis.hGet(this.jobsKey, id)
    return jobStr ? JSON.parse(jobStr) : undefined
  }

  async getAllJobs(): Promise<Job<T, R>[]> {
    const jobs = await this.redis.hGetAll(this.jobsKey)
    return Object.values(jobs).map((j) => JSON.parse(j))
  }

  private async processNext() {
    if (this.processing) {
      return
    }
    this.processing = true
    try {
      const id = await this.redis.lPop(this.queueKey)
      if (!id) {
        this.processing = false
        return
      }
      let job = await this.getJob(id)
      if (!job) {
        this.processing = false
        return
      }
      job.status = 'in_progress'
      job.startedAt = Date.now()
      await this.redis.hSet(this.jobsKey, id, JSON.stringify(job))
      console.info('[RedisJobQueue] Job started', {
        jobId: job.id,
        startedAt: job.startedAt,
      })
      try {
        job.result = await this.handler(job.data, (progress) => {
          job.progress = progress
          this.redis.hSet(this.jobsKey, id, JSON.stringify(job))
          console.info('[RedisJobQueue] Job progress', {
            jobId: job.id,
            progress,
          })
        })
        job.status = 'completed'
        console.info('[RedisJobQueue] Job completed', {
          jobId: job.id,
          finishedAt: Date.now(),
        })
      } catch (err: any) {
        job.status = 'failed'
        job.error = err?.message || String(err)
        console.error('[RedisJobQueue] Job failed', {
          jobId: job.id,
          error: job.error,
          finishedAt: Date.now(),
        })
      }
      job.finishedAt = Date.now()
      await this.redis.hSet(this.jobsKey, id, JSON.stringify(job))
    } finally {
      this.processing = false
      // Allow distributed workers to process jobs independently
      setTimeout(() => this.processNext(), 0)
    }
  }

  /**
   * Get job metrics for monitoring/observability.
   * Returns counts by status, average duration, error rate.
   */
  async getMetrics() {
    const jobs = await this.getAllJobs()
    const statusCounts = jobs.reduce<Record<JobStatus, number>>(
      (acc, job) => {
        acc[job.status] = (acc[job.status] || 0) + 1
        return acc
      },
      { pending: 0, in_progress: 0, completed: 0, failed: 0 },
    )
    const completedJobs = jobs.filter(
      (j) => j.status === 'completed' && j.finishedAt && j.startedAt,
    )
    const avgDuration =
      completedJobs.length > 0
        ? completedJobs.reduce(
            (sum, j) => sum + (j.finishedAt! - j.startedAt! || 0),
            0,
          ) / completedJobs.length
        : 0
    const errorCount = jobs.filter((j) => j.status === 'failed').length
    const total = jobs.length
    return {
      statusCounts,
      avgDuration,
      errorRate: total > 0 ? errorCount / total : 0,
      total,
    }
  }
}
