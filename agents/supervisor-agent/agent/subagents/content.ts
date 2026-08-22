import { defineRemoteAgent } from 'eve'
import { vercelOidc } from 'eve/agents/auth'

export default defineRemoteAgent({
  url: () => process.env.CONTENT_AGENT_URL ?? 'http://localhost:2010',
  description:
    'Clinical content curation agent. Audits, scores, and curates generated clinical training scenarios for therapeutic validity before they enter the scenario library.',
  auth: vercelOidc(),
})
