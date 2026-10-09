/**
 * Agent-facing discovery metadata for Pixelated Empathy.
 *
 * Single source of truth for:
 * - SITE_ORIGIN / AUTH0 issuer used across discovery endpoints
 * - api-catalog (RFC 9727) route list
 * - JSON response helper for discovery endpoints
 * - agent skill markdown (SKILL.md documents) — see agent-skills.ts
 */

import { SITE } from '../config'

export const SITE_ORIGIN = SITE.website.replace(/\/$/, '')

export const AUTH0_ISSUER = `https://${
  process.env['PUBLIC_AUTH0_DOMAIN'] ??
  process.env['AUTH0_DOMAIN'] ??
  'dev-f3vkhvb6n52y7fre.us.auth0.com'
}/`

export const AGENT_DISCOVERY_ROUTES = [
  '/.well-known/api-catalog',
  '/.well-known/oauth-protected-resource',
  '/.well-known/agent-card.json',
  '/.well-known/agent-skills/index.json',
  '/.well-known/agent-skills/content-search/SKILL.md',
  '/.well-known/agent-skills/agent-auth/SKILL.md',
  '/.well-known/ai-catalog.json',
  '/.well-known/mcp/server-card.json',
  '/auth.md',
] as const

/** API routes surfaced to agents in the api-catalog (RFC 9727 linkset). */
export const API_CATALOG_ITEMS = [
  { href: `${SITE_ORIGIN}/api/v1/health`, name: 'Health check' },
  { href: `${SITE_ORIGIN}/api/v1/scenarios`, name: 'List scenarios' },
  { href: `${SITE_ORIGIN}/api/v1/simulations`, name: 'List simulations' },
  { href: `${SITE_ORIGIN}/api/v1/audits`, name: 'Run audit (auth required)' },
]

/** JSON response helper for discovery endpoints. */
export function jsonDiscoveryResponse(
  body: unknown,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
      ...extraHeaders,
    },
  })
}
