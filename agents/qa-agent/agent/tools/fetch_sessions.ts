import { defineTool } from 'eve/tools'
import { z } from 'zod'

// Pull completed session records from Foresight / Mongo since the last
// review cursor. Backs the qa-agent's daily-review schedule.

interface FetchSessionsInput {
  since: string
  limit: number
  cursor?: string
}

export default defineTool({
  description:
    'List rehearsal sessions since the last successful QA ' +
    'review. Returns the session IDs, trainee IDs, scenario IDs, and ' +
    'closing timestamps. Pagination is cursor-based on `cursor`.',
  inputSchema: z.object({
    since: z
      .string()
      .datetime()
      .describe('ISO 8601 timestamp — the last successful review cursor.'),
    limit: z.number().int().min(1).max(200).default(50),
    cursor: z.string().optional(),
  }),
  async execute(input: FetchSessionsInput) {
    return {
      since: input.since,
      limit: input.limit,
      cursor: input.cursor ?? null,
      next_cursor: null,
      sessions: [],
      fetched_at: new Date().toISOString(),
      foresight_stub: {
        note:
          'Foresight tagged-query `session.lifecycle=CLOSED AND ' +
          'session.closed_at >= :since` is not yet wired.',
      },
      mongo_stub: {
        collection: 'sessions',
        note: 'Mongo query via the session-mcp is not yet wired.',
      },
    }
  },
})
