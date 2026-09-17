import { defineAgent } from 'eve'
import { agentModel, AGENT_MODEL_CONTEXT_WINDOW_TOKENS } from './lib/workers-ai.js'

export default defineAgent({
  model: agentModel,
  modelContextWindowTokens: AGENT_MODEL_CONTEXT_WINDOW_TOKENS,
  reasoning: 'medium',
  compaction: {
    // Showcase reports stay short. Compact sooner than default.
    thresholdPercent: 0.7,
  },
})
