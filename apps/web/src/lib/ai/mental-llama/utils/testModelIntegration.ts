import { getHipaaCompliantLogger } from '@/lib/logging/standardized-logger'

import { getEnv } from '../../../../config/env.config.ts'

const logger = getHipaaCompliantLogger('general')

/**
 * Represents the result of a MentalLLaMA model configuration check.
 */
export interface MentalLLaMAModelConfigResult {
  /** Indicates whether the MentalLLaMA model is properly configured (API keys, provider, etc.) */
  isConfigured: boolean
  /** Optional human-readable connection status or error message. */
  connectionStatus?: string
  /** Optional details about the configuration status, including which variables were checked. */
  details?: Record<string, string | boolean | undefined>
}

/**
 * Verifies the MentalLLaMA model configuration by checking necessary environment variables.
 * This function is primarily used by the `/api/ai/mental-health/status` endpoint
 * to report on the system's ability to connect to the MentalLLaMA models.
 *
 * @returns {Promise<MentalLLaMAModelConfigResult>} An object indicating if the models are configured,
 * the connection status, and details about the checked environment variables.
 */
export async function verifyMentalLLaMAModelConfiguration(): Promise<MentalLLaMAModelConfigResult> {
  try {
    const env = getEnv
    const apiKey = env['MENTALLAMA_API_KEY']
    const endpoint7B = env['MENTALLAMA_ENDPOINT_URL_7B']

    const requiredVars = {
      MENTALLAMA_API_KEY: !!apiKey,
      MENTALLAMA_ENDPOINT_URL_7B: !!endpoint7B,
    }

    const missingVars = Object.entries(requiredVars)
      .filter(([, value]) => !value)
      .map(([key]) => key)

    if (missingVars.length > 0) {
      const message = `Missing required MentalLLaMA environment variables: ${missingVars.join(', ')}`
      logger.warn(message)
      return {
        isConfigured: false,
        connectionStatus: 'missing-configuration',
        details: { ...requiredVars, errorMessage: message },
      }
    }

    // As a further step, one could try to instantiate the ModelProvider
    // or even make a very lightweight test call to the endpoint if the API supports it (e.g., a status or info endpoint).
    // For now, checking env vars is a significant improvement.

    logger.info(
      'MentalLLaMA configuration appears valid based on environment variables.',
    )
    return {
      isConfigured: true,
      connectionStatus: 'available',
      details: { ...requiredVars },
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? String(error) : String(error)
    logger.error('Error during MentalLLaMA model configuration verification:', {
      error: errorMessage,
    })
    return {
      isConfigured: false,
      connectionStatus: 'error',
      details: { errorMessage },
    }
  }
}
