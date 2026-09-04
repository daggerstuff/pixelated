import { defineAgent } from 'eve'
import { agentModel, AGENT_MODEL_CONTEXT_WINDOW_TOKENS } from './lib/workers-ai.js'

export default defineAgent({
  model: agentModel,
  modelContextWindowTokens: AGENT_MODEL_CONTEXT_WINDOW_TOKENS,
  compaction: {
    thresholdPercent: 0.75,
  },
})
