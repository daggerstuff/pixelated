import { AUTH0_ISSUER, SITE_ORIGIN } from './agent-discovery'

const CONTENT_SEARCH_MD = `---
name: content-search
description: Searches Pixelated Empathy blog posts, documentation, and changelog entries for therapy training, clinical simulation, and platform topics. Use when looking for content about mental health education, AI-assisted therapy training, or platform features.
---

# Content Search

Search public content on Pixelated Empathy (blog, docs, changelog).

## Quick Start

The public listing pages are the fastest way to find content:

- Blog index: ${SITE_ORIGIN}/blog
- Docs index: ${SITE_ORIGIN}/docs
- Changelog: ${SITE_ORIGIN}/changelog
- Full URL list: ${SITE_ORIGIN}/sitemap.xml

## Instructions

1. Start with the public indexes above to find relevant content.
2. Each listing page links to individual posts with clean URLs.
3. Request any page with \`Accept: text/markdown\` to receive a markdown version of the page content.
4. For structured search, the search API (${SITE_ORIGIN}/api/v1/search) requires authentication (JWT or API key) — see the agent-auth skill.
`

const AGENT_AUTH_MD = `---
name: agent-auth
description: Authenticates agents with the Pixelated Empathy API using OAuth 2.0 (Auth0) or API keys. Use when an agent needs to call authenticated API endpoints like /api/v1/audits or /api/v1/simulations.
---

# Agent Authentication

Authenticate with the Pixelated Empathy API to call protected endpoints.

## Prerequisites

- An Auth0 M2M client (client_id + client_secret), or
- An API key issued by an institution administrator

## Machine-to-Machine (OAuth 2.0 client credentials)

\`\`\`bash
curl -X POST ${AUTH0_ISSUER}oauth/token \\
  -H "Content-Type: application/json" \\
  -d '{"client_id":"<id>","client_secret":"<secret>","audience":"${SITE_ORIGIN}/","grant_type":"client_credentials"}'
\`\`\`

Use the returned \`access_token\` as a Bearer token:

\`\`\`bash
curl ${SITE_ORIGIN}/api/v1/scenarios \\
  -H "Authorization: Bearer <access_token>"
\`\`\`

## API Key

\`\`\`bash
curl ${SITE_ORIGIN}/api/v1/scenarios \\
  -H "X-API-Key: <api-key>"
\`\`\`

## Discovery

- Protected Resource Metadata: ${SITE_ORIGIN}/.well-known/oauth-protected-resource
- Full registration walkthrough: ${SITE_ORIGIN}/auth.md
- API docs: ${SITE_ORIGIN}/docs/api
`

/** Skill definitions shared by the discovery index and the SKILL.md routes. */
export const AGENT_SKILLS = [
  {
    name: 'content-search',
    type: 'skill-md' as const,
    description:
      'Searches Pixelated Empathy blog posts, documentation, and changelog entries for therapy training, clinical simulation, and platform topics. Use when looking for content about mental health education, AI-assisted therapy training, or platform features.',
    path: '/.well-known/agent-skills/content-search/SKILL.md',
    markdown: () => CONTENT_SEARCH_MD,
  },
  {
    name: 'agent-auth',
    type: 'skill-md' as const,
    description:
      'Authenticates agents with the Pixelated Empathy API using OAuth 2.0 (Auth0) or API keys. Use when an agent needs to call authenticated API endpoints like /api/v1/audits or /api/v1/simulations.',
    path: '/.well-known/agent-skills/agent-auth/SKILL.md',
    markdown: () => AGENT_AUTH_MD,
  },
] as const

/** Returns the skill definition whose SKILL.md is served at the given path. */
export function findSkillByPath(
  path: string,
): (typeof AGENT_SKILLS)[number] | undefined {
  return AGENT_SKILLS.find((skill) => skill.path === path)
}
