import { defineRemoteAgent } from 'eve'
import { vercelOidc } from 'eve/agents/auth'

export default defineRemoteAgent({
  url: () => process.env.INTAKE_AGENT_URL ?? 'http://localhost:2020',
  description:
    'Intake and cohort manager. Onboards new clinical trainees, manages cohort assignments, tracks curriculum progress, and surfaces trainee status to other agents and supervisors.',
  auth: vercelOidc(),
})
