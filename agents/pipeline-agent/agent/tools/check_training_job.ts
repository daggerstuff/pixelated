import { defineTool } from 'eve/tools'
import { z } from 'zod'

import { searchMemories, storeMemory } from '../foresight-client.js'
import { getTrainingJob } from '../lib/training-infra-client.js'

/**
 * The runner's terminal set (ai/training/mcp/runner.py TERMINAL_STATUSES).
 * `completed` is deliberately absent: it is not a status the control plane
 * ever writes, so treating it as terminal would let this tool declare a
 * still-running job finished.
 */
const TERMINAL_STATUSES = ['succeeded', 'failed', 'cancelled'] as const

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
    const terminal = (TERMINAL_STATUSES as readonly string[]).includes(status)
    let memoryId: string | null = null
    let alreadyRecorded = false
    if (terminal && job) {
      // The MCP server already writes this outcome on the terminal transition
      // (ai/training/mcp/runner.py _record_terminal_outcome). Writing again
      // here would duplicate the provenance row, so reuse the existing memory
      // when the server got there first.
      const existing = await searchMemories({
        query: `job:${input.job_id}`,
        limit: 5,
        min_importance: 0.1,
      })
      const found = (existing ?? []).find(
        (m) => typeof m.memory_id === 'string' && m.content?.includes(input.job_id),
      )
      if (found?.memory_id) {
        alreadyRecorded = true
        memoryId = found.memory_id
      } else {
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
    }
    return {
      job_id: input.job_id,
      status,
      stage: job?.stage ?? null,
      error: job?.error ?? null,
      terminal,
      finished_at: job?.finished_at ?? null,
      foresight_memory_id: memoryId,
      foresight_memory_already_present: alreadyRecorded,
      checked_at: new Date().toISOString(),
    }
  },
})
