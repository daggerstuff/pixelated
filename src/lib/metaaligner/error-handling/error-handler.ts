/**
 * @module error-handler
 * @description This module provides a comprehensive error handling strategy for the MetaAligner pipeline.
 */

import { getAiServiceLogger } from '@/lib/logging/standardized-logger'
import type { UnifiedProcessingResponse } from '../api/unified-api'

const logger = getAiServiceLogger('error-handler')

/**
 * Base class for custom errors.
 */
export class MetaAlignerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

/**
 * Error that occurs during processing.
 */
export class ProcessingError extends MetaAlignerError {}

/**
 * Error that occurs during validation.
 */
export class ValidationError extends MetaAlignerError {}

/**
 * Error that occurs during enhancement.
 */
export class EnhancementError extends MetaAlignerError {}

/**
 * Defines the interface for the ErrorHandler.
 */
export interface IErrorHandler {
  /**
   * Handles an error.
   *
   * @param error - The error to handle.
   * @returns A fallback response.
   */
  handle(error: Error): UnifiedProcessingResponse
}

/**
 * The ErrorHandler class.
 */
export class ErrorHandler implements IErrorHandler {
  public handle(error: Error): UnifiedProcessingResponse {
    logger.error('An error occurred in the MetaAligner pipeline', { error })
    this.sendToMonitoringService(error)
    if (error instanceof ProcessingError) {
      return this.handleProcessingError(error)
    } else if (error instanceof ValidationError) {
      return this.handleValidationError(error)
    } else if (error instanceof EnhancementError) {
      return this.handleEnhancementError(error)
    } else {
      return this.handleGenericError(error)
    }
  }

  private handleProcessingError(
    error: ProcessingError,
  ): UnifiedProcessingResponse {
    return {
      enhancedResponse: 'Error: Could not process the response.',
      originalResponse: '',
      alignment: {} as any,
      errors: [{ message: error.message, stage: 'processing' }],
    }
  }

  private handleValidationError(
    error: ValidationError,
  ): UnifiedProcessingResponse {
    return {
      enhancedResponse: 'Error: Invalid request format.',
      originalResponse: '',
      alignment: {} as any,
      errors: [{ message: error.message, stage: 'validation' }],
    }
  }

  private handleEnhancementError(
    error: EnhancementError,
  ): UnifiedProcessingResponse {
    return {
      enhancedResponse: 'Error: Could not enhance the response.',
      originalResponse: '',
      alignment: {} as any,
      errors: [{ message: error.message, stage: 'enhancement' }],
    }
  }

  private handleGenericError(error: Error): UnifiedProcessingResponse {
    return {
      enhancedResponse: 'An unexpected error occurred.',
      originalResponse: '',
      alignment: {} as any,
      errors: [{ message: error.message, stage: 'unknown' }],
    }
  }

  private sendToMonitoringService(error: Error): void {
    // Placeholder for sending errors to a monitoring service like Sentry or Datadog.
    logger.info('Sending error to monitoring service', { error })
  }
}
