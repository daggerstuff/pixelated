import type { APIRoute } from 'astro'

import { SITE_ORIGIN, jsonDiscoveryResponse } from '../../lib/agent-discovery'

export const GET: APIRoute = () =>
  jsonDiscoveryResponse(
    {
      name: 'Pixelated Empathy',
      description:
        'Mental-health simulation platform for therapist training. Provides public content (blog, docs, changelog) and an authenticated API for scenarios, simulations, and audits.',
      version: '1.0.0',
      supportedInterfaces: [
        {
          url: `${SITE_ORIGIN}/mcp`,
          protocolBinding: 'JSONRPC',
          protocolVersion: '1.0',
        },
      ],
      capabilities: {
        streaming: false,
        pushNotifications: false,
        extendedAgentCard: false,
      },
      defaultInputModes: ['application/json', 'text/plain'],
      defaultOutputModes: ['application/json'],
      skills: [
        {
          id: 'content-search',
          name: 'Search public content',
          description:
            'Search blog posts, documentation, and changelog entries about therapy training, clinical simulation, and platform features.',
          tags: ['search', 'content', 'therapy', 'simulation'],
        },
        {
          id: 'agent-auth',
          name: 'Authenticate with the API',
          description:
            'Authenticate using OAuth 2.0 (Auth0) or API keys to call protected endpoints such as /api/v1/audits and /api/v1/simulations.',
          tags: ['auth', 'api', 'oauth'],
        },
      ],
      provider: {
        organization: 'Pixelated Empathy',
        url: SITE_ORIGIN,
      },
    },
    { 'Content-Type': 'application/a2a+json' },
  )
