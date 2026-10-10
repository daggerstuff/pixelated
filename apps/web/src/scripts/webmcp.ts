// WebMCP (https://webmachinelearning.github.io/webm/) — registers this
// site's read-only tools with supporting browsers so agents can call them
// directly from the page. Registration is a no-op where the API is absent
// and guarded against errors so it never affects the page itself.
function registerWebMcpTools() {
  const modelContext = (
    navigator as Navigator & {
      modelContext?: {
        registerTool: (tool: unknown) => void
      }
    }
  ).modelContext
  if (!modelContext?.registerTool) {
    return
  }

  const fetchJson = (url: string) =>
    fetch(url, { headers: { Accept: 'application/json' } }).then((res) => res.json())

  const tools = [
    {
      name: 'search_site_content',
      description:
        'Search Pixelated Empathy public content (blog posts, documentation, changelog) for therapy training and clinical simulation topics.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Free-text search query' },
        },
        required: ['query'],
      },
      execute: async ({ query }: { query: string }) =>
        fetchJson(`/api/v1/search?q=${encodeURIComponent(query)}`),
    },
    {
      name: 'get_site_health',
      description: 'Check the health status of the Pixelated Empathy API.',
      inputSchema: { type: 'object', properties: {} },
      execute: () => fetchJson('/api/v1/health'),
    },
    {
      name: 'list_blog_posts',
      description: 'List recent blog posts about therapy training and clinical simulation.',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        const res = await fetch('/sitemap.xml', { headers: { Accept: 'application/xml' } })
        const xml = await res.text()
        const urls = Array.from(xml.matchAll(/<loc>([^<]*\/blog\/[^<]*)<\/loc>/g)).map((m) => m[1])
        return { blogUrls: urls.slice(0, 20) }
      },
    },
  ]

  for (const tool of tools) {
    try {
      modelContext.registerTool(tool)
    } catch {
      // One failing registration must not prevent the rest.
    }
  }
}

if ('modelContext' in navigator) {
  registerWebMcpTools()
}
