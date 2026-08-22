import { defineRemoteAgent } from 'eve'
import { vercelOidc } from 'eve/agents/auth'

export default defineRemoteAgent({
  url: () => process.env.SESSION_AGENT_URL ?? 'http://localhost:2035',
  description:
    'Conversation rehearsal session orchestrator. Guides therapist-in-training through one-on-one practice sessions modeled on real therapeutic exchanges with real-time feedback.',
  auth: vercelOidc(),
})
