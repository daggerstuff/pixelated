import { defineTool } from 'eve/tools'
import { z } from 'zod'

import { storeMemory } from '../foresight-client.js'

// Promote a concerning QA finding into a tracked review item for human
// review. Stores the flag in Foresight memory for longitudinal tracking
// and returns a ticket identifier. When the Linear channel is wired,
// this also creates a real Linear issue.

interface FlagGapInput {
  session_id: string
  cohort_id: string
  rationale: string
  priority: number
  labels: string[]
}

export default defineTool({
  description:
    'Create or update a review ticket for a session that needs ' +
    'human attention. Persists the flag in Foresight memory and returns ' +
    'a ticket identifier with a back-link to the originating session.',
  inputSchema: z.object({
    session_id: z.string().uuid(),
    cohort_id: z.string().min(1),
    rationale: z.string().max(2000),
    priority: z.number().int().min(0).max(4),
    labels: z.array(z.string()).default([]),
  }),
  async execute(input: FlagGapInput) {
    const identifier = `QA-${Date.now().toString(36).toUpperCase()}`

    // Persist the flag in Foresight for longitudinal tracking
    await storeMemory({
      content: JSON.stringify({
        type: 'training_gap_flag',
        ticket_identifier: identifier,
        session_id: input.session_id,
        cohort_id: input.cohort_id,
        rationale: input.rationale,
        priority: input.priority,
        labels: input.labels,
        created_at: new Date().toISOString(),
      }),
      category: 'qa_review',
      scope: 'cohort',
      retention: 'long_term',
      importance: 0.7 + input.priority * 0.075,
      tags: ['training_gap', `cohort:${input.cohort_id}`, `session:${input.session_id}`],
    })

    return {
      ticket_identifier: identifier,
      ticket_url_stub: `https://linear.app/pixelated/issue/${identifier}`,
      session_id: input.session_id,
      priority: input.priority,
      labels: input.labels,
      created_at: new Date().toISOString(),
      persisted_to_foresight: true,
    }
  },
})
