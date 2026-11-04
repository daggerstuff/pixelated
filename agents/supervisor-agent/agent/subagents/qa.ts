import { defineRemoteAgent } from 'eve'
import { httpBasic, vercelOidc } from 'eve/agents/auth'

// Credentials come from EVE_AUTH_USERNAME/EVE_AUTH_PASSWORD (the agent fleet
// env file). With neither set we send no
// Authorization header at all, so the remote answers 401 — fail closed, never a
// built-in default password.
const authUsername = process.env.EVE_AUTH_USERNAME
const authPassword = process.env.EVE_AUTH_PASSWORD

export default defineRemoteAgent({
  url: () => process.env.QA_AGENT_URL ?? 'http://localhost:2030',
  description:
    'Clinical session QA and review agent. Scores completed rehearsal sessions against the program rubric and produces trainer-facing reports with gap analysis.',
  auth: process.env.VERCEL
    ? vercelOidc()
    : authUsername && authPassword
      ? httpBasic({ username: authUsername, password: authPassword })
      : undefined,
})
