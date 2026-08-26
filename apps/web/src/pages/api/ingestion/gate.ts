import type { APIRoute } from 'astro'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  const FASTAPI_GATE_URL = 'http://localhost:8100/ingest'

  let body: string
  try {
    body = await request.text()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Failed to read request body' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  try {
    const response = await fetch(FASTAPI_GATE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    })

    const data = await response.text()

    return new Response(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        // Proxy is same-origin, so credentials:include works for cookies
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Gate proxy failed', detail: String(err) }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
