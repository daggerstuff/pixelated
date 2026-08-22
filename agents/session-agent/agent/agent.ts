import { defineAgent } from 'eve'
import { z } from 'zod'

// GLM 5.2 — free for eve agents through Aug 27 2026 via Blackbox on AI Gateway.
// Set as a string literal so `eve set --model` can manage it.
export default defineAgent({
  model: 'zai/glm-5.2',
  modelContextWindowTokens: 1_000_000,
  compaction: {
    // Rehearsal sessions routinely exceed 30 minutes. Compact framing (state
    // transitions, tool summaries) earlier than the framework default so the
    // transcript itself stays in-context for the whole session.
    thresholdPercent: 0.75,
  },
  outputSchema: z.object({
    session_id: z.string().uuid().optional(),
    state: z.enum([
      'NEW',
      'RECOVERING',
      'ACTIVE',
      'AWAITING_SUPERVISOR',
      'CLOSING',
      'CLOSED',
    ]),
    reply: z
      .string()
      .max(2000)
      .describe(
        'The single in-character reply the supervisor-approved participant ' +
          'produces for this turn. Never narration, never out-of-character.',
      ),
    emotion: z
      .object({
        primary_emotion: z.string(),
        intensity: z.number().min(0).max(1),
        valence: z.number().min(-1).max(1),
        risk_flags: z.array(
          z.enum([
            'crisis_ideation',
            'harm_to_others',
            'medical_emergency',
            'distress',
          ]),
        ),
        confidence: z.number().min(0).max(1),
      })
      .optional(),
    clinical: z
      .object({
        boundary_passed: z.boolean(),
        reason: z.string().max(500).optional(),
        escalate_to_supervisor: z.boolean().optional(),
      })
      .optional(),
    persistent_notes: z
      .array(z.string().max(280))
      .max(10)
      .optional()
      .describe(
        'Optional non-PII notes the agent wants Foresight to retain for ' +
          'longitudinal tracking across sessions.',
      ),
  }),
})
