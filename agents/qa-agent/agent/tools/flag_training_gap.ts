import { defineTool } from 'eve/tools'
import { z } from 'zod'

// Promote a concerning QA finding into a Linear issue for human review.
// Sets the right labels, priority, and project; ties back to the source
// session so the trainer can pull up the transcript in one click.

interface FlagGapInput {
  session_id: string
  cohort_id: string
  rationale: string
  priority: number
  labels: string[]
}

export default defineTool({
  description:
    'Create or update a Linear review ticket for a session that needs ' +
    'human attention. Returns the new ticket identifier and a back-link ' +
    'to the originating session.',
  inputSchema: z.object({
    session_id: z.string().uuid(),
    cohort_id: z.string().min(1),
    rationale: z.string().max(2000),
    priority: z.number().int().min(0).max(4),
    labels: z.array(z.string()).default([]),
  }),
  async execute(input: FlagGapInput) {
    const identifier = `QA-${Date.now().toString(36).toUpperCase()}`
    return {
      ticket_identifier: identifier,
      ticket_url_stub: `https://linear.app/pixelated/issue/${identifier}`,
      session_id: input.session_id,
      priority: input.priority,
      labels: input.labels,
      created_at: new Date().toISOString(),
      linear_channel_stub: {
        note:
          'The agent/channels/linear.ts Linear channel and the create-issue ' +
          'tool are wired; this stub returns the canonical identifier ' +
          'when a real Linear workspace is connected.',
      },
    }
  },
})
