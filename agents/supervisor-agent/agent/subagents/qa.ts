import { defineRemoteAgent } from 'eve'
import { vercelOidc } from 'eve/agents/auth'

export default defineRemoteAgent({
  url: () => process.env.QA_AGENT_URL ?? 'http://localhost:2030',
  description:
    'Clinical session QA and review agent. Scores completed rehearsal sessions against the program rubric and produces trainer-facing reports with gap analysis.',
  auth: vercelOidc(),
})
