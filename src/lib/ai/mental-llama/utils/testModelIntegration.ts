import { getEnv } from '../../../../config/env.config.ts'
import { getHipaaCompliantLogger } from '@/lib/logging/standardized-logger'
// It might be good to use the factory to check, but that could be too heavy for a status check.
// For now, directly checking env vars needed by MentalLLaMAModelProvider.
// import { createMentalLLaMAFactoryFromEnv } from '../index';

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
    // const endpoint13B = env['MENTALLAMA_ENDPOINT_URL_13B']; // Check 13B if it's considered essential or default

    const requiredVars = {
      MENTALLAMA_API_KEY: !!apiKey,
      MENTALLAMA_ENDPOINT_URL_7B: !!endpoint7B,
      // MENTALLAMA_ENDPOINT_URL_13B: !!endpoint13B, // Add if 13B is also required for "configured" status
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
    // Example of a deeper check (can be added later if needed):
    /*
    try {
      const { modelProvider } = await createMentalLLaMAFactoryFromEnv();
      // If modelProvider.ping() or similar exists:
      // await modelProvider.ping();
      // Or, simply successfully constructing it without it throwing an error in its constructor due to mock config
      if (modelProvider.getModelConfig().modelId?.startsWith('mock-')) {
         return {
            isConfigured: false,
            connectionStatus: 'mock-provider-active', // Indicates it fell back to mock
            details: { ...requiredVars, modelId: modelProvider.getModelConfig().modelId }
         }
      }
    } catch (factoryError) {
      logger.error('Failed to initialize MentalLLaMA factory for status check', { factoryError });
      return {
        isConfigured: false,
        connectionStatus: 'factory-initialization-failed',
        details: { ...requiredVars, errorMessage: factoryError instanceof Error ? factoryError.message : String(factoryError) }
      };
    }
    */

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
