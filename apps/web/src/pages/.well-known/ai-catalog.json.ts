import type { APIRoute } from 'astro'

import { SITE_ORIGIN, jsonDiscoveryResponse } from '../../lib/agent-discovery'

export const GET: APIRoute = () =>
  jsonDiscoveryResponse({
    specVersion: '1.0',
    host: {
      displayName: 'Pixelated Empathy',
      identifier: 'did:web:pixelatedempathy.com',
      documentationUrl: `${SITE_ORIGIN}/docs/api`,
    },
    entries: [
      {
        identifier: 'urn:air:pixelatedempathy.com:content:content-api',
        displayName: 'Pixelated Empathy Content API',
        type: 'application/a2a-agent-card+json',
        url: `${SITE_ORIGIN}/.well-known/agent-card.json`,
        description:
          'Public content discovery (blog, docs, changelog) and authenticated API for scenarios, simulations, and audits on a mental-health simulation platform for therapist training.',
        tags: ['therapy', 'simulation', 'content', 'mental-health'],
        capabilities: ['content-search', 'agent-auth'],
        representativeQueries: [
          'find blog posts about transcript-based therapy review',
          'how do agents authenticate with the Pixelated Empathy API',
          'what simulation endpoints does the platform expose',
        ],
      },
    ],
  })
