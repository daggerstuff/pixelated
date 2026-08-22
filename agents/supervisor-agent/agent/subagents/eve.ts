import { defineRemoteAgent } from 'eve'
import { vercelOidc } from 'eve/agents/auth'

export default defineRemoteAgent({
  url: () => process.env.EVE_AGENT_URL ?? 'http://localhost:2015',
  description:
    'Pipeline clean-up, replacement, and synthetic regeneration agent. Manages synthetic email and chat corpora through a 76-stage filter pipeline and persona-aware replacements.',
  auth: vercelOidc(),
})
