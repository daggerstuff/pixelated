import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import type { APIRoute } from 'astro'
import { z } from 'zod'

import { getSitemapXml } from '../lib/sitemap-cache'

function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: 'pixelated-empathy', version: '1.0.0' },
    { capabilities: { tools: {} } },
  )

  server.registerTool(
    'get_health',
    {
      description: 'Check the health status of the Pixelated Empathy API.',
      inputSchema: {},
    },
    async () => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify({ status: 'ok', service: 'pixelated-empathy' }),
        },
      ],
    }),
  )

  server.registerTool(
    'list_pages',
    {
      description:
        'List public page URLs from the Pixelated Empathy sitemap (blog posts, docs, changelog, landing pages).',
      inputSchema: {
        section: z
          .enum(['all', 'blog', 'docs', 'changelog'])
          .default('all')
          .describe('Which section of the sitemap to list'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(20)
          .describe('Maximum URLs to return'),
      },
    },
    async ({ section, limit }) => {
      const xml = await getSitemapXml()
      const urls = extractSitemapUrls(xml, section)
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              urls: urls.slice(0, limit),
              total: urls.length,
            }),
          },
        ],
      }
    },
  )

  return server
}

function extractSitemapUrls(xml: string, section: string): string[] {
  const all = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1])
  if (section === 'all') return all
  return all.filter((url) => url.includes(`/${section}/`))
}

async function handleRequest(request: Request): Promise<Response> {
  // Stateless pattern (per SDK example): a fresh server and transport per
  // request. The WebStandard transport speaks Fetch Request/Response natively,
  // which matches Astro's SSR environment — no Node shims needed.
  const server = createMcpServer()
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })
  await server.connect(transport)

  try {
    const response = await transport.handleRequest(request)
    return response
  } catch {
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal error' },
        id: null,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  } finally {
    // After the response is produced, a stateless transport's work is done.
    transport.close().catch(() => {})
    server.close().catch(() => {})
  }
}

export const POST: APIRoute = ({ request }) => handleRequest(request)

export const GET: APIRoute = ({ request }) => handleRequest(request)

export const DELETE: APIRoute = ({ request }) => handleRequest(request)
