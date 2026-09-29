import { defineAgent } from 'eve'

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
  reasoning: 'medium',
})
