import { createHash } from 'node:crypto'

import type { APIRoute } from 'astro'

import {
  SITE_ORIGIN,
  jsonDiscoveryResponse,
} from '../../../lib/agent-discovery'
import { AGENT_SKILLS } from '../../../lib/agent-skills'

export const GET: APIRoute = () =>
  jsonDiscoveryResponse({
    $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
    skills: AGENT_SKILLS.map((skill) => ({
      name: skill.name,
      type: skill.type,
      description: skill.description,
      url: `${SITE_ORIGIN}${skill.path}`,
      digest: `sha256:${createHash('sha256').update(skill.markdown()).digest('hex')}`,
    })),
  })
