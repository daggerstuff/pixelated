import type { APIRoute } from 'astro'
import { verifyMentalLLaMAModelConfiguration } from '../../../../lib/ai/mental-llama/utils/testModelIntegration'

/**
 * API endpoint to check the status of the MentalLLaMA model
 * Returns configuration status and any error messages
 */
export const GET: APIRoute = async () => {
  try {
    const configResult = await verifyMentalLLaMAModelConfiguration()

    return new Response(
      JSON.stringify({
        isConfigured: configResult.isConfigured,
        connectionStatus: configResult.connectionStatus || null,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error: unknown) {
    console.error('Error checking MentalLLaMA model status:', error)

    return new Response(
      JSON.stringify({
        isConfigured: false,
        error: error instanceof Error ? String(error) : String(error),
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
