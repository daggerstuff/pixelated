import { defineAgent } from 'eve'
import { z } from 'zod'
import {
  AGENT_MODEL_CONTEXT_WINDOW_TOKENS,
  agentModel,
} from '../../lib/workers-ai.js'

export default defineAgent({
  description:
    'Specialist sub-agent that translates a live supervisor intervention ' +
    'into a structured directive the parent agent can act on. Use this ' +
    'whenever the http channel posts to /sessions/:id/intervene. The parent ' +
    'agent parks until this directive arrives, then resumes.',
  model: agentModel,
  modelContextWindowTokens: AGENT_MODEL_CONTEXT_WINDOW_TOKENS,
  outputSchema: z.object({
    intervention_kind: z.enum([
      'suggestion',
      'escalation_request',
      'pause_session',
      'note',
    ]),
    urgency: z.number().min(0).max(1),
    body: z.string().max(800),
    restart_session: z.boolean().optional(),
    halt_session: z.boolean().optional(),
  }),
})
