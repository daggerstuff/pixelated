import { defineAgent } from 'eve'
import { z } from 'zod'
import { profileAndLogAgentStartup } from '../../lib/context/startup-profiler.js'

import {
  AGENT_MODEL_CONTEXT_WINDOW_TOKENS,
  agentModel,
} from './lib/workers-ai.js'

// Profile startup context consumption for agent entry point

profileAndLogAgentStartup({
  agentName: 'session-agent',
  agentDir: import.meta.dirname,
  connectionDescriptions: {
    'foresight':
      'Foresight memory MCP for conversation-rehearsal session context.',
    'memory-mcp':
      'Pixelated session memory MCP backed by MongoDB. Owns session records.',
  },
})

export default defineAgent({
  model: agentModel,
  modelContextWindowTokens: AGENT_MODEL_CONTEXT_WINDOW_TOKENS,
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
