import { defineRemoteAgent } from 'eve'
import { vercelOidc } from 'eve/agents/auth'

export default defineRemoteAgent({
  url: () => process.env.PIPELINE_AGENT_URL ?? 'http://localhost:2025',
  description:
    'Training pipeline orchestrator. Moves model artifacts from dataset curation through training, evaluation, and promotion to production with human-in-the-loop approval gates at every stage transition.',
  auth: vercelOidc(),
})
