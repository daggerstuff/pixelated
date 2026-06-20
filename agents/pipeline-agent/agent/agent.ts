import { defineAgent } from 'eve'

export default defineAgent({
  model: 'anthropic/claude-opus-4.8',
  compaction: {
    // Pipeline runs span hours to days. Compact aggressively so we keep the
    // state machine transitions in context; rely on Foresight for the long
    // log of tool calls.
    thresholdPercent: 0.65,
  },
})
