import type { APIRoute } from 'astro'

// Serves /agent-skills/<name>/SKILL.md (and any trailing-slash variant) from
// the skill definitions in lib/agent-skills. A catch-all is used because
// Astro does not route a literal SKILL.md filename from content-search.ts.
import { findSkillByPath } from '../../../lib/agent-skills'

export const GET: APIRoute = ({ params }) => {
  const slug = params['slug'] ?? ''
  const path = `/.well-known/agent-skills/${slug}`
  const skill = findSkillByPath(path)
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
