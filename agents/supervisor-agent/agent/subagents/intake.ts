import { defineRemoteAgent } from 'eve'
import { basic, vercelOidc } from 'eve/agents/auth'

const authUsername = process.env.EVE_AUTH_USERNAME ?? 'admin'
const authPassword = process.env.EVE_AUTH_PASSWORD ?? 'iI4Vce1IQs8z2dN4Ypk6zYSt'

export default defineRemoteAgent({
  url: () => process.env.INTAKE_AGENT_URL ?? 'http://localhost:2020',
  description:
    'Intake and cohort manager. Onboards new clinical trainees, manages cohort assignments, tracks curriculum progress, and surfaces trainee status to other agents and supervisors.',
  auth: process.env.VERCEL
    ? vercelOidc()
    : basic({ username: authUsername, password: authPassword }),
})
