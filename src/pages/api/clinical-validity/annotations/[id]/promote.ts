import type { APIRoute } from 'astro'

/**
 * Astro proxy endpoint for POST /api/clinical-validity/annotations/{id}/promote
 * Forwards to FastAPI annotation API: POST /queue/{item_id}/promote
 *
 * Expected request body:
 * {
 *   promoter_id: string,
 *   target_stage?: string (optional, e.g., 'reviewed', 'validated', 'merged'),
 *   notes?: string (optional)
 * }
 */

export const prerender = false

interface PromoteRequest {
  promoter_id: string
  target_stage?: string
  notes?: string
}

export const POST: APIRoute = async ({ params, request }) => {
  const { id } = params

  if (!id) {
    return new Response(
      JSON.stringify({ error: 'Annotation ID is required' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  const itemId = parseInt(id, 10)
  if (isNaN(itemId)) {
    return new Response(
      JSON.stringify({ error: 'Invalid annotation ID format' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  try {
    const body: PromoteRequest = await request.json()

    // Validate required fields
    if (!body.promoter_id || typeof body.promoter_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'promoter_id is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Validate optional target_stage if provided
    const validStages = ['reviewed', 'validated', 'merged']
    if (body.target_stage && !validStages.includes(body.target_stage)) {
      return new Response(
        JSON.stringify({
          error: `target_stage must be one of: ${validStages.join(', ')}`,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Forward to FastAPI annotation API
    // Extract X-Promoter-Role from incoming request headers to forward auth
    const forwardedHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
    const incomingHeaders = new Headers(request.headers)
    const promoterRole = incomingHeaders.get('X-Promoter-Role')
    if (promoterRole) {
      forwardedHeaders['X-Promoter-Role'] = promoterRole
    }

    const apiResponse = await fetch(`http://localhost:3102/queue/${itemId}/promote`, {
      method: 'POST',
      headers: forwardedHeaders,
      body: JSON.stringify({
        promoter_id: body.promoter_id,
        target_stage: body.target_stage ?? null,
        notes: body.notes ?? null,
      }),
    })

    if (apiResponse.ok) {
      const data = await apiResponse.json()
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } else if (apiResponse.status === 409) {
      // Conflict: cannot skip stages in staged workflow
      const errorData = await apiResponse.json()
      return new Response(JSON.stringify(errorData), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      })
    } else if (apiResponse.status === 401) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - authentication required' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    } else if (apiResponse.status === 403) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - promotion role required' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    } else {
      console.error(`Annotation API promote error: ${apiResponse.status} ${apiResponse.statusText}`)
      return new Response(
        JSON.stringify({ error: 'Failed to promote annotation' }),
        {
          status: apiResponse.status,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }
  } catch (err) {
    console.error('Error forwarding POST promote to annotation API:', err)
    return new Response(
      JSON.stringify({
        error: 'Failed to process promotion request',
        details: err instanceof Error ? err.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
