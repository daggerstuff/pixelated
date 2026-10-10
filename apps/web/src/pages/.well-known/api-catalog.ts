import type { APIRoute } from 'astro'

import {
  API_CATALOG_ITEMS,
  SITE_ORIGIN,
  jsonDiscoveryResponse,
} from '../../lib/agent-discovery'

export const GET: APIRoute = () => {
  const body = {
    linkset: [
      {
        'anchor': `${SITE_ORIGIN}/.well-known/api-catalog`,
        'item': API_CATALOG_ITEMS.map((item) => ({
          href: item.href,
          name: item.name,
        })),
        'service-desc': [
          {
            href: `${SITE_ORIGIN}/openapi.yaml`,
            type: 'application/yaml',
          },
        ],
        'service-doc': [
          {
            href: `${SITE_ORIGIN}/docs/api`,
            type: 'text/html',
          },
        ],
        'describedby': [
          {
            href: `${SITE_ORIGIN}/.well-known/oauth-protected-resource`,
            type: 'application/json',
          },
        ],
      },
    ],
  }

  return jsonDiscoveryResponse(body, {
    'Content-Type': 'application/linkset+json',
    'Link': `<${SITE_ORIGIN}/.well-known/api-catalog>; rel="self"`,
  })
}
