import { defineAgent } from 'eve'

export default defineAgent({
  model: 'anthropic/claude-sonnet-4.6',
  compaction: {
    // Scoring reports are short. Compact sooner than default.
    thresholdPercent: 0.7,
  },
})
