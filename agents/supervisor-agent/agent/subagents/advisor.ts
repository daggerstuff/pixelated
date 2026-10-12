import { defineRemoteAgent } from 'eve'
import { basic, vercelOidc } from 'eve/agents/auth'

const authUsername = process.env.EVE_AUTH_USERNAME ?? 'admin'
const authPassword = process.env.EVE_AUTH_PASSWORD ?? 'iI4Vce1IQs8z2dN4Ypk6zYSt'

export default defineRemoteAgent({
  url: () => process.env.ADVISOR_AGENT_URL ?? 'http://localhost:2005',
  description:
    'Critique-only senior engineering reviewer. Provides advice on source files and working diffs without modifying files. Returns recommendations for code quality and architecture.',
  auth: process.env.VERCEL
    ? vercelOidc()
    : basic({ username: authUsername, password: authPassword }),
})
