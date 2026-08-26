import type { APIRoute } from 'astro'

export const get: APIRoute = async () => {
  // Redirect to the API documentation page (which you can create later)
  return new Response('', {
    status: 302,
    headers: {
      Location: '/api/ai/mental-health',
    },
  })
}
