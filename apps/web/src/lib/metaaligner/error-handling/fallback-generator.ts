/**
 * @module fallback-generator
 * @description This module provides a fallback response generator for the MetaAligner pipeline.
 */

import type { UnifiedProcessingResponse } from '../api/unified-api'
import { MetaAlignerError } from './error-handler'

/**
 * Defines the interface for the FallbackGenerator.
 */
export interface IFallbackGenerator {
  /**
   * Generates a fallback response.
   *
   * @param error - The error that occurred.
   * @returns A fallback response.
   */
  generate(error: Error): UnifiedProcessingResponse
}

/**
 * The FallbackGenerator class.
 */
export class FallbackGenerator implements IFallbackGenerator {
  public generate(error: Error): UnifiedProcessingResponse {
    if (error instanceof MetaAlignerError) {
      return {
        enhancedResponse: `A known error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`,
        originalResponse: '',
      alignment: {
        evaluation: {
          overallScore: 0,
          objectiveResults: {},
          weights: {},
          normalizedScores: {},
          aggregationMethod: 'weighted' as const,
          evaluationContext: {} as never,
          timestamp: new Date(),
        },
        metrics: {
          overallScore: 0,
          dimensionScores: {},
          confidence: 0,
          timestamp: new Date(),
        },
        enhanced: false,
        enhancementAttempts: 0,
      },
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            stage: 'unknown',
          },
        ],
      }
    } else {
      return {
        enhancedResponse:
          'An unexpected error occurred. Please try again later.',
        originalResponse: '',
      alignment: {
        evaluation: {
          overallScore: 0,
          objectiveResults: {},
          weights: {},
          normalizedScores: {},
          aggregationMethod: 'weighted' as const,
          evaluationContext: {} as never,
          timestamp: new Date(),
        },
        metrics: {
          overallScore: 0,
          dimensionScores: {},
          confidence: 0,
          timestamp: new Date(),
        },
        enhanced: false,
        enhancementAttempts: 0,
      },
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            stage: 'unknown',
          },
        ],
      }
    }
  }
}
