/**
 * Client-side adapter for MentalHealthAI functionality
 * This module prevents server-side dependencies (like MongoDB) from being bundled in client-side code
 */

import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

import type { MentalHealthAIAdapter as ServerAdapter } from './index'
import type {
  MentalHealthAnalysisResult,
  RoutingContext,
} from './types/mentalHealthAITypes'

const logger = createBuildSafeLogger('mental-health-ai-client')

/**
 * Client-side interface for MentalHealthAI functionality
 * This provides the same interface as the server-side adapter but uses API calls instead
 */
export interface ClientMentalHealthAIAdapter {
  analyzeMentalHealth(
    content: string,
    _route: string,
    context: RoutingContext,
  ): Promise<MentalHealthAnalysisResult>
}

/**
 * Implementation that calls the API endpoint instead of server-side code
 */
class ApiMentalHealthAIAdapter implements ClientMentalHealthAIAdapter {
  async analyzeMentalHealth(
    content: string,
    _route: string,
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
    } catch (error: unknown) {
      logger.error('Failed to analyze mental health via API', { error })

      // Return a fallback analysis result
      return {
        hasMentalHealthIssue: false,
        mentalHealthCategory: 'general',
        explanation: 'Analysis temporarily unavailable',
        confidence: 0,
        supportingEvidence: [],
        isCrisis: false,
        stressLevel: 0.1,
        timestamp: new Date().toISOString(),
      }
    }
  }
}

/**
 * Factory function that creates a client-safe MentalHealthAI adapter
 * This will not import any server-side dependencies
 */
export async function createClientMentalHealthAIAdapter(): Promise<{
  adapter: ClientMentalHealthAIAdapter
}> {
  logger.info('Creating client-side MentalHealthAI adapter')

  return {
    adapter: new ApiMentalHealthAIAdapter(),
  }
}

/**
 * Check if we're running on the client side
 */
function isClientSide(): boolean {
  return typeof window !== 'undefined'
}

/**
 * Replacement for createMentalHealthAIFromEnv that works on both client and server
 * On client: returns a client-safe API-based adapter
 * On server: dynamically imports and returns the real adapter
 */
export async function createMentalHealthAIFromEnvSafe(): Promise<{
  adapter: ClientMentalHealthAIAdapter | ServerAdapter
}> {
  if (isClientSide()) {
    // Client side - use API adapter
    logger.info('Client-side detected, using API adapter')
    return createClientMentalHealthAIAdapter()
  } else {
    // Server side - dynamically import the real implementation
    logger.info('Server-side detected, using real MentalHealthAI adapter')
    try {
      // Hide from Vite's static analysis to prevent mongodb bundling in client build
      const modulePath = './index.ts'
      const { createMentalHealthAIFromEnv } = await import(/* @vite-ignore */ modulePath)
      return await createMentalHealthAIFromEnv()
    } catch (error: unknown) {
      logger.error('Failed to load server-side MentalHealthAI adapter', { error })
      // Fallback to client adapter even on server if there's an issue
      return createClientMentalHealthAIAdapter()
    }
  }
}
