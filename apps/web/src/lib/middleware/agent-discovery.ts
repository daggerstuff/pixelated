import type { MiddlewareHandler } from 'astro'

import { SITE_ORIGIN } from '../agent-discovery'
import { htmlToAgentMarkdown } from '../markdown-for-agents'

/** Link headers added to public HTML responses (RFC 8288 discovery). */
const AGENT_LINK_HEADERS = [
  `${SITE_ORIGIN}/sitemap.xml; rel="sitemap"`,
  `${SITE_ORIGIN}/.well-known/api-catalog; rel="api-catalog"`,
  `${SITE_ORIGIN}/.well-known/oauth-protected-resource; rel="describedby"`,
  `${SITE_ORIGIN}/docs/api; rel="service-doc"`,
  `${SITE_ORIGIN}/openapi.yaml; rel="service-desc"; type="application/yaml"`,
  `${SITE_ORIGIN}/auth.md; rel="help"; type="text/markdown"`,
]

// Page routes excluded from agent discovery headers/markdown: authenticated
// app areas, internal test pages, and API routes. Mirrors the areas listed in
// robots.txt Disallow plus the middleware's own internal route list.
const EXCLUDED_PREFIXES = [
  '/api/',
  '/admin',
  '/admin-test',
  '/dashboard',
  '/journal-research',
  '/portal',
  '/profile/',
  '/settings/',
  '/unauthorized',
  '/offline',
  '/test-sentry',
  '/nightmare-fuel-demo',
  '/therapy-chat-plan',
  '/style-guide',
  '/search-demo',
  '/dev/',
  '/browser-compatibility/',
  '/404',
  '/500',
]

function isExcludedPath(pathname: string): boolean {
  return EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function isAgentRequest(request: Request): boolean {
  const accept = request.headers.get('accept') ?? ''
  return accept.includes('text/markdown')
}

/**
 * Adds agent discovery Link headers to public HTML responses and serves
 * markdown on `Accept: text/markdown` (Markdown for Agents convention).
 */
export const agentDiscoveryMiddleware: MiddlewareHandler = async (
  context,
  next,
) => {
  const { pathname } = context.url

  if (isExcludedPath(pathname)) {
    return next()
  }

  const wantsMarkdown = isAgentRequest(context.request)

  const response = await next()

  // Only public page responses participate.
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('text/html')) {
    return response
  }

  if (wantsMarkdown) {
    const html = await response.text()
    const markdown = htmlToAgentMarkdown(html, context.url.toString())
    if (markdown) {
      return new Response(markdown, {
        status: response.status,
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Vary': 'Accept',
          'Cache-Control': 'public, max-age=600',
        },
      })
    }
  }

  response.headers.set('Link', AGENT_LINK_HEADERS.join(', '))
  return response
}
