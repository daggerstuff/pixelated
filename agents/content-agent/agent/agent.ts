import { defineAgent } from 'eve'

import { profileAndLogAgentStartup } from '../../lib/context/startup-profiler.js'
import {
  AGENT_MODEL_CONTEXT_WINDOW_TOKENS,
  agentModel,
} from './lib/workers-ai.js'

profileAndLogAgentStartup({
  agentName: 'content-agent',
  agentDir: import.meta.dirname,
  connectionDescriptions: {
    foresight:
      'Foresight memory MCP for clinical content curation. Stores audit results, curation picks, and scenario library gate decisions.',
  },
})

export default defineAgent({
  model: agentModel,
  modelContextWindowTokens: AGENT_MODEL_CONTEXT_WINDOW_TOKENS,
  compaction: {
    // Showcase reports stay short. Compact sooner than default.
    thresholdPercent: 0.7,
  },
})
