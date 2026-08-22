import { defineAgent } from 'eve'
export default defineAgent({
  model: 'zai/glm-5.2', // Free for eve agents through Aug 27 via Blackbox on AI Gateway
  modelContextWindowTokens: 1_000_000, // GLM 5.2 has 1M context window
  compaction: {
    // Scoring reports are short. Compact sooner than default.
    thresholdPercent: 0.7,
  },
})
