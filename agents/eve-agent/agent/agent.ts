import { defineAgent } from 'eve'

export default defineAgent({
  name: 'eve-agent',
  description: 'Vercel Edge & AI Infrastructure Agent',
  compaction: {
    thresholdPercent: 0.75,
  },
})
