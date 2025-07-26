import type { APIRoute } from 'astro'
import {
  getAllModels,
  getModelsByCapability,
  getModelsByProvider,
  type AIModel,
} from '../../../lib/ai/models/registry'
import { getSession } from '../../../lib/auth/session'

/**
 * API route for retrieving available AI models
 */
export const GET: APIRoute = async ({ request, url }) => {
  try {
    // Get session and verify authentication
    const session = await getSession(request)
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Get query parameters
    const provider = url.searchParams.get('provider')
    const capability = url.searchParams.get('capability')

    let models: AIModel[]

    // Filter models based on query parameters
    if (provider === 'together') {
      if (capability) {
        // Filter together models by capability
        models = getModelsByProvider('together').filter((model: AIModel) =>
          model.capabilities.includes(
            capability as
              | 'chat'
              | 'sentiment'
              | 'crisis'
              | 'response'
              | 'intervention',
          ),
        )
      } else {
        // Get all together models
        models = getModelsByProvider('together')
      }
    } else if (capability) {
      // Get models by capability regardless of provider
      models = getModelsByCapability(
        capability as
          | 'chat'
          | 'sentiment'
          | 'crisis'
          | 'response'
          | 'intervention',
      )
    } else {
      // Get all models
      models = getAllModels()
    }

    // Return JSON response
    return new Response(JSON.stringify({ models }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    console.error('Error retrieving AI models:', error)

    // Return error response
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'An error occurred while retrieving AI models',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
