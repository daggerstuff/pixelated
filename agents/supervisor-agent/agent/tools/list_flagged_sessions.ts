import { defineTool } from 'eve/tools'
import { z } from 'zod'

import { searchMemories } from '../foresight-client.js'

const FLAG_STATUSES = ['OPEN', 'RESOLVED'] as const
const FLAG_SEVERITIES = ['warning', 'critical'] as const

const SCHEMA = z.object({
  status: z
    .enum(FLAG_STATUSES)
    .optional()
    .describe('Filter by resolution status.'),
  severity: z
    .enum(FLAG_SEVERITIES)
    .optional()
    .describe('Filter by severity level.'),
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .describe('Max results.'),
})

export default defineTool({
  description:
    'List sessions that triggered clinical boundary flags or escalated to a ' +
    'supervisor. Queries Foresight for boundary_flag memories across all sessions.',
  inputSchema: SCHEMA,
  async execute(input: z.infer<typeof SCHEMA>) {
    const tagFilter: string[] = ['boundary_flag']
    if (input.status) tagFilter.push(`flag_status:${input.status}`)

    const memories = await searchMemories({
      query: 'boundary_flag clinical escalate',
      limit: input.limit * 2, // over-fetch to allow filtering
      tag_filter: tagFilter,
    })

    const flags: Array<{
      session_id: string
      severity: string
      flagged_criteria: string[]
      escalated: boolean
      flagged_at: string
    }> = []

    for (const m of memories ?? []) {
      try {
        const parsed = JSON.parse(m.content) as {
          session_id?: string
          severity?: string
          flagged_risk_criteria?: string[]
          escalate_to_supervisor?: boolean
          evaluated_at?: string
        }
        if (input.severity && parsed.severity !== input.severity) continue
        if (parsed.session_id && parsed.severity) {
          flags.push({
            session_id: parsed.session_id,
            severity: parsed.severity,
            flagged_criteria: parsed.flagged_risk_criteria ?? [],
            escalated: parsed.escalate_to_supervisor ?? false,
            flagged_at: parsed.evaluated_at ?? 'unknown',
          })
        }
      } catch {
        /* skip */
      }
    }

    flags.sort(
      (a, b) =>
        new Date(b.flagged_at).getTime() - new Date(a.flagged_at).getTime(),
    )

    return {
      flags: flags.slice(0, input.limit),
      total: flags.length,
      filters: {
        status: input.status ?? null,
        severity: input.severity ?? null,
      },
    }
  },
})
