import type { APIRoute } from 'astro'

export const GET: APIRoute = async ({ request }) => {
  return new Response('Test', { status: 200 });
}
