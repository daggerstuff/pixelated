import { defineRemoteAgent } from 'eve'
import { basic, vercelOidc } from 'eve/agents/auth'

const authUsername = process.env.EVE_AUTH_USERNAME ?? 'admin'
const authPassword = process.env.EVE_AUTH_PASSWORD ?? 'iI4Vce1IQs8z2dN4Ypk6zYSt'

export default defineRemoteAgent({
  url: () => process.env.SESSION_AGENT_URL ?? 'http://localhost:2035',
  description:
    'Conversation rehearsal session orchestrator. Guides therapist-in-training through one-on-one practice sessions modeled on real therapeutic exchanges with real-time feedback.',
  auth: process.env.VERCEL
    ? vercelOidc()
    : basic({ username: authUsername, password: authPassword }),
})
