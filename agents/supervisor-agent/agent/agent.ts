import { defineAgent } from 'eve'

import { profileAndLogAgentStartup } from '../../lib/context/startup-profiler.js'
import {
  AGENT_MODEL_CONTEXT_WINDOW_TOKENS,
  agentModel,
} from './lib/workers-ai.js'

profileAndLogAgentStartup({
  agentName: 'supervisor-agent',
  agentDir: import.meta.dirname,
  // Foresight is accessed directly via agent/foresight-client.ts (streamable
  // HTTP POST), not through an Eve MCP connection, to avoid the Vercel AI SDK
  // streamable HTTP transport doing a GET that Foresight's /mcp rejects (405).
})

export default defineAgent({
  model: agentModel,
  modelContextWindowTokens: AGENT_MODEL_CONTEXT_WINDOW_TOKENS,
  compaction: {
    thresholdPercent: 0.7,
  },
})
