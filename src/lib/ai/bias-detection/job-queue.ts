// Simple in-memory job queue and worker for background batch analysis
// Extendable to Redis-backed queue for production

export type JobStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

export interface Job<T = any, R = any> {
  id: string
  data: T
  status: JobStatus
  result?: R
  error?: string
  createdAt: number
  startedAt?: number
  finishedAt?: number
  progress?: number
}

export class JobQueue<T = any, R = any> {
  private jobs: Map<string, Job<T, R>> = new Map()
  private queue: string[] = []
  private processing = false

  submit(data: T): string {
    const id = Math.random().toString(36).slice(2) + Date.now()
    const job: Job<T, R> = {
      id,
      data,
      status: 'pending',
      createdAt: Date.now(),
      progress: 0,
    }
    this.jobs.set(id, job)
    this.queue.push(id)
    console.info(`[JobQueue] Job submitted`, {
      jobId: id,
      createdAt: job.createdAt,
    })
    this.processNext()
    return id
  }

  getJob(id: string): Job<T, R> | undefined {
    return this.jobs.get(id)
  }

  getAllJobs(): Job<T, R>[] {
    return Array.from(this.jobs.values())
  }

  /**
   * Get job metrics for monitoring/observability.
   * Returns counts by status, average duration, error rate.
   */
  getMetrics() {
    const jobs = Array.from(this.jobs.values())
    const statusCounts = jobs.reduce<Record<JobStatus, number>>(
      (acc, j) => {
        acc[j.status] = (acc[j.status] ?? 0) + 1
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

  private async processNext() {
    if (this.processing || this.queue.length === 0) {
      return
    }
    const id = this.queue.shift()!
    const job = this.jobs.get(id)
    if (!job) {
      return
    }

    try {
      // Job processing logic would go here
    } catch (_err: any) {
      console.error(`[JobQueue] Job failed`, {
        jobId: job.id,
        error: job.error,
        finishedAt: Date.now(),
      })
    }

    // Process next job in queue
    if (this.queue.length > 0) {
      this.processNext()
    }
  }
}
