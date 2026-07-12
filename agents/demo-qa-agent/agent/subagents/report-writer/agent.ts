import { defineAgent } from 'eve'
import { z } from 'zod'

import {
  AGENT_MODEL_CONTEXT_WINDOW_TOKENS,
  agentModel,
} from '../../lib/workers-ai.js'

export default defineAgent({
  description:
    'Specialist sub-agent that turns a structured corpus audit + curation ' +
    'result into a short demo-ready report. Emits headline, strengths, gaps, ' +
    'and rubric items (showcase-readiness dimensions). Use this whenever the ' +
    'demo QA agent has produced an audit and is ready to summarize.',
  model: agentModel,
  modelContextWindowTokens: AGENT_MODEL_CONTEXT_WINDOW_TOKENS,
  outputSchema: z.object({
    headline: z.string().max(280),
    strengths: z.array(z.string().max(160)).min(1).max(3),
    gaps: z.array(z.string().max(160)).max(3),
    rubric_items: z.array(
      z.object({
        item_id: z.string(),
        passed: z.boolean(),
        comment: z.string().max(160),
      }),
    ),
    next_session_hint: z.string().max(160).optional(),
  }),
})
