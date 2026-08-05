import type { APIRoute } from 'astro'

import { causalDagService } from '../../../lib/causal/causal-dag'

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json()
    const { nodeId, value, context } = body

    if (!nodeId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'nodeId is required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const result = await causalDagService.estimateIntervention({
      nodeId,
      value,
      context,
    })

    return new Response(
      JSON.stringify({
        success: true,
        result,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message.includes('does not exist') ? 404 : 500

    return new Response(
      JSON.stringify({
        success: false,
        error: message,
      }),
      {
        status,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

export const GET: APIRoute = async () => {
  try {
    const graph = causalDagService.getGraph()

    return new Response(
      JSON.stringify({
        success: true,
        graph,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    return new Response(
      JSON.stringify({
        success: false,
        error: message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
