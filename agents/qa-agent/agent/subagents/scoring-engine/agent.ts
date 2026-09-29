import { defineAgent } from 'eve'

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
  reasoning: 'medium',
})
