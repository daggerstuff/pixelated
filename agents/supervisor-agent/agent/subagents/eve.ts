import { defineRemoteAgent } from 'eve'
import { basic, vercelOidc } from 'eve/agents/auth'

const authUsername = process.env.EVE_AUTH_USERNAME ?? 'admin'
const authPassword = process.env.EVE_AUTH_PASSWORD ?? 'iI4Vce1IQs8z2dN4Ypk6zYSt'

export default defineRemoteAgent({
  url: () => process.env.EVE_AGENT_URL ?? 'http://localhost:2015',
  description:
    'Pipeline clean-up, replacement, and synthetic regeneration agent. Manages synthetic email and chat corpora through a 76-stage filter pipeline and persona-aware replacements.',
  auth: process.env.VERCEL
    ? vercelOidc()
    : basic({ username: authUsername, password: authPassword }),
})
