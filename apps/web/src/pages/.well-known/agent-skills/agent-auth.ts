import type { APIRoute } from 'astro'

import { findSkillByPath } from '../../../lib/agent-skills'

const PATH = '/.well-known/agent-skills/agent-auth/SKILL.md'

export const GET: APIRoute = () => {
  const skill = findSkillByPath(PATH)
  if (!skill) {
    return new Response('Not found', { status: 404 })
  }
  return new Response(skill.markdown(), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
