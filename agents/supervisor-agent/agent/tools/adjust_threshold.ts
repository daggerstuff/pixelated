import { defineTool } from 'eve/tools'
import { z } from 'zod'

import { storeMemory } from '../foresight-client.js'

const THRESHOLD_TYPES = [
  'flag_severity',
  'scoring_pass_threshold',
  'escalation_delay_minutes',
  'max_sessions_per_day',
  'curriculum_completion_ratio',
] as const

const SCHEMA = z.object({
  threshold_type: z
    .enum(THRESHOLD_TYPES)
    .describe('Which threshold to adjust.'),
  new_value: z.union([z.number(), z.string()]).describe('New threshold value.'),
  reason: z
    .string()
    .min(1)
    .max(500)
    .describe('Why this threshold is being changed.'),
  scope: z
    .string()
    .optional()
    .default('global')
    .describe('Scope: "global" or "cohort:<id>".'),
})

export default defineTool({
  description:
    'Adjust a scoring or flagging threshold. Changes are logged to Foresight ' +
    'with long_term retention for audit trail. Affects future evaluations only.',
  inputSchema: SCHEMA,
  async execute(input: z.infer<typeof SCHEMA>) {
    const parsedInput = SCHEMA.parse(input)
    const changedAt = new Date().toISOString()

    const record = {
      type: 'threshold_change',
      threshold_type: parsedInput.threshold_type,
      new_value: parsedInput.new_value,
      previous_value: null as number | string | null,
      reason: parsedInput.reason,
      scope: parsedInput.scope,
      changed_by: 'supervisor-agent',
      changed_at: changedAt,
    }

    // Look up previous threshold value from Prior adjustments
    const previousAdjustments = await (async () => {
      const { searchMemories } = await import('../foresight-client.js')
      return searchMemories({
        query: `threshold:${parsedInput.threshold_type}`,
        limit: 1,
        tag_filter: ['threshold_change'],
      })
    })()

    if (previousAdjustments && previousAdjustments.length > 0) {
      try {
        const parsed = JSON.parse(previousAdjustments[0].content) as {
          new_value?: number | string
        }
        record.previous_value = parsed.new_value ?? null
      } catch {
        /* ignore */
      }
    }

    const stored = await storeMemory({
      content: JSON.stringify(record),
      category: 'threshold',
      scope: parsedInput.scope,
      retention: 'long_term',
      importance: 0.8,
      tags: [
        'threshold_change',
        `threshold:${parsedInput.threshold_type}`,
        `scope:${parsedInput.scope}`,
        'supervisor_action',
      ],
    })

    return {
      threshold_type: parsedInput.threshold_type,
      previous_value: record.previous_value,
      new_value: parsedInput.new_value,
      scope: parsedInput.scope,
      reason: parsedInput.reason,
      changed_at: changedAt,
      foresight_memory: stored ?? {
        memory_id: null,
        note: 'Foresight MCP write may have failed.',
      },
    }
  },
})
