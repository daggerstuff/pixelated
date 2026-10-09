import type { APIRoute } from 'astro'

import {
  AUTH0_ISSUER,
  SITE_ORIGIN,
  jsonDiscoveryResponse,
} from '../../lib/agent-discovery'

export const GET: APIRoute = () =>
  jsonDiscoveryResponse({
    resource: `${SITE_ORIGIN}/`,
    resource_name: 'Pixelated Empathy',
    resource_documentation: `${SITE_ORIGIN}/docs/api`,
    authorization_servers: [AUTH0_ISSUER],
    scopes_supported: ['api:read', 'profile', 'email'],
    bearer_methods_supported: ['header'],
    resource_signing_alg_values_supported: ['RS256'],
  })
