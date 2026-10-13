import { defineRemoteAgent } from 'eve'
import { basic, vercelOidc } from 'eve/agents/auth'

const authUsername = process.env.EVE_AUTH_USERNAME ?? 'admin'
const authPassword = process.env.EVE_AUTH_PASSWORD ?? 'iI4Vce1IQs8z2dN4Ypk6zYSt'

export default defineRemoteAgent({
  url: () => process.env.PIPELINE_AGENT_URL ?? 'http://localhost:2025',
  description:
    'Training pipeline orchestrator. Moves model artifacts from dataset curation through training, evaluation, and promotion to production with human-in-the-loop approval gates at every stage transition.',
  auth: process.env.VERCEL
    ? vercelOidc()
    : basic({ username: authUsername, password: authPassword }),
})
