import { defineAgent } from 'eve'

import {
  AGENT_MODEL_CONTEXT_WINDOW_TOKENS,
  agentModel,
} from '../../lib/workers-ai.js'

export default defineAgent({
  description:
    'Specialist sub-agent that turns a structured session score into a short ' +
    'trainer-facing report. Emits headline, strengths, gaps, rubric items, ' +
    'and an optional next-session hint. Use this whenever the QA agent has ' +
    'produced scores and is ready to summarize.',
  model: agentModel,
  modelContextWindowTokens: AGENT_MODEL_CONTEXT_WINDOW_TOKENS,
  reasoning: 'medium',
})
