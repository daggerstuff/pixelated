import { defineRemoteAgent } from 'eve'
import { vercelOidc } from 'eve/agents/auth'

export default defineRemoteAgent({
  url: () => process.env.ADVISOR_AGENT_URL ?? 'http://localhost:2005',
  description:
    'Critique-only senior engineering reviewer. Provides advice on source files and working diffs without modifying files. Returns recommendations for code quality and architecture.',
  auth: vercelOidc(),
})
