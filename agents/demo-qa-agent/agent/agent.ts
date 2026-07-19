import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineAgent } from 'eve'
import { profileAndLogAgentStartup } from '@/lib/context/startup-profiler.js'

import {
  AGENT_MODEL_CONTEXT_WINDOW_TOKENS,
  agentModel,
} from './lib/workers-ai.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

profileAndLogAgentStartup({
  agentName: 'demo-qa-agent',
  agentDir: __dirname,
  connectionDescriptions: {
    foresight:
      'Foresight memory MCP for demo corpus QA. Stores curation picks and pulls prior audit runs for citation.',
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
