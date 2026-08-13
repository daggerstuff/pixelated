import { defineAgent } from 'eve'

import { profileAndLogAgentStartup } from '../../lib/context/startup-profiler.js'
import {
  AGENT_MODEL_CONTEXT_WINDOW_TOKENS,
  agentModel,
} from './lib/workers-ai.js'

// Profile startup context consumption for agent entry point

profileAndLogAgentStartup({
  agentName: 'qa-agent',
  agentDir: import.meta.dirname,
  // Foresight is accessed directly via agent/foresight-client.ts.
})

export default defineAgent({
  model: agentModel,
  modelContextWindowTokens: AGENT_MODEL_CONTEXT_WINDOW_TOKENS,
  compaction: {
    // Scoring reports are short. Compact sooner than default.
    thresholdPercent: 0.7,
  },
})
