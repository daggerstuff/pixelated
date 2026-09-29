import { defineAgent } from 'eve'

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
  reasoning: 'medium',
})
