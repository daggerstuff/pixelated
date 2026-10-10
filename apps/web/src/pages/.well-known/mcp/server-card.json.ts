import type { APIRoute } from 'astro'

import {
  SITE_ORIGIN,
  jsonDiscoveryResponse,
} from '../../../lib/agent-discovery'

export const GET: APIRoute = () =>
  jsonDiscoveryResponse({
    $schema:
      'https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json',
    version: '1.0',
    protocolVersion: '2025-06-18',
    title: 'Pixelated Empathy Content API',
    description:
      'Read-only access to Pixelated Empathy public content: blog posts, documentation, changelog, and health status. Authentication is required for platform APIs; see auth.md.',
    serverInfo: {
      name: 'pixelated-empathy',
      version: '1.0.0',
    },
    transport: {
      type: 'http',
      endpoint: `${SITE_ORIGIN}/mcp`,
    },
    capabilities: {
      tools: {},
    },
    tools: [
      {
        name: 'get_health',
        description: 'Check API health status.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'list_pages',
        description:
          'List public page URLs from the Pixelated Empathy sitemap (blog posts, docs, changelog).',
        inputSchema: {
          type: 'object',
          properties: {
            section: {
              type: 'string',
              enum: ['all', 'blog', 'docs', 'changelog'],
            },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
      },
    ],
    documentationUrl: `${SITE_ORIGIN}/docs/api`,
    authentication: {
      type: 'oauth',
      resourceMetadata: `${SITE_ORIGIN}/.well-known/oauth-protected-resource`,
    },
  })
