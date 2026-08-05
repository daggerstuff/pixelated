import { defineAgent } from 'eve'

import { profileAndLogAgentStartup } from '../../lib/context/startup-profiler.js'
import {
  AGENT_MODEL_CONTEXT_WINDOW_TOKENS,
  agentModel,
} from './lib/workers-ai.js'

profileAndLogAgentStartup({
  agentName: 'intake-agent',
  agentDir: import.meta.dirname,
  connectionDescriptions: {
    foresight:
      'Foresight memory MCP for trainee profiles, cohort assignments, and curriculum progress.',
  },
})

export default defineAgent({
  model: agentModel,
  modelContextWindowTokens: AGENT_MODEL_CONTEXT_WINDOW_TOKENS,
  compaction: {
    thresholdPercent: 0.7,
  },
})
