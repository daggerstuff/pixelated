import type { APIRoute } from 'astro'
import type { APIContext } from 'astro'

// Redirect to the versioned API endpoint
export const GET: APIRoute = async ({ url }: APIContext) => {
  const newUrl = new URL(url)
  newUrl.pathname =
    '/api/v1/search' + newUrl.pathname.substring('/api/search'.length)

  return new Response(null, {
    status: 308, // Permanent redirect
    headers: {
      Location: newUrl.toString(),
    },
  })
}
