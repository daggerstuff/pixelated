import type { APIRoute } from 'astro'

import { verifyMentalHealthAIModelConfiguration } from '../../../../lib/ai/mental-health-ai/utils/testModelIntegration'

/**
 * API endpoint to check the status of the MentalHealthAI model
 * Returns configuration status and any error messages
 */
export const GET: APIRoute = async () => {
  try {
    const configResult = await verifyMentalHealthAIModelConfiguration()

    return new Response(
      JSON.stringify({
        isConfigured: configResult.isConfigured,
        connectionStatus: configResult.connectionStatus ?? null,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error: unknown) {
    console.error('Error checking MentalHealthAI model status:', error)

    return new Response(
      JSON.stringify({
        isConfigured: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }
}
