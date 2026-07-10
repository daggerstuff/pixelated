import { defineAgent } from 'eve'

import {
  AGENT_MODEL_CONTEXT_WINDOW_TOKENS,
  agentModel,
} from './lib/workers-ai.js'

export default defineAgent({
  model: agentModel,
  modelContextWindowTokens: AGENT_MODEL_CONTEXT_WINDOW_TOKENS,
  compaction: {
    // Scoring reports are short. Compact sooner than default.
    thresholdPercent: 0.7,
  },
})
