import { defineAgent } from 'eve'

import {
  agentModel,
  AGENT_MODEL_CONTEXT_WINDOW_TOKENS,
} from './lib/workers-ai.js'

// GLM 5.2 — free for eve agents through Aug 27 2026 via Blackbox on AI Gateway.
// Set as a string literal so `eve set --model` can manage it.
export default defineAgent({
  model: agentModel,
  modelContextWindowTokens: AGENT_MODEL_CONTEXT_WINDOW_TOKENS,
  reasoning: 'medium',
  build: {
    externalDependencies: ['mongodb', '@mongodb-js/zstd'],
  },
  compaction: {
    // Rehearsal sessions routinely exceed 30 minutes. Compact framing (state
    // transitions, tool summaries) earlier than the framework default so the
    // transcript itself stays in-context for the whole session.
    thresholdPercent: 0.75,
  },
})
