import { defineRemoteAgent } from 'eve'
import { basic, vercelOidc } from 'eve/agents/auth'

const authUsername = process.env.EVE_AUTH_USERNAME ?? 'admin'
const authPassword = process.env.EVE_AUTH_PASSWORD ?? 'iI4Vce1IQs8z2dN4Ypk6zYSt'

export default defineRemoteAgent({
  url: () => process.env.QA_AGENT_URL ?? 'http://localhost:2030',
  description:
    'Clinical session QA and review agent. Scores completed rehearsal sessions against the program rubric and produces trainer-facing reports with gap analysis.',
  auth: process.env.VERCEL
    ? vercelOidc()
    : basic({ username: authUsername, password: authPassword }),
})
