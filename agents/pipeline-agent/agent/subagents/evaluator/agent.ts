import { defineAgent } from 'eve'

import {
  AGENT_MODEL_CONTEXT_WINDOW_TOKENS,
  agentModel,
} from '../../lib/workers-ai.js'

export default defineAgent({
  description:
    'Specialist sub-agent that analyzes evaluation benchmark results and ' +
    'emits dimension-level pass/fail, an overall verdict, and a recommendation ' +
    'for the human reviewer at Gate 3. Workers AI pre-evaluation scoring lives ' +
    'in the `run_evaluation` tool, not at the model layer.',
  model: agentModel,
  modelContextWindowTokens: AGENT_MODEL_CONTEXT_WINDOW_TOKENS,
  reasoning: 'medium',
})
