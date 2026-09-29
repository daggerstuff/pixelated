import { defineAgent } from 'eve'

import {
  AGENT_MODEL_CONTEXT_WINDOW_TOKENS,
  agentModel,
} from '../../lib/workers-ai.js'

export default defineAgent({
  description:
    'Specialist sub-agent for emotion signal analysis on the latest turn of a ' +
    'rehearsal session. Emits a compact, structured emotion signal (label, ' +
    'intensity, valence, risk flags) that the parent agent attaches to its reply ' +
    "before the tool writes the turn to Foresight. Use this whenever the trainee's " +
    "or participant's most recent turn has not yet been analyzed.",
  model: agentModel,
  modelContextWindowTokens: AGENT_MODEL_CONTEXT_WINDOW_TOKENS,
  reasoning: 'medium',
})
