import { defineTool } from 'eve/tools'
import { z } from 'zod'

import { storeMemory } from '../foresight-client.js'

const TRAINEE_STATUSES = ['ACTIVE', 'PAUSED', 'SUSPENDED', 'WITHDRAWN'] as const

const SCHEMA = z.object({
  trainee_id: z.string().uuid().describe('UUID of the trainee.'),
  new_status: z.enum(TRAINEE_STATUSES).describe('New status for the trainee.'),
  reason: z.string().min(1).max(500).describe('Reason for the status change.'),
})

export default defineTool({
  description:
    'Change a trainee's enrollment status (ACTIVE, PAUSED, SUSPENDED, WITHDRAWN). ' +
    'PAUSED prevents new session assignments. WITHDRAWN ends all active enrollments. ' +
    'All changes are logged to Foresight with long_term retention for audit trail.',
  inputSchema: SCHEMA,
  async execute(input: z.infer<typeof SCHEMA>) {
    const changedAt = new Date().toISOString()

    const changeRecord = {
      type: 'trainee_status_change',
      trainee_id: input.trainee_id,
      previous_status: null as string | null,
      new_status: input.new_status,
      reason: input.reason,
      changed_by: 'supervisor-agent',
      changed_at: changedAt,
    }

    // Fetch current status
    const currentMemories = await searchMemoriesViaModule({
      query: `trainee:${input.trainee_id} intake`,
      limit: 5,
      tag_filter: [`trainee:${input.trainee_id}`],
    })

    for (const m of currentMemories ?? []) {
      try {
        const parsed = JSON.parse(m.content) as {
          type?: string
          status?: string
        }
        if (parsed.type === 'trainee_profile') {
          changeRecord.previous_status = parsed.status ?? 'UNKNOWN'
        }
      } catch { /* skip */ }
    }

    const stored = await storeMemory({
      content: JSON.stringify(changeRecord),
      category: 'trainee_status',
      scope: 'trainee',
      retention: 'long_term',
      importance: 0.9,
      tags: [
        `trainee:${input.trainee_id}`,
        'supervisor_action',
        `status_change:${input.new_status}`,
      ],
    })

    return {
      trainee_id: input.trainee_id,
      previous_status: changeRecord.previous_status,
      new_status: input.new_status,
      reason: input.reason,
      changed_at: changedAt,
      foresight_memory: stored ?? {
        memory_id: null,
        note: 'Foresight MCP write may have failed.',
      },
    }
  },
})

// Inline helper to avoid circular dependency if foresight-client is refactored
async function searchMemoriesViaModule(params: {
  query: string
  limit: number
  tag_filter: string[]
}) {
  const { searchMemories: search } = await import('../foresight-client.js')
  return search(params)
}
