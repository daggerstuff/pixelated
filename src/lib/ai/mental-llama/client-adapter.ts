/**
 * Client-side adapter for MentalLLaMA functionality
 * This module prevents server-side dependencies (like MongoDB) from being bundled in client-side code
 */

import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import type {
  MentalHealthAnalysisResult,
  RoutingContext,
} from './types/mentalLLaMATypes'
import type { MentalLLaMAAdapter as ServerAdapter } from './index'

const logger = createBuildSafeLogger('mental-llama-client')

/**
 * Client-side interface for MentalLLaMA functionality
 * This provides the same interface as the server-side adapter but uses API calls instead
 */
export interface ClientMentalLLaMAAdapter {
  analyzeMentalHealth(
    content: string,
    route: string,
    context: RoutingContext,
  ): Promise<MentalHealthAnalysisResult>
}

/**
 * Implementation that calls the API endpoint instead of server-side code
 */
class ApiMentalLLaMAAdapter implements ClientMentalLLaMAAdapter {
  async analyzeMentalHealth(
    content: string,
    route: string,
    context: RoutingContext,
  ): Promise<MentalHealthAnalysisResult> {
    try {
      const response = await fetch('/api/ai/mental-health/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: content,
          useExpertGuidance: true,
          routingContext: context,
        }),
      })

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`)
      }

      const result = await response.json()
      return result as MentalHealthAnalysisResult
    } catch (error) {
      logger.error('Failed to analyze mental health via API', { error })

      // Return a fallback analysis result
      return {
        hasMentalHealthIssue: false,
        mentalHealthCategory: 'general',
        explanation: 'Analysis temporarily unavailable',
        confidence: 0,
        supportingEvidence: [],
        isCrisis: false,
        stressLevel: 'low',
        modelInfo: {
          directModelAvailable: false,
          modelTier: '7B',
        },
      }
    }
  }
}

/**
 * Factory function that creates a client-safe MentalLLaMA adapter
 * This will not import any server-side dependencies
 */
export async function createClientMentalLLaMAAdapter(): Promise<{
  adapter: ClientMentalLLaMAAdapter
}> {
  logger.info('Creating client-side MentalLLaMA adapter')

  return {
    adapter: new ApiMentalLLaMAAdapter(),
  }
}

/**
 * Check if we're running on the client side
 */
function isClientSide(): boolean {
  return typeof window !== 'undefined'
}

/**
 * Replacement for createMentalLLaMAFromEnv that works on both client and server
 * On client: returns a client-safe API-based adapter
 * On server: dynamically imports and returns the real adapter
 */
export async function createMentalLLaMAFromEnvSafe(): Promise<{
  adapter: ClientMentalLLaMAAdapter | ServerAdapter
}> {
  if (isClientSide()) {
    // Client side - use API adapter
    logger.info('Client-side detected, using API adapter')
    return createClientMentalLLaMAAdapter()
  } else {
    // Server side - dynamically import the real implementation
    logger.info('Server-side detected, using real MentalLLaMA adapter')
    try {
      const { createMentalLLaMAFromEnv } = await import('./index.js')
      return await createMentalLLaMAFromEnv()
    } catch (error) {
      logger.error('Failed to load server-side MentalLLaMA adapter', { error })
      // Fallback to client adapter even on server if there's an issue
      return createClientMentalLLaMAAdapter()
    }
  }
}
