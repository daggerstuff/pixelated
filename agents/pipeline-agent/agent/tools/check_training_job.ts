import { defineTool } from 'eve/tools'
import { z } from 'zod'

import { storeMemory } from '../foresight-client.js'
import { getTrainingJob } from '../lib/training-infra-client.js'

export default defineTool({
  description:
    'Poll a training-infra job by id. When the job has reached a terminal ' +
    'state (succeeded/failed/cancelled), record the outcome in Foresight ' +
    'memory (category=fact) for audit and downstream stages.',
  inputSchema: z.object({
    job_id: z.string().min(1),
  }),
  async execute(input: { job_id: string }) {
    const job = await getTrainingJob(input.job_id)
    const status = (job?.status as string) ?? 'unknown'
    const terminal = ['succeeded', 'failed', 'cancelled', 'completed'].includes(
      status,
    )
    let memoryId: string | null = null
    if (terminal && job) {
      const stored = await storeMemory({
        content: JSON.stringify({
          type: 'training_job_outcome',
          job_id: input.job_id,
          status,
          stage: job.stage ?? null,
          error: job.error ?? null,
          finished_at: job.finished_at ?? null,
        }),
        category: 'fact',
        scope: 'project',
        retention: 'long_term',
        importance: 0.8,
        tags: [
          'training_job_outcome',
          `job:${input.job_id}`,
          `status:${status}`,
        ],
      })
      memoryId = stored?.memory_id ?? null
    }
    return {
      job_id: input.job_id,
      status,
      stage: job?.stage ?? null,
      error: job?.error ?? null,
      terminal,
      finished_at: job?.finished_at ?? null,
      foresight_memory_id: memoryId,
      checked_at: new Date().toISOString(),
    }
  },
})
