import { defineAgent } from 'eve'
import { z } from 'zod'

import {
  AGENT_MODEL_CONTEXT_WINDOW_TOKENS,
  agentModel,
} from '../../lib/workers-ai.js'

export default defineAgent({
  description:
    'Specialist sub-agent that scores a single rehearsal session across ' +
    'the cohort rubric. Emits one row per dimension plus an overall ' +
    'verdict. Use this whenever the QA agent is processing a session in ' +
    'batch.',
  model: agentModel,
  modelContextWindowTokens: AGENT_MODEL_CONTEXT_WINDOW_TOKENS,
  outputSchema: z.object({
    dimensions: z.array(
      z.object({
        dimension: z.string(),
        score: z.number().min(0).max(1),
        passed: z.boolean(),
        comment: z.string().max(160),
        evidence_span: z.string().max(160),
      }),
    ),
    overall_passed: z.boolean(),
    rationale: z.string().max(280),
  }),
})
