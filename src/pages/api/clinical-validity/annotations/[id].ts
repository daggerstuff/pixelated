import type { APIRoute } from 'astro'

/**
 * Astro proxy endpoint for PATCH /api/clinical-validity/annotations/{id}
 * Forwards to FastAPI annotation API: PATCH /queue/{item_id}/review
 *
 * Expected request body:
 * {
 *   reviewer_score: number (0-1),
 *   notes: string,
 *   reviewer_id: string
 * }
 */

export const prerender = false

interface ReviewPatchRequest {
  reviewer_score: number
  notes: string
  reviewer_id: string
}

export const PATCH: APIRoute = async ({ params, request }) => {
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
    const body: ReviewPatchRequest = await request.json()

    // Validate required fields
    if (typeof body.reviewer_score !== 'number') {
      return new Response(
        JSON.stringify({
          error: 'reviewer_score is required and must be a number',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    if (body.reviewer_score < 0 || body.reviewer_score > 1) {
      return new Response(
        JSON.stringify({ error: 'reviewer_score must be between 0 and 1' }),
        {
          status: 422,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    if (!body.reviewer_id || typeof body.reviewer_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'reviewer_id is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Forward to FastAPI annotation API
    const apiResponse = await fetch(
      `http://localhost:3102/queue/${itemId}/review`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          reviewer_score: body.reviewer_score,
          notes: body.notes || '',
          reviewer_id: body.reviewer_id,
        }),
      },
    )

    if (apiResponse.ok) {
      const data = await apiResponse.json()
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } else if (apiResponse.status === 422) {
      // Validation error from FastAPI (e.g., score out of range)
      const errorData = await apiResponse.json()
      return new Response(JSON.stringify(errorData), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      })
    } else {
      console.error(
        `Annotation API error: ${apiResponse.status} ${apiResponse.statusText}`,
      )
      return new Response(
        JSON.stringify({ error: 'Failed to update annotation review' }),
        {
          status: apiResponse.status,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }
  } catch (err) {
    console.error('Error forwarding PATCH to annotation API:', err)
    return new Response(
      JSON.stringify({
        error: 'Failed to process review update',
        details: err instanceof Error ? err.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
