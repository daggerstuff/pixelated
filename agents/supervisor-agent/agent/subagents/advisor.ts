import { defineRemoteAgent } from 'eve'
import { httpBasic, vercelOidc } from 'eve/agents/auth'

// Credentials come from EVE_AUTH_USERNAME/EVE_AUTH_PASSWORD (the k8s
// `eve-auth` secret, or the agent fleet env file). With neither set we send no
// Authorization header at all, so the remote answers 401 — fail closed, never a
// built-in default password.
const authUsername = process.env.EVE_AUTH_USERNAME
const authPassword = process.env.EVE_AUTH_PASSWORD

export default defineRemoteAgent({
  url: () => process.env.ADVISOR_AGENT_URL ?? 'http://localhost:2005',
  description:
    'Critique-only senior engineering reviewer. Provides advice on source files and working diffs without modifying files. Returns recommendations for code quality and architecture.',
  auth: process.env.VERCEL
    ? vercelOidc()
    : authUsername && authPassword
      ? httpBasic({ username: authUsername, password: authPassword })
      : undefined,
})
